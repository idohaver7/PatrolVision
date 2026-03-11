import numpy as np


area_threshold = 1.2
y_movement_threshold = 15
passing_distance_threshold = 0.2

#------Functions to analyze the batch of frames and detect solid line crossing violations.-----



def get_center_bottom(box_coords):    
    x1, y1, x2, y2 = box_coords
    center_x = (x1 + x2) / 2.0
    center_y = y2  #center bottom is at the bottom edge of the box
    return center_x, center_y

def get_box_area(box_coords):
    # Calculates the area of a bounding box to help determine if a vehicle is getting closer (growing box) or farther (shrinking box)
    x1, y1, x2, y2 = box_coords
    return (x2 - x1) * (y2 - y1)
#Get all the polygons of the detected solid lines across the frames
#fit a curve to the solid lines and return the relative X position of the line at a given vechicle Y position.
def get_unified_line_x(solid_lines_polygons, target_y):
    all_x = []
    all_y = []
    
    # collect all points from the detected solid line polygons
    for poly in solid_lines_polygons:
        all_x.extend(poly[:, 0])
        all_y.extend(poly[:, 1])
        
    # if there are less than 3 points, we can't fit a curve, so we just return the average X (or 0 if no points)
    if len(all_y) < 3:
        return np.mean(all_x) if all_x else 0
    
    # fit a 2nd degree polynomial (quadratic curve) to the points to get a smooth line representation
    curve_coefficients = np.polyfit(all_y, all_x, 2)
    
    # use the fitted curve to calculate the X position of the line at the target Y
    exact_line_x = np.polyval(curve_coefficients, target_y)
    
    return exact_line_x
    
#Pass all the history and extract the license plate with the best confidence score.
def extract_license_plate(history, batch_analysis, frames,ocr_reader):
  best_conf = -1.0
  best_crop = None  
  for i in range(len(history["frames"])):
        frame_idx = history["frames"][i]
        vehicle_coords = history["coords"][i]
        vx1, vy1, vx2, vy2 = map(int, vehicle_coords)
        all_detections = batch_analysis[frame_idx]["detections"]
        for det in all_detections:
            if det["class_name"] in ["license_plate"]:
                px1, py1, px2, py2 = map(int, det["coordinates"])
                conf = det.get("confidence", 0)
                # Check if the license plate box is within the vehicle box (with some tolerance)
                if px1 >= vx1 and py1 >= vy1 and px2 <= vx2 and py2 <= vy2:
                    if conf > best_conf:
                        best_conf = conf
                        best_crop = frames[frame_idx][py1:py2, px1:px2]
  if best_crop is not None:
        #gray_crop = cv2.cvtColor(best_crop, cv2.COLOR_BGR2GRAY)
        ocr_results = ocr_reader.readtext(best_crop,allowlist='0123456789')
        plate_text = "".join([res[1] for res in ocr_results])
        clean_text = ''.join(filter(str.isdigit, plate_text))
        if clean_text and len(clean_text) in [7,8]:  # Assuming license plates have 7 or 8 digits
            return clean_text 
        else:
            return 'Unknown'  # OCR failed to extract a valid plate number
        
  return None    
#solid line crossing violation detection logic:
def detect_solid_line_violation(batch_analysis,frames,ocr_reader):
    print("\n--- 🕵️ DEBUG: STARTING SOLID LINE LOGIC ---")
    #collect the history of each tracked vehicle across the frames
    vehicle_history = {}
    
    for frame_data in batch_analysis:
        frame_idx = frame_data["frame_index"]
        
        # collect the polygons of the solid lines detected in this frame
        lines_in_frame = [
            np.array(det["coordinates"]) for det in frame_data["detections"] 
            if det["class_name"] == "solid_line" and det["type"] == "polygon"
        ]
        
        for det in frame_data["detections"]:
            if det["type"] == "box" and det.get("track_id", -1) != -1:
                track_id = det["track_id"]
                
                if track_id not in vehicle_history:
                    vehicle_history[track_id] = {"frames": [], "coords": [], "lines": []}
                
                vehicle_history[track_id]["frames"].append(frame_idx)
                vehicle_history[track_id]["coords"].append(det["coordinates"])
                vehicle_history[track_id]["lines"].append(lines_in_frame)
    print(f"🚗 Found {len(vehicle_history)} unique tracked vehicles (with IDs).")
    #analayze the history of each vechicle to detect violations
    for track_id, history in vehicle_history.items():
        print(f"\n🔍 Checking Vehicle ID: {track_id} (Appeared in {len(history['frames'])} frames)")
        # we ignore vehicles that appear in less than 2 frames since we can't determine movement direction
        if len(history["frames"]) < 2:
            print("   ⏩ Skipped: Vehicle appeared in less than 2 frames (Tracker lost it).")
            continue
            
        start_coords = history["coords"][0]
        end_coords = history["coords"][-1]
        
        start_x, start_y = get_center_bottom(start_coords)
        end_x, end_y = get_center_bottom(end_coords)
        start_area = get_box_area(start_coords)
        end_area = get_box_area(end_coords)
        
        
    #filtering based on movement direction and size change to reduce false positives of opposite direction cars.
    #cars that moving  downwards and getting closer are moving in the opposite direction.
        y_movement = end_y - start_y
        area_growth = end_area / start_area if start_area > 0 else 1

        print(f"   📏 Movement: dY={y_movement:.2f}, Area Growth={area_growth:.2f}")
    
        if y_movement > y_movement_threshold and area_growth > area_threshold:
            print("   ⛔ Skipped: Identified as oncoming traffic (Counter-flow).")
            continue 
            
        #search violation in all frames
        violation_count = 0
        total_frames_checked = 0
        last_frame_idx = 0
        
        for i in range(len(history["frames"])):
            current_coords = history["coords"][i]
            current_lines = history["lines"][i]
            
            if not current_lines:
                print(f"   ⚠️ Frame {history['frames'][i]}: No solid line found to compare against.")
                continue 
                
            car_x, car_y = get_center_bottom(current_coords)
            exact_line_x = get_unified_line_x(current_lines, car_y)
            total_frames_checked += 1
            
            # if the vechiele is left to the line its violation
            if car_x + passing_distance_threshold < exact_line_x:
                print("      🚨 CROSSING DETECTED IN THIS FRAME!")
                violation_count += 1
                last_frame_idx = i
        print(f"   ⚖️ Final Vote: {violation_count}/{total_frames_checked} frames with violation.")        
        # check if majority of the frames show violation to reduce false positives.
        if total_frames_checked > 0 and violation_count > (total_frames_checked / 2):
            print(f"   🏆 >>> VIOLATION CONFIRMED FOR ID {track_id} <<<")
            license_plate = extract_license_plate(history, batch_analysis,frames,ocr_reader)
            return {
                "violation": True,
                "type": "Illegal Overtaking",
                "license_plate": license_plate,
                "last_violation_frame": last_frame_idx,
                "track_id": track_id,
                "vehicle_coords": end_coords, 
                "confidence_score": f"{violation_count}/{total_frames_checked} frames"
            }
    print("✅ No valid violations found in this batch.")
    return {"violation": False}