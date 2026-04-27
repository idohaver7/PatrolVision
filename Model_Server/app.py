from fastapi import FastAPI, File, UploadFile
from typing import List
import uvicorn
import numpy as np
import cv2
import io
from PIL import Image,  ImageOps
from ultralytics import YOLO


from solid_line_detection import detect_solid_line_violation, _pending_violations as _pending_solid_violations
from bus_lane_detection import detect_bus_line_violation, _pending_violations as _pending_bus_violations
from red_light_detection import detect_red_light_violation, _pending_violations as _pending_red_violations, approaching_vehicles

app = FastAPI()

# Our YOLO-Segmentation model.
# Two separate instances sharing the same weights: one exclusively for .predict() (all classes
# + masks), one exclusively for .track() (vehicles with stable IDs). Ultralytics binds state
# (predictor, tracker, class filter, result tensors) to a single predictor object, so mixing
# predict+track on one instance corrupts detections. Two instances = full isolation.
model = YOLO('traffic_model.pt')          # .predict() only — all classes, masks intact
tracker_model = YOLO('traffic_model.pt')  # .track() only — vehicles with stable IDs
lpr_model = YOLO('lpr_model.pt')          # Initialize YOLO model for license plate recognition

#------CONFIGURATION-------
POLYGON_CLASS_NAMES = {"solid_line", "bus line", "stop_line"}
BOX_CLASS_NAMES = {"car", "bus", "truck", "traffic_light_red", "traffic_light_green", "taxi_hat", "license_plate"}
# Only these classes go through the tracker (stable IDs for de-duplicating violations & flagging taxis).
# Everything else runs through plain predict() so the tracker doesn't drop low-confidence small objects
# (e.g. license plates) on the first frame of each batch.
VEHICLE_CLASS_NAMES = {"car", "bus", "truck"}
vehicle_class_ids = [cid for cid, cname in model.names.items() if cname in VEHICLE_CLASS_NAMES]

#------------WARMUP--------------------
@app.on_event("startup")
async def startup_event():
    print("🚀 WARMING UP MODELS: Sending warmup frames to compile PyTorch graphs...")
    try:
        
        warmup_frame = np.zeros((1080, 1920, 3), dtype=np.uint8)

        model.predict([warmup_frame], conf=0.25, classes=None)
        tracker_model.track([warmup_frame], persist=True, tracker="bytetrack.yaml", conf=0.25, classes=vehicle_class_ids)


        warmup_frame_lpr = np.zeros((224, 640, 3), dtype=np.uint8)
        lpr_model.predict([warmup_frame_lpr])
        
        print("✅ WARMUP COMPLETE: Both models are hot and ready for the app!")
    except Exception as e:
        print(f"⚠️ WARMUP FAILED: {e}")


@app.get("/")
async def root():
    print("🟢 Someone pinged the root URL!")
    return {"status": "PatrolVision API is running successfully!"}

@app.post("/analyze_batch")
async def analyze_sequence(files: List[UploadFile] = File(...)):
    print(f"🔥 CONNECTION RECEIVED! Got batch of {len(files)} frames from phone.")
    frames = []
    
    # read each uploaded file and convert to OpenCV format
    for file in files:
        contents = await file.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")
        frame = np.array(img)
        frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        frames.append(frame)
    print(f"📏 RAW FRAME RECEIVED FROM APP: {frames[0].shape[1]}x{frames[0].shape[0]} pixels")

    # Two inference passes:
    #   - predict() returns EVERY detection (plates/lines/lights/taxi_hat) — tracker can't silently drop them
    #   - track() runs ONLY on vehicles with stable IDs for violation de-duplication & taxi memory
    print("⏳ Running YOLO predict (all classes)...")
    predict_results = model.predict(frames, conf=0.25)
    print("⏳ Running YOLO track (vehicles only)...")
    track_results = tracker_model.track(frames, persist=True, tracker="bytetrack.yaml", conf=0.25, classes=vehicle_class_ids)

    batch_analysis = []
    image_height = frames[0].shape[0] if frames else 512

    # analyze each frame: merge non-vehicle detections (from predict) with tracked vehicles (from track)
    for i in range(len(frames)):
        frame_data = {
            "frame_index": i,
            "detections": []
        }

        pred_result = predict_results[i] if i < len(predict_results) else None
        trk_result = track_results[i] if i < len(track_results) else None

        # --- non-vehicles from predict (polygons + boxes, no track_id needed) ---
        if pred_result is not None and pred_result.masks is not None:
            masks_xy = pred_result.masks.xy
            for box, mask_polygon in zip(pred_result.boxes, masks_xy):
                class_id = int(box.cls[0])
                class_name = model.names[class_id]
                if class_name in VEHICLE_CLASS_NAMES:
                    continue  # vehicles come from track_results below
                confidence = float(box.conf[0])

                detection_info = {
                    "class_name": class_name,
                    "confidence": confidence
                }

                if class_name in POLYGON_CLASS_NAMES and mask_polygon is not None:
                    detection_info["type"] = "polygon"
                    detection_info["coordinates"] = mask_polygon.tolist()
                elif class_name in BOX_CLASS_NAMES:
                    detection_info["type"] = "box"
                    detection_info["coordinates"] = box.xyxy[0].tolist()

                if "type" in detection_info:
                    frame_data["detections"].append(detection_info)

        # --- vehicles from track (with stable track_id) ---
        if trk_result is not None and trk_result.boxes is not None:
            for box in trk_result.boxes:
                class_id = int(box.cls[0])
                class_name = model.names[class_id]
                if class_name not in VEHICLE_CLASS_NAMES:
                    continue  # safety: classes= filter should already guarantee this
                confidence = float(box.conf[0])

                detection_info = {
                    "class_name": class_name,
                    "confidence": confidence,
                    "type": "box",
                    "coordinates": box.xyxy[0].tolist(),
                }
                if box.id is not None:
                    detection_info["track_id"] = int(box.id[0])
                else:
                    detection_info["id"] = -1

                frame_data["detections"].append(detection_info)

        batch_analysis.append(frame_data)

    # --- PRE-CHECKS ---
    has_solid_line = False
    has_bus_line = False
    has_stop_line = False   
    has_red_light = False   
    
    for frame_data in batch_analysis:
        # We only need to find one instance of each relevant class across the batch to trigger the corresponding logic
        if has_solid_line and has_bus_line and has_stop_line and has_red_light:
            break
            
        for det in frame_data["detections"]:
            class_name = det["class_name"]
            if class_name == "solid_line":
                has_solid_line = True
            elif class_name == "bus line":
                has_bus_line = True    
            elif class_name == "stop_line":         
                has_stop_line = True
            elif class_name == "traffic_light_red": 
                has_red_light = True
                
    # --- RUNNING DETECTION LOGICS ---
    
    # 1. Solid Line Detection
    if has_solid_line or _pending_solid_violations:
        if _pending_solid_violations:
            print("✔️ Pending solid line violations in queue. Running solid line logic...")
        else:
            print("✔️ Pre-check passed: Solid line found. Running solid line logic...")
        violation_result = detect_solid_line_violation(batch_analysis, frames, lpr_model, image_height)
        if violation_result.get("violation"):
            return violation_result
    else:
        print("⏩ Pre-check skipped: No solid line in batch.")

    # 2. Bus Lane Detection
    if has_bus_line or _pending_bus_violations:
        if _pending_bus_violations:
            print("✔️ Pending bus lane violations in queue. Running bus lane logic...")
        else:
            print("✔️ Pre-check passed: Bus line found. Running bus lane logic...")
        violation_result = detect_bus_line_violation(batch_analysis, frames, lpr_model, image_height)
        if violation_result.get("violation"):
            return violation_result
    else:
        print("⏩ Pre-check skipped: No bus line in batch.")

    # 3. Red Light Detection
    has_prior_red_approachers = any(v[4] for v in approaching_vehicles.values())
    if has_red_light or _pending_red_violations or has_prior_red_approachers:
        if _pending_red_violations:
            print("✔️ Pending red light violations in queue. Running red light logic...")
        elif has_prior_red_approachers and not has_red_light:
            print("⚠️ No red light now, but prior red-light approachers exist — checking cross-batch crossings...")
        else:
            print("✔️ Pre-check passed: Red light found. Running red light logic...")
        violation_result = detect_red_light_violation(batch_analysis, frames, lpr_model, image_height)
        if violation_result.get("violation"):
            return violation_result
    else:
        print("⏩ Pre-check skipped: No red light in batch.")

    print("✅ Finished processing! Sending response back to phone.")
    return {"violation": False}
        
        
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)