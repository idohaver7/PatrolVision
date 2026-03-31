import numpy as np
import cv2
# Utility functions for analyzing the batch of frames
def is_far(car, image_height=512, threshold_ratio=0.05):
    coords = car["coordinates"]
    car_height = coords[3] - coords[1]
    return car_height <= threshold_ratio * image_height

def get_center_bottom(box_coords):    
    x1, y1, x2, y2 = box_coords
    center_x = (x1 + x2) / 2.0
    center_y = y2  #center bottom is at the bottom edge of the box
    return center_x, center_y

def get_box_area(box_coords):
    # Calculates the area of a bounding box to help determine if a vehicle is getting closer (growing box) or farther (shrinking box)
    x1, y1, x2, y2 = box_coords
    return (x2 - x1) * (y2 - y1)

#Get all the polygons of the detected lines across the frames
#fit a curve to the lines and return the relative X position of the line at a given vechicle Y position.
def get_unified_line_x(lines_polygons, car_y):
    all_x = []
    all_y = []
    
    # collect all points from the detected line polygons
    for poly in lines_polygons:
        all_x.extend(poly[:, 0])
        all_y.extend(poly[:, 1])
        
    # if there are less than 3 points, we can't fit a curve, so we just return the average X (or 0 if no points)
    if len(all_y) < 3:
        return np.mean(all_x) if all_x else 0
    
    # fit a 2nd degree polynomial (quadratic curve) to the points to get a smooth line representation
    curve_coefficients = np.polyfit(all_y, all_x, 2)
    #if the car is farest then the farest detected line we ignored
    min_line_y = min([point[1] for poly in lines_polygons for point in poly])
    if car_y < min_line_y:
        return None
    # use the fitted curve to calculate the X position of the line at the target Y
    exact_line_x = np.polyval(curve_coefficients, car_y)
    
    
    return exact_line_x
    
#Pass all the history and extract the license plate with the best confidence score.
def extract_license_plate(history, batch_analysis, frames, lpr_model):
  print(f"\n🪪 [LPR] Starting extraction — {len(history['frames'])} history frames")
  best_conf = -1.0
  best_crop = None
  for i in range(len(history["frames"])):
        frame_idx = history["frames"][i]
        vehicle_coords = history["coords"][i]
        vx1, vy1, vx2, vy2 = map(int, vehicle_coords)
        all_detections = batch_analysis[frame_idx]["detections"]
        plate_dets_in_frame = [d for d in all_detections if d["class_name"] == "license_plate"]
        print(f"   Frame {frame_idx}: vehicle=({vx1},{vy1},{vx2},{vy2}) | plate detections={len(plate_dets_in_frame)}")
        for det in plate_dets_in_frame:
                px1, py1, px2, py2 = map(int, det["coordinates"])
                conf = det.get("confidence", 0)
                inside = px1 >= vx1 and py1 >= vy1 and px2 <= vx2 and py2 <= vy2
                print(f"      plate=({px1},{py1},{px2},{py2}) conf={conf:.2f} inside_vehicle={inside}")
                # Check if the license plate box is within the vehicle box (with some tolerance)
                if inside:
                    if conf > best_conf:
                        best_conf = conf
                        best_crop = frames[frame_idx][py1:py2, px1:px2]
  if best_crop is None:
        print("   ❌ No valid plate crop found (no plate inside any vehicle box)")
        return 'Unknown'
  if best_crop.size == 0:
        print("   ❌ Best crop is empty (zero-size array)")
        return 'Unknown'
  print(f"   ✅ Best crop size: {best_crop.shape}  conf={best_conf:.2f}")
  # Upscale small crops so the LPR model can read all digits
  min_height = 64
  if best_crop.shape[0] < min_height:
        scale = min_height / best_crop.shape[0]
        new_w = int(best_crop.shape[1] * scale)
        best_crop = cv2.resize(best_crop, (new_w, min_height), interpolation=cv2.INTER_CUBIC)
        print(f"   🔍 Upscaled crop to {best_crop.shape}")
  try:
            # Run our custom trained YOLO model on the cropped plate
            results = lpr_model(best_crop, verbose=False)

            if len(results) == 0 or len(results[0].boxes) == 0:
                print("   ❌ LPR model found no characters in the crop")
                return 'Unknown'

            boxes = results[0].boxes
            detections = []

            # Extract each digit and its X-center coordinate
            for box in boxes:
                x1, _, x2, _ = box.xyxy[0].tolist()
                cls_id = int(box.cls[0].item())
                char_name = lpr_model.names[cls_id]
                detections.append({
                    "char": char_name,
                    "x_center": (x1 + x2) / 2.0
                })

            #  Sort digits from left to right based on their X position!
            detections = sorted(detections, key=lambda d: d["x_center"])
            plate_text = "".join([str(d["char"]) for d in detections])

            # Clean the text to keep only digits
            clean_text = ''.join(filter(str.isdigit, plate_text))
            print(f"   🔡 Raw LPR output: '{plate_text}'  →  digits only: '{clean_text}' (len={len(clean_text)})")

            if clean_text and len(clean_text) in [7, 8]:  # Assuming license plates have 7 or 8 digits
                return clean_text
            print(f"   ⚠️  Digit count {len(clean_text)} not in [7,8] — returning Unknown")
  except Exception as e:
            print(f"   ❌ LPR Model Error: {e}")

  return 'Unknown'  # Failed to extract a valid plate number