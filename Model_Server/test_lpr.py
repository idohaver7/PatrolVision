"""
Quick test for extract_license_plate() from utils.py.

Usage:
    python test_lpr.py <image_path>
    python test_lpr.py car.jpg
"""

import sys
import cv2
from ultralytics import YOLO
from utils import extract_license_plate

TRAFFIC_MODEL_PATH = "traffic_model.pt"
LPR_MODEL_PATH     = "lpr_model.pt"
OUTPUT_PATH        = "lpr_debug.jpg"
VEHICLE_CLASSES    = {"car", "truck", "bus"}
PLATE_CLASS        = "license_plate"


def test_lpr(image_path):
    # Load image
    frame = cv2.imread(image_path)
    if frame is None:
        print(f"ERROR: Could not load image at '{image_path}'")
        return
    print(f"✅ Loaded image: {image_path}  ({frame.shape[1]}×{frame.shape[0]})")

    # Run traffic model
    print("⏳ Running traffic_model detection …")
    traffic_model = YOLO(TRAFFIC_MODEL_PATH)
    lpr_model     = YOLO(LPR_MODEL_PATH)

    result = traffic_model(frame, verbose=False)[0]

    # Build detections list
    detections    = []
    vehicle_boxes = []
    plate_boxes   = []

    for box in result.boxes:
        cls_id     = int(box.cls[0])
        class_name = traffic_model.names[cls_id]
        conf       = float(box.conf[0])
        coords     = box.xyxy[0].tolist()

        if class_name in VEHICLE_CLASSES:
            vehicle_boxes.append((coords, conf))
            detections.append({
                "class_name":  class_name,
                "type":        "box",
                "coordinates": coords,
                "confidence":  conf,
                "track_id":    1,
            })
        elif class_name == PLATE_CLASS:
            plate_boxes.append((coords, conf))
            detections.append({
                "class_name":  PLATE_CLASS,
                "type":        "box",
                "coordinates": coords,
                "confidence":  conf,
            })

    print(f"   🚗 Vehicles detected : {len(vehicle_boxes)}")
    print(f"   🪪 Plates detected   : {len(plate_boxes)}")

    if not vehicle_boxes:
        print("\n⚠️  No vehicles found — check that the model recognises 'car'/'truck'/'bus' in this scene.")
        return

    if not plate_boxes:
        print("\n⚠️  No license_plate detections found — LPR will have no crop to work with.")

    # Build mock history / batch_analysis
    best_vehicle_coords = max(vehicle_boxes, key=lambda x: x[1])[0]

    history        = {"frames": [0], "coords": [best_vehicle_coords]}
    batch_analysis = [{"frame_index": 0, "detections": detections}]
    frames         = [frame]

    # Run extract_license_plate
    print("\n⏳ Running extract_license_plate() …")
    plate_text = extract_license_plate(history, batch_analysis, frames, lpr_model)

    print(f"\n{'='*45}")
    print(f"  Result : {plate_text}")
    print(f"{'='*45}\n")

    # Save annotated debug image
    annotated = result.plot()
    label = f"Plate: {plate_text}"
    cv2.rectangle(annotated, (8, 8), (len(label) * 14 + 16, 42), (0, 0, 0), -1)
    cv2.putText(annotated, label, (12, 32),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 80), 2, cv2.LINE_AA)
    cv2.imwrite(OUTPUT_PATH, annotated)
    print(f"📸 Debug image saved → {OUTPUT_PATH}")


if __name__ == "__main__":
    IMAGE_PATH = 'check.png'
    test_lpr(IMAGE_PATH)
