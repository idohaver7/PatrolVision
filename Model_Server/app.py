from fastapi import FastAPI, File, UploadFile
from typing import List
import uvicorn
import numpy as np
import cv2
import io
from PIL import Image,ImageOps
from ultralytics import YOLO
from solid_line_detection import detect_solid_line_violation
from bus_lane_detection import detect_bus_line_violation
from fastapi.responses import FileResponse
import os

app = FastAPI()

# Our YOLO-Segmentation model
model = YOLO('traffic_model.pt') 
lpr_model = YOLO('lpr_model.pt')  # Initialize YOLO model for license plate recognition

#------CONFIGURATION-------
POLYGON_CLASS_NAMES = {"solid_line", "bus line", "stop_line"}
BOX_CLASS_NAMES = {"car", "bus", "truck", "traffic_light_red", "traffic_light_green", "taxi_hat", "license_plate"}
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
        
    #run the model on the batch of frames
    print("⏳ Running YOLO tracking...")
    results = model.track(frames,persist=True,tracker="bytetrack.yaml",conf=0.25)
    if len(results) > 0:
        annotated_frames = []
        for res in results:
             annotated_frames.append(res.plot())
#-------------DEBUGGING------------------
        valid_frames = [f for f in annotated_frames if f is not None and f.size > 0]
        if len(valid_frames) > 0:
            target_height, target_width = valid_frames[0].shape[:2]
            resized_frames = [cv2.resize(f, (target_width, target_height)) if f.shape[:2] != (target_height, target_width) else f for f in valid_frames]
            combined_image = cv2.hconcat(resized_frames)
            cv2.imwrite("debug_vision.jpg", combined_image)
#-----------------------------------------------------------
    
    batch_analysis = []
    
    # analyze each frame's results
    for i, result in enumerate(results):
        frame_data = {
            "frame_index": i, 
            "detections": []
        }
        
        # Check if masks are present 
        if result.masks is not None:
            masks_xy = result.masks.xy if result.masks is not None else [None] * len(result.boxes)
            #exatract polygon for line classes and bounding boxes for the more square classes
            for box,mask_polygon in zip(result.boxes, masks_xy):
                class_id = int(box.cls[0])
                class_name = model.names[class_id]
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
                    # [x1, y1, x2, y2]
                    detection_info["coordinates"] = box.xyxy[0].tolist()
                
                    if box.id is not None:
                        detection_info["track_id"] = int(box.id[0])  # Add tracking ID if available
                    else:
                        detection_info["id"] = -1  # No ID assigned 
                if "type" in detection_info:
                    frame_data["detections"].append(detection_info)
                
        
        batch_analysis.append(frame_data)
    has_solid_line = False
    has_bus_line = False
    for frame_data in batch_analysis:
            if has_solid_line and has_bus_line:
                break
                
            for det in frame_data["detections"]:
                class_name = det["class_name"]
                if class_name == "solid_line":
                    has_solid_line = True
                elif class_name == "bus line":
                    has_bus_line = True    
    if has_solid_line:
        print("✔️ Pre-check passed: Solid line found. Running solid line logic...")
        violation_result = detect_solid_line_violation(batch_analysis,frames,lpr_model)
        if violation_result.get("violation"):
            return violation_result
    else:
            print("⏩ Pre-check skipped: No solid line in batch.")
    if has_bus_line:
        print("✔️ Pre-check passed: Bus line found. Running bus lane logic...")
        violation_result = detect_bus_line_violation(batch_analysis, frames, lpr_model)
        if violation_result.get("violation"):
            return violation_result
    else:
            print("⏩ Pre-check skipped: No bus line in batch.")
    print("✅ Finished processing! Sending response back to phone.")
    return {"violation": False}
        
   
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)