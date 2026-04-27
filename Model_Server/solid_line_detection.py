#--- 🕵️ SOLID LINE CROSSING DETECTION LOGIC ---
import numpy as np
import time
from utils import get_center_bottom, get_box_area, get_unified_line_x, extract_license_plate, is_far, prune_old_entries, should_report_violation
AREA_THRESHOLD = 1.2
Y_MOVEMENT_THRESHOLD = 15
PASSING_DISTANCE_THRESHOLD = 0.2
CLEANING_TIME_SECONDS = 60  
reported_violators = {}  # track_id -> timestamp
reported_plates = {}     # license_plate -> timestamp (second-line dedup if tracker drops a car and re-acquires it with a new ID)
# Queue of confirmed violations waiting to be returned (one per call).
# Plate is already resolved at queue time, so each entry is a ready-to-return result dict.
_pending_violations = []
#solid line crossing violation detection logic:
def detect_solid_line_violation(batch_analysis, frames, lpr_model, image_height=512):
    print("\n--- 🕵️ DEBUG: STARTING SOLID LINE LOGIC ---")

    # ── Return pending violations from previous batches first ─────────────
    if _pending_violations:
        pv = _pending_violations.pop(0)
        print(f"📋 Returning pending solid line violation for ID {pv['track_id']} (queue size: {len(_pending_violations)})")
        return pv

    #collect the history of each tracked vehicle across the frames
    vehicle_history = {} # Id History
    current_time = time.time()
    #clan up repored violators that were reported more than 1 minutes ago
    prune_old_entries(reported_violators, current_time, CLEANING_TIME_SECONDS)
    prune_old_entries(reported_plates, current_time, CLEANING_TIME_SECONDS)
        
    
    for frame_data in batch_analysis:
        frame_idx = frame_data["frame_index"]
        
        # collect the polygons of the solid lines detected in this frame
        lines_in_frame = [
            np.array(det["coordinates"]) for det in frame_data["detections"] 
            if det["class_name"] == "solid_line" and det["type"] == "polygon"
        ]
        
        for det in frame_data["detections"]:
            if (det["class_name"] == "car" or det["class_name"] == "bus" or det["class_name"] == "truck") and det.get("track_id", -1) != -1 and not is_far(det, image_height):
                track_id = det["track_id"]
                
                if track_id not in vehicle_history:
                    vehicle_history[track_id] = {"frames": [], "coords": [], "lines": []}
                
                vehicle_history[track_id]["frames"].append(frame_idx)
                vehicle_history[track_id]["coords"].append(det["coordinates"])
                vehicle_history[track_id]["lines"].append(lines_in_frame)
    print(f"🚗 Found {len(vehicle_history)} unique tracked vehicles (with IDs).")
    confirmed = []
    #analayze the history of each vechicle to detect violations
    for track_id, history in vehicle_history.items():
        print(f"\n🔍 Checking Vehicle ID: {track_id} (Appeared in {len(history['frames'])} frames)")
        # we ignore vehicles that appear in 1 frames since we can't determine movement direction
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
    
        if y_movement > Y_MOVEMENT_THRESHOLD and area_growth > AREA_THRESHOLD:
            print("   ⛔ Skipped: Identified as oncoming traffic (Counter-flow).")
            continue 
            
        #search violation in all frames
        violation_count = 0
        total_frames_checked = 0
        last_frame_idx = 0
        
        for i in range(len(history["frames"])):
            current_coords = history["coords"][i]
            current_lines = history["lines"][i]
            total_frames_checked += 1
            
            if not current_lines:
                print(f"   ⚠️ Frame {history['frames'][i]}: No solid line found to compare against.")
                continue 
                
            car_x, car_y = get_center_bottom(current_coords)
            exact_line_x = get_unified_line_x(current_lines, car_y)
            if exact_line_x is None:
                print(f"   ⚠️ Frame {history['frames'][i]}: Car is beyond the farthest detected line. Skipping this frame for violation check.")
                continue
            # if the vechiele is left to the line its violation
            if car_x + PASSING_DISTANCE_THRESHOLD < exact_line_x:
                print("      🚨 CROSSING DETECTED IN THIS FRAME!")
                violation_count += 1
                last_frame_idx = history["frames"][i]
        print(f"   ⚖️ Final Vote: {violation_count}/{total_frames_checked} frames with violation.")        
        # check if majority of the frames show violation to reduce false positives.
        if total_frames_checked > 0 and violation_count > (total_frames_checked / 2):
            # check if this violator was already reported in the last 1 minute to avoid duplicates
            license_plate = extract_license_plate(history, batch_analysis, frames, lpr_model)
            if not should_report_violation(track_id, license_plate, current_time, reported_violators, reported_plates):
                continue
            print(f"   🏆 >>> VIOLATION CONFIRMED FOR ID {track_id} (plate={license_plate or 'N/A'}) <<<")
            confirmed.append({
                "violation": True,
                "type": "Illegal Overtaking",
                "license_plate": license_plate,
                "last_violation_frame": last_frame_idx,
                "track_id": track_id,
                "vehicle_coords": end_coords,
                "confidence_score": f"{violation_count}/{total_frames_checked} frames"
            })

    if not confirmed:
        print("✅ No valid violations found in this batch.")
        return {"violation": False}

    # Return the first violation now; queue the rest for subsequent calls
    first = confirmed[0]
    for extra in confirmed[1:]:
        _pending_violations.append(extra)
        print(f"📋 Queued solid line violation for ID {extra['track_id']} (pending: {len(_pending_violations)})")
    return first