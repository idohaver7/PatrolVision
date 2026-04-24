# --- 🚌 BUS LANE DETECTION LOGIC ---
import numpy as np
import time
from utils import get_unified_line_x, extract_license_plate, get_center_bottom, is_far, prune_old_entries, should_report_violation
CLEANING_TIME_SECONDS = 60
CLEANING_TIME_SECONDS_TAXI = 600
CAR_HEIGHT_THRESHOLD = 0.2  # Minimum height in pixels to consider a detection as a car (to filter out small objects and false positives)
#Memory to avoid reporting the same vehicle multiple times
reported_violators = {}  # track_id -> timestamp
reported_plates = {}     # license_plate -> timestamp (second-line dedup if tracker drops a car and re-acquires it with a new ID)
known_taxis = {}
def is_taxi(car_coords, taxi_hats):
    cx1, cy1, cx2, cy2 = car_coords
    car_height = cy2 - cy1
    
    for hx1, hy1, hx2, hy2 in taxi_hats:
        hat_center_x = (hx1 + hx2) / 2.0
        hat_center_y = (hy1 + hy2) / 2.0
        
        is_x_match = cx1 <= hat_center_x <= cx2
        is_y_match = (cy1 - car_height * CAR_HEIGHT_THRESHOLD) <= hat_center_y <= ((cy1 + cy2) / 2.0)
        
        if is_x_match and is_y_match:
            return True
            
    return False
def detect_bus_line_violation(batch_analysis, frames, lpr_model, image_height=512):
    print("\n--- 🚌 DEBUG: STARTING BUS LANE LOGIC ---")
    vehicle_history = {} #Id History
    current_time = time.time()
    
    #Clean up old reported violators
    prune_old_entries(reported_violators, current_time, CLEANING_TIME_SECONDS)
    prune_old_entries(reported_plates, current_time, CLEANING_TIME_SECONDS)
    prune_old_entries(known_taxis, current_time, CLEANING_TIME_SECONDS_TAXI)
   

    # catch the history of each tracked vehicle across the frames
    for frame_data in batch_analysis:
        frame_idx = frame_data["frame_index"]
        # collect the polygons of the bus lines and dashed lines detected in this frame
        bus_lines = [
            np.array(det["coordinates"]) for det in frame_data["detections"] 
            if det["class_name"] == "bus line" and det["type"] == "polygon"
        ]
        dashed_lines = [
            np.array(det["coordinates"]) for det in frame_data["detections"]
            if det["class_name"] == "dashed_line" and det["type"] == "polygon"
        ]
        solid_lines = [
            np.array(det["coordinates"]) for det in frame_data["detections"]
            if det["class_name"] == "solid_line" and det["type"] == "polygon"
        ]
        taxi_hats = [
            det["coordinates"] for det in frame_data["detections"]
            if det["class_name"] == "taxi_hat" and det["type"] == "box"
        ]
        for det in frame_data["detections"]:
            if (det["class_name"] == "car" or det["class_name"] == "truck") and det.get("track_id", -1) != -1 and not is_far(det, image_height):
                track_id = det["track_id"]
                car_coords = det["coordinates"]
                has_hat_in_this_frame = is_taxi(car_coords, taxi_hats)
                
                if has_hat_in_this_frame:
                    known_taxis[track_id] = current_time  # Remember this ID as a taxi for future frames
            
                if track_id not in vehicle_history:
                    vehicle_history[track_id] = {"frames": [], "coords": [], "dashed_lines": [], "bus_lines": [], "solid_lines": []}
                vehicle_history[track_id]["frames"].append(frame_idx)
                vehicle_history[track_id]["coords"].append(car_coords)
                vehicle_history[track_id]["dashed_lines"].append(dashed_lines)
                vehicle_history[track_id]["bus_lines"].append(bus_lines)
                vehicle_history[track_id]["solid_lines"].append(solid_lines)
    print(f"🚗 Found {len(vehicle_history)} unique tracked vehicles (with IDs).")       
    # analyze the history of each vehicle to detect violations
    for track_id, history in vehicle_history.items():
        if track_id in known_taxis:
            print(f"   🚕 SKIP: Vehicle ID {track_id} identified as a taxi (detected hat).")
            known_taxis[track_id] = current_time  # Update the timestamp to extend the memory
            continue
        violation_count = 0
        total_frames_checked = 0
        last_frame_idx = None
        print(f"\n🔍 Checking Vehicle ID: {track_id} (Appeared in {len(history['frames'])} frames)")
        # Run all over the frames of this vehicle
        for frame_idx, coords, bus_lines, dashed_lines, solid_lines in zip(history["frames"], history["coords"], history["bus_lines"], history["dashed_lines"], history["solid_lines"]):
            total_frames_checked += 1
            # if there are no bus lines in this frame, we can't check for violation, so we skip it
            if len(bus_lines) == 0:
                continue    
#---------------------------Bus lane Logic:-------------------------------------
            car_bottom_x = get_center_bottom(coords)[0]
            car_bottom_y = get_center_bottom(coords)[1]

            #we find the x coordinate of the bus lane line at the height of the car
            bus_line_x = get_unified_line_x(bus_lines, car_bottom_y)
            if bus_line_x is None:
                print(f"   ⚠️ Frame {frame_idx}: Car is beyond the farthest detected bus line. Skipping this frame for violation check.")
                continue
            
            
            bus_lane_side = "right" # default assumption
            
            if len(dashed_lines) > 0:
                #we find the x coordinate of the dashed line at the same height of the bus line
                dashed_line_x = get_unified_line_x(dashed_lines, car_bottom_y)
                
                # determine the side of the bus lane based on the relative position of the bus line and the dashed line
                if bus_line_x > dashed_line_x:
                    bus_lane_side = "right"
                else:
                    bus_lane_side = "left"
            
            # Reject cars separated from the bus line by another lane divider — they're in a
            # different lane, not the bus lane. Check each dashed/solid polygon individually
            # (unifying them would average lanes together and hide the separation).
            separator_polygons = list(dashed_lines) + list(solid_lines)
            low_x = min(car_bottom_x, bus_line_x)
            high_x = max(car_bottom_x, bus_line_x)
            separator_between = False
            for sep_poly in separator_polygons:
                sep_x = get_unified_line_x([sep_poly], car_bottom_y)
                if sep_x is None:
                    continue
                if low_x < sep_x < high_x:
                    separator_between = True
                    break

            if separator_between:
                print(f"   ↔️ Frame {frame_idx}: A lane divider sits between car and bus line. Not in bus lane.")
                continue

            # the check if the car is driving in the bus lane
            if bus_lane_side == "right" and car_bottom_x > bus_line_x:
                violation_count += 1
                last_frame_idx = frame_idx
            elif bus_lane_side == "left" and car_bottom_x < bus_line_x:
                last_frame_idx = frame_idx
                violation_count += 1
                
        # determine based on the number of frames with violation if this vehicle is violating the bus lane rule
        if total_frames_checked > 0 and violation_count >= (total_frames_checked / 2.0):
            
            plate_text = extract_license_plate(history, batch_analysis, frames, lpr_model)
            if not should_report_violation(track_id, plate_text, current_time, reported_violators, reported_plates):
                continue
            print(f"   🏆 >>> BUS LANE VIOLATION CONFIRMED FOR ID {track_id} (plate={plate_text or 'N/A'}) <<<")

            return {
                "violation": True,
                "type": "Public Lane Violation",
                "track_id": track_id,
                "vehicle_coords": history["coords"][-1],
                "license_plate": plate_text,
                "last_violation_frame": last_frame_idx
            }

    print("✅ No valid bus lane violations found in this batch.")
    return {"violation": False}