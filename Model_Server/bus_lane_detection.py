# --- 🚌 BUS LANE DETECTION LOGIC ---
import numpy as np
import time
from utils import get_unified_line_x, extract_license_plate, get_center_bottom,is_far
CLEANING_TIME_SECONDS = 60
CLEANING_TIME_SECONDS_TAXI = 600
CAR_HEIGHT_THRESHOLD = 0.2  # Minimum height in pixels to consider a detection as a car (to filter out small objects and false positives)
#Memory to avoid reporting the same vehicle multiple times
reported_violators = {} 
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
    keys_to_remove = [k for k, v in reported_violators.items() if current_time - v > CLEANING_TIME_SECONDS]
    for k in keys_to_remove:
        del reported_violators[k]
    taxi_keys_to_remove = [k for k, v in known_taxis.items() if current_time - v > CLEANING_TIME_SECONDS_TAXI]
    for k in taxi_keys_to_remove:
        del known_taxis[k]
   

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
                    vehicle_history[track_id] = {"frames": [], "coords": [], "dashed_lines": [], "bus_lines": []}
                vehicle_history[track_id]["frames"].append(frame_idx)
                vehicle_history[track_id]["coords"].append(car_coords)
                vehicle_history[track_id]["dashed_lines"].append(dashed_lines)
                vehicle_history[track_id]["bus_lines"].append(bus_lines)
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
        for frame_idx, coords, bus_lines, dashed_lines in zip(history["frames"], history["coords"], history["bus_lines"], history["dashed_lines"]):
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
            
            # the check if the car is driving in the bus lane
            if bus_lane_side == "right" and car_bottom_x > bus_line_x:
                violation_count += 1
                last_frame_idx = frame_idx
            elif bus_lane_side == "left" and car_bottom_x < bus_line_x:
                last_frame_idx = frame_idx
                violation_count += 1
                
        # determine based on the number of frames with violation if this vehicle is violating the bus lane rule
        if total_frames_checked > 0 and violation_count >= (total_frames_checked / 2.0):
            
            if track_id in reported_violators:
                print(f"   ♻️ SKIP: Bus lane violation already reported for ID {track_id}.")
                reported_violators[track_id] = current_time  # Update the timestamp to extend the memory
                continue
                
            reported_violators[track_id] = current_time
            print(f"   🏆 >>> BUS LANE VIOLATION CONFIRMED FOR ID {track_id} <<<")
            
            plate_text = extract_license_plate(history, batch_analysis, frames, lpr_model)
            
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