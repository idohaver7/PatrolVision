import numpy as np
import time
from utils import get_center_bottom, get_box_area, get_unified_line_x, extract_license_plate
area_threshold = 1.2
y_movement_threshold = 15
passing_distance_threshold = 0.2
reported_violators = {}  # To keep track of already reported violations and avoid duplicates
#solid line crossing violation detection logic:
def detect_solid_line_violation(batch_analysis,frames,ocr_reader):
    print("\n--- 🕵️ DEBUG: STARTING SOLID LINE LOGIC ---")
    #collect the history of each tracked vehicle across the frames
    vehicle_history = {}
    current_time = time.time()
    #clan up repored violators that were reported more than 1 minutes ago
    keys_to_remove = [k for k, v in reported_violators.items() if current_time - v > 60]
    for k in keys_to_remove:
        del reported_violators[k]
        
    
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
            # check if this violator was already reported in the last 1 minute to avoid duplicates
            if track_id in reported_violators:
                reported_violators[track_id] = current_time  # Update the timestamp to extend the cooldown
                print(f"   ⏩ Skipped: Violation for ID {track_id} was already reported recently.")
                continue
            reported_violators[track_id] = current_time  # Mark this violator as reported
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