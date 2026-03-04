import cv2
import numpy as np
from ultralytics import YOLO
import math

# --- CONFIGURATION (Must match app.py) ---
IMAGE_PATH = "6.png"  # Ensure this matches your image filename
MODEL_PATH = "traffic_model.pt"
LANE_SIDE = 'right'      
MIN_VEHICLE_AREA = 4000  
MAX_LANE_DIST = 500      
RED_LIGHT_TOLERANCE = 30

# --- HELPER FUNCTIONS (Copied from your app.py) ---

def get_center(box):
    cx = (box[0] + box[2]) / 2
    cy = (box[1] + box[3]) / 2
    return cx, cy

def is_center_inside(center, target_box):
    cx, cy = center
    tx1, ty1, tx2, ty2 = target_box
    return (tx1 < cx < tx2) and (ty1 < cy < ty2)

def calculate_distance(p1, p2):
    return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

def is_vehicle_relevant(box, min_area):
    width = box[2] - box[0]
    height = box[3] - box[1]
    return (width * height) > min_area

# --- LOGIC FUNCTIONS (Copied & Adapted for Visual Debugging) ---

def find_active_red_lines_debug(stop_lines, red_lights, green_lights, img):
    """
    Debug version of find_active_red_lines.
    Draws connections and distances on the image.
    """
    active_lines = []
    
    print("\n--- DEBUG: Checking Stop Lines for Red Lights ---")

    for i, line in enumerate(stop_lines):
        l_center = get_center(line)
        lx1, ly1, lx2, ly2 = map(int, line)
        
        # Draw the line ID
        cv2.putText(img, f"Line {i}", (lx1, ly1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)

        closest_red_dist = float('inf')
        closest_green_dist = float('inf')
        closest_red_box = None
        
        # Check Red Lights
        for red in red_lights:
            r_center = get_center(red)
            dist = calculate_distance(l_center, r_center)
            if dist < closest_red_dist:
                closest_red_dist = dist
                closest_red_box = red
        
        # Check Green Lights
        for green in green_lights:
            g_center = get_center(green)
            dist = calculate_distance(l_center, g_center)
            if dist < closest_green_dist:
                closest_green_dist = dist
        
        print(f"   Line {i}: Dist to Red={closest_red_dist:.1f}, Dist to Green={closest_green_dist:.1f}")

        # VISUALIZATION: Draw line to closest red light
        if closest_red_box is not None:
             rx, ry = map(int, get_center(closest_red_box))
             # Draw gray line for distance visualization
             cv2.line(img, (int(l_center[0]), int(l_center[1])), (rx, ry), (150, 150, 150), 1)
             cv2.putText(img, f"{int(closest_red_dist)}px", (int((l_center[0]+rx)/2), int((l_center[1]+ry)/2)), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)

        # LOGIC CHECK (Matches app.py)
        if min(closest_red_dist, closest_green_dist) > 400:
            print(f"   -> REJECTED: Too far from any light (>400px)")
            cv2.putText(img, "TOO FAR", (lx1, ly1+20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
            continue

        if closest_red_dist < closest_green_dist:
            print(f"   -> ACTIVE RED! (Red is closer)")
            active_lines.append(line)
            # Draw GREEN connection line to indicate active association
            if closest_red_box is not None:
                rx, ry = map(int, get_center(closest_red_box))
                cv2.line(img, (int(l_center[0]), int(l_center[1])), (rx, ry), (0, 255, 0), 2)
        else:
            print(f"   -> INACTIVE (Green is closer or equal)")

    return active_lines

def check_red_light_violation_debug(vehicle, active_red_lines, img):
    """
    Debug version of check_red_light_violation.
    Draws crossing calculations on the image.
    """
    vx1, vy1, vx2, vy2 = map(int, vehicle)
    v_bottom = vy2 
    v_center_x = (vx1 + vx2) / 2
    
    # Draw vehicle bottom point
    cv2.circle(img, (int(v_center_x), v_bottom), 5, (255, 0, 255), -1)

    for line in active_red_lines:
        lx1, ly1, lx2, ly2 = map(int, line)
        l_center_y = (ly1 + ly2) / 2
        l_min_x, l_max_x = min(lx1, lx2), max(lx1, lx2)
        
        # 1. Horizontal Check
        is_in_lane = (l_min_x - 20 < v_center_x < l_max_x + 20)
        
        if not is_in_lane:
            continue

        # 2. Crossing Check
        distance_past_line = l_center_y - v_bottom
        
        print(f"   🚗 Vehicle Check vs Active Line:")
        print(f"      - Line Y: {l_center_y:.1f}")
        print(f"      - Vehicle Bottom Y: {v_bottom}")
        print(f"      - Distance Past Line: {distance_past_line:.1f} (Threshold: {RED_LIGHT_TOLERANCE})")

        if distance_past_line > RED_LIGHT_TOLERANCE:
            print("      🚨 VIOLATION CONFIRMED!")
            # Draw violation box
            cv2.rectangle(img, (vx1, vy1), (vx2, vy2), (0, 0, 255), 3)
            cv2.putText(img, "RED LIGHT VIOLATION", (vx1, vy1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            return True, line
        else:
             print("      ❌ Not crossed enough.")
             cv2.putText(img, f"Diff: {int(distance_past_line)}", (vx1, vy2+20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
            
    return False, None

# --- MAIN DEBUG RUNNER ---

def run_debug():
    print(f"🔍 Loading model: {MODEL_PATH}...")
    try:
        model = YOLO(MODEL_PATH)
    except Exception as e:
        print(f"❌ Failed to load model. Error: {e}")
        return

    print(f"📸 Loading image: {IMAGE_PATH}...")
    img = cv2.imread(IMAGE_PATH)
    if img is None:
        print("❌ Image not found!")
        return

    height, width, _ = img.shape
    
    # 1. Run Detection
    print("🚀 Running YOLO inference...")
    results = model(img, conf=0.25)
    
    # 2. Map Objects (Same structure as app.py)
    detected_objects = {
        "cars": [], "buses": [], "trucks": [],
        "solid_lines": [], "bus_lines": [], "stop_lines": [],
        "red_lights": [], "green_lights": [],
        "taxi_hats": [], "license_plates": []
    }

    for result in results:
        for box in result.boxes:
            class_id = int(box.cls[0])
            class_name = model.names[class_id] 
            coords = box.xyxy[0].tolist()
            
            # Visualization: Draw ALL detected boxes first
            x1, y1, x2, y2 = map(int, coords)
            cv2.rectangle(img, (x1, y1), (x2, y2), (255, 255, 255), 1)
            cv2.putText(img, class_name, (x1, y1-5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

            if class_name == "car": detected_objects["cars"].append(coords)
            elif class_name == "bus": detected_objects["buses"].append(coords)
            elif class_name == "truck": detected_objects["trucks"].append(coords)
            elif class_name == "solid_line": detected_objects["solid_lines"].append(coords)
            elif class_name in ["bus_line", "bus line"]: detected_objects["bus_lines"].append(coords)
            elif class_name == "stop_line": detected_objects["stop_lines"].append(coords)
            elif class_name == "traffic_light_red": detected_objects["red_lights"].append(coords)
            elif class_name == "traffic_light_green": detected_objects["green_lights"].append(coords)
            elif class_name == "taxi_hat": detected_objects["taxi_hats"].append(coords)
            elif class_name in ["license_plate", "license plate"]: detected_objects["license_plates"].append(coords)

    # Filter vehicles (Same as app.py)
    detected_objects["cars"] = [box for box in detected_objects["cars"] if is_vehicle_relevant(box, MIN_VEHICLE_AREA)]
    detected_objects["trucks"] = [box for box in detected_objects["trucks"] if is_vehicle_relevant(box, MIN_VEHICLE_AREA)]
    
    private_vehicles = detected_objects["cars"] + detected_objects["trucks"]
    all_vehicles = private_vehicles + detected_objects["buses"]

    print(f"📊 Stats: {len(all_vehicles)} relevant vehicles, {len(detected_objects['stop_lines'])} stop lines, {len(detected_objects['red_lights'])} red lights.")

    # --- DEBUGGING RULE 3: Red Light (Matches app.py logic) ---
    
    # 1. Find Active Red Lines
    active_lines = find_active_red_lines_debug(
        detected_objects["stop_lines"], 
        detected_objects["red_lights"], 
        detected_objects["green_lights"],
        img
    )
    
    violation_detected = False
    
    if len(active_lines) > 0:
        print(f"\n✅ Found {len(active_lines)} active red lines. Checking vehicles...")
        for vehicle in all_vehicles:
            is_violation, line_crossed = check_red_light_violation_debug(vehicle, active_lines, img)
            
            if is_violation:
                violation_detected = True
                print("🚨 VIOLATION DETECTED in Debug!")
    else:
        print("\n⚠️ No active red lines found (either no red lights, or they are too far).")

    # Save Result
    output_filename = "debug_result.jpg"
    cv2.imwrite(output_filename, img)
    print(f"\n💾 Saved visualization to: {output_filename}")

if __name__ == "__main__":
    run_debug()