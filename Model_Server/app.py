from fastapi import FastAPI, File, Form, UploadFile
from typing import List
import uvicorn
import numpy as np
import cv2
import io
from PIL import Image,  ImageOps
from ultralytics import YOLO
import os


from solid_line_detection import detect_solid_line_violation
from bus_lane_detection import detect_bus_line_violation
from red_light_detection import detect_red_light_violation, set_session_stop_line, _pending_violations, approaching_vehicles
from fastapi.responses import FileResponse

app = FastAPI()

# Stores the first frame's model detection data for the current movie session
session_first_frame_data = None

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
    print("🚀 WARMING UP MODELS: Sending dummy frames to compile PyTorch graphs...")
    try:
        
        dummy_frame = np.zeros((1080, 1920, 3), dtype=np.uint8)

        model.predict([dummy_frame], conf=0.25, classes=None)
        tracker_model.track([dummy_frame], persist=True, tracker="bytetrack.yaml", conf=0.25, classes=vehicle_class_ids)


        dummy_lpr = np.zeros((224, 640, 3), dtype=np.uint8)
        lpr_model.predict(dummy_lpr)
        
        print("✅ WARMUP COMPLETE: Both models are hot and ready for the app!")
    except Exception as e:
        print(f"⚠️ WARMUP FAILED: {e}")


@app.get("/")
async def root():
    print("🟢 Someone pinged the root URL!")
    return {"status": "PatrolVision API is running successfully!"}

@app.get("/debug_image")
async def get_debug_image():
    image_path = "debug_vision.jpg"
    if os.path.exists(image_path):
        return FileResponse(image_path)
    return {"error": "No debug image found yet. Send a batch from the app first!"}

@app.get("/debug_violation")
async def get_violation_image():
    image_path = "violation_vision.jpg"
    if os.path.exists(image_path):
        return FileResponse(image_path)
    return {"error": "No violation image found yet. Waiting for a vehicle to break the law!"}
@app.get("/debug_plate")
async def get_debug_plate():
    image_path = "debug_plate.jpg"
    if os.path.exists(image_path):
        return FileResponse(image_path)
    return {"error": "No plate image found yet. Send a batch with a violation first!"}
@app.get("/debug_plate_upscaled")
async def get_debug_plate_upscaled():
    image_path = "debug_plate_upscaled.jpg"
    if os.path.exists(image_path):
        return FileResponse(image_path)
    return {"error": "No plate image found yet. Send a batch with a violation first!"}


@app.get("/debug_first_frame")
async def get_first_frame():
    image_path = "session_first_frame.jpg"
    if os.path.exists(image_path):
        return FileResponse(image_path)
    return {"error": "No first frame saved yet. Start a new analysis session first!"}

@app.get("/debug_raw/{idx}")
async def get_raw_incoming(idx: int):
    image_path = f"raw_incoming_{idx}.jpg"
    if os.path.exists(image_path):
        return FileResponse(image_path)
    return {"error": f"No raw frame #{idx} saved yet. Send a batch from the app first!"}

@app.get("/debug_raw_all")
async def get_all_raw_incoming():
    import glob, zipfile
    files = sorted(glob.glob("raw_incoming_*.jpg"))
    if not files:
        return {"error": "No raw frames saved yet. Send a batch from the app first!"}
    zip_path = "raw_incoming_all.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as zf:
        for f in files:
            zf.write(f)
    return FileResponse(zip_path, filename="raw_incoming_all.zip", media_type="application/zip")


@app.post("/analyze_batch")
async def analyze_sequence(files: List[UploadFile] = File(...), is_first_batch: bool = Form(False)):
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

    # Diagnostic: dump raw incoming frames (pre-inference) so we can download them
    # and run the model on them locally to compare detection counts.
    for idx, frame in enumerate(frames):
        cv2.imwrite(f"raw_incoming_{idx}.jpg", frame)

    # Two inference passes:
    #   - predict() returns EVERY detection (plates/lines/lights/taxi_hat) — tracker can't silently drop them
    #   - track() runs ONLY on vehicles with stable IDs for violation de-duplication & taxi memory
    print("⏳ Running YOLO predict (all classes)...")
    predict_results = model.predict(frames, conf=0.25)
    print("⏳ Running YOLO track (vehicles only)...")
    track_results = tracker_model.track(frames, persist=True, tracker="bytetrack.yaml", conf=0.25, classes=vehicle_class_ids)

    annotated_frames = []
    combined_image = None
    if len(predict_results) > 0:
        for res in predict_results:
            annotated_frames.append(res.plot())
#-------------DEBUGGING------------------
        # Overlay track IDs from tracker on top of predict-annotated frames
        for i, trk_res in enumerate(track_results):
            if i >= len(annotated_frames) or trk_res.boxes is None:
                continue
            frame = annotated_frames[i]
            for box in trk_res.boxes:
                if box.id is None:
                    continue
                tid = int(box.id[0])
                x1, y1, x2, _ = map(int, box.xyxy[0].tolist())
                cx, cy = (x1 + x2) // 2, y1 - 10
                cv2.putText(frame, f"ID:{tid}", (cx, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
            annotated_frames[i] = frame

        valid_frames = [f for f in annotated_frames if f is not None and f.size > 0]
        if len(valid_frames) > 0:
            target_height, target_width = valid_frames[0].shape[:2]
            resized_frames = [cv2.resize(f, (target_width, target_height)) if f.shape[:2] != (target_height, target_width) else f for f in valid_frames]
            combined_image = cv2.hconcat(resized_frames)
            cv2.imwrite("debug_vision.jpg", combined_image)
#-----------------------------------------------------------

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

    # --- SAVE FIRST FRAME OF SESSION (annotated + detections) ---
    if is_first_batch and batch_analysis:
        global session_first_frame_data
        session_first_frame_data = batch_analysis[0]
        cv2.imwrite("session_first_frame.jpg", annotated_frames[0])
        print(f"📸 Saved first frame of new session → session_first_frame.jpg ({len(session_first_frame_data['detections'])} detections)")
        set_session_stop_line(session_first_frame_data)

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
            elif class_name == "stop_line":         # <--- NEW
                has_stop_line = True
            elif class_name == "traffic_light_red": # <--- NEW
                has_red_light = True
                
    # --- RUNNING DETECTION LOGICS ---
    
    # 1. Solid Line Detection
    if has_solid_line:
        print("✔️ Pre-check passed: Solid line found. Running solid line logic...")
        violation_result = detect_solid_line_violation(batch_analysis, frames, lpr_model, image_height)
        if violation_result.get("violation"):
            if combined_image is not None:
                cv2.imwrite("violation_vision.jpg", combined_image)
            return violation_result
    else:
        print("⏩ Pre-check skipped: No solid line in batch.")
            
    # 2. Bus Lane Detection
    if has_bus_line:
        print("✔️ Pre-check passed: Bus line found. Running bus lane logic...")
        violation_result = detect_bus_line_violation(batch_analysis, frames, lpr_model, image_height)
        if violation_result.get("violation"):
            if combined_image is not None:
                cv2.imwrite("violation_vision.jpg", combined_image)
            return violation_result
    else:
        print("⏩ Pre-check skipped: No bus line in batch.")
            
    # 3. Red Light Detection
    # Save the last batch with a red light visible — used as violation image for ghost crossings
    if has_red_light and combined_image is not None:
        cv2.imwrite("last_red_frame.jpg", combined_image)

    has_prior_red_approachers = any(v[4] for v in approaching_vehicles.values())
    if has_red_light or _pending_violations or has_prior_red_approachers:
        if _pending_violations:
            print("✔️ Pending red light violations in queue. Running red light logic...")
        elif has_prior_red_approachers and not has_red_light:
            print("⚠️ No red light now, but prior red-light approachers exist — checking cross-batch crossings...")
        else:
            print("✔️ Pre-check passed: Red light found. Running red light logic...")
        violation_result = detect_red_light_violation(batch_analysis, frames, lpr_model, image_height)
        if violation_result.get("violation"):
            frame_image = violation_result.pop("frame_image", None)
            frame_index = violation_result.pop("frame_index", None)
            # Prefer the annotated frame (has predict boxes + track IDs) over the raw frame
            if frame_index is not None and frame_index < len(annotated_frames):
                cv2.imwrite("violation_vision.jpg", annotated_frames[frame_index])
            elif frame_image is not None:
                cv2.imwrite("violation_vision.jpg", frame_image)
            elif not has_red_light and os.path.exists("last_red_frame.jpg"):
                import shutil
                shutil.copy("last_red_frame.jpg", "violation_vision.jpg")
            elif combined_image is not None:
                cv2.imwrite("violation_vision.jpg", combined_image)
            return violation_result
    else:
        print("⏩ Pre-check skipped: No red light in batch.")

    print("✅ Finished processing! Sending response back to phone.")
    return {"violation": False}
        
        
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)