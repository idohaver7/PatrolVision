from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
from ultralytics import YOLO
import easyocr
import re
import os
import math

app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
LANE_SIDE = 'right'      
MIN_VEHICLE_AREA = 4000  
MAX_LANE_DIST = 500      
RED_LIGHT_TOLERANCE = 0.04

# --- LOAD MODELS ---
try:
    print("⏳ Loading YOLO model...")
    model = YOLO("traffic_model.pt")
    print("✅ YOLO model loaded!")
    
    print("⏳ Loading OCR model (this might take a moment)...")
    # Load English only since license plates are alphanumeric
    reader = easyocr.Reader(['en'], gpu=False) 
    print("✅ OCR model loaded!")
except Exception as e:
    print(f"❌ Error loading models: {e}")

# --- HELPER FUNCTIONS ---

def get_center(box):
    cx = (box[0] + box[2]) / 2
    cy = (box[1] + box[3]) / 2
    return cx, cy
def calculate_intersection_ratio(box1, box2):
    """
    Calculates the intersection area ratio between two bounding boxes.
    Helps determine if a vehicle overlaps with a road line.
    """
    xA = max(box1[0], box2[0])
    yA = max(box1[1], box2[1])
    xB = min(box1[2], box2[2])
    yB = min(box1[3], box2[3])

    # Calculate intersection area
    interArea = max(0, xB - xA + 1) * max(0, yB - yA + 1)
    
    # If there is no intersection
    if interArea == 0: return 0

    # Calculate the ratio relative to the smaller box (the line)
    box2Area = (box2[2] - box2[0] + 1) * (box2[3] - box2[1] + 1)
    
    return interArea / float(box2Area)

def is_past_line(vehicle_box, line_box):
    return vehicle_box[3] < line_box[3]

def calculate_distance(p1, p2):
    return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

def is_vehicle_relevant(box, min_area):
    width = box[2] - box[0]
    height = box[3] - box[1]
    return (width * height) > min_area

# --- OCR FUNCTION ---
def read_license_plate(img, plate_box):
    x1, y1, x2, y2 = map(int, plate_box)
    h, w, _ = img.shape
    x1, y1 = max(0, x1-10), max(0, y1-10)
    x2, y2 = min(w, x2+10), min(h, y2+10)
    
    plate_img = img[y1:y2, x1:x2]
    # Save the cropped plate image for debugging
    debug_path = "plate_debug.jpg"
    cv2.imwrite(debug_path, plate_img)
    
    try:
        results = reader.readtext(plate_img, detail=0, paragraph=False,allowlist='0123456789')
        full_text = "".join(results)
        print(f"DEBUG OCR Raw text: {full_text}") # Check what EasyOCR actually saw
        clean_number = re.sub(r'[^0-9]', '', full_text)
        
        if 6 <= len(clean_number) <= 8:
            return clean_number
        if len(full_text) > 0:
            return f"Raw:{full_text}"
        return None 
    except Exception:
        return None

# --- LOGIC FUNCTIONS ---

def find_active_red_lines(stop_lines, red_lights, green_lights, img_height):
    """
    Identifies which stop lines are currently associated with a red traffic light.
    """
    active_lines = []
    
    # Use 80% of the image height instead of fixed pixels for dynamic scaling (e.g., mobile cameras)
    max_distance = img_height * 0.8 
    
    for line in stop_lines:
        l_center = get_center(line)
        closest_red_dist = float('inf')
        closest_green_dist = float('inf')
        
        for red in red_lights:
            dist = calculate_distance(l_center, get_center(red))
            if dist < closest_red_dist:
                closest_red_dist = dist
                
        for green in green_lights:
            dist = calculate_distance(l_center, get_center(green))
            if dist < closest_green_dist:
                closest_green_dist = dist
        
        # Filter out lines that are too far from any traffic light
        if closest_red_dist > max_distance and closest_green_dist > max_distance:
            continue

        # Condition: Red light is within range and not significantly farther than the green light
        if closest_red_dist < max_distance and closest_red_dist <= (closest_green_dist + 150):
            active_lines.append(line)
                
    return active_lines

def check_red_light_violation(vehicle, active_red_lines, img_height):
    """
    Checks if a vehicle has crossed an active red stop line.
    """
    vx1, vy1, vx2, vy2 = vehicle
    v_bottom = vy2 
    v_center_x = (vx1 + vx2) / 2
    
    tolerance= img_height * RED_LIGHT_TOLERANCE

    for line in active_red_lines:
        lx1, ly1, lx2, ly2 = line
        l_center_y = (ly1 + ly2) / 2
        l_min_x, l_max_x = min(lx1, lx2), max(lx1, lx2)

        # Ensure the vehicle is horizontally aligned with the stop line lane
        if not (l_min_x - 20 < v_center_x < l_max_x + 20):
            continue
        # Ensure the vehicle is vertically close enough to the line to be relevant and not a distant object
        if abs(v_bottom - l_center_y) > (img_height * 0.3):
            continue

        # Calculate vertical distance past the line (assuming perspective where lower Y means farther)
        distance_past_line = l_center_y - v_bottom 
        if distance_past_line > 0:
            print(f"🔍 Vehicle is physically PAST the line (Distance > 0)")
        else:
            print(f"⚪ Vehicle is still BEFORE the line (Distance <= 0)")

        if distance_past_line > tolerance:
            print(f"⚠️ VIOLATION CONFIRMED: {int(distance_past_line)} > {int(tolerance)}")
            return True, line
        else:
            print(f"✅ NO VIOLATION: Distance is within tolerance.")
        
            
    return False, None

def check_bus_lane_violation(vehicle_box, bus_lines, img_height):
    vx1, vy1, vx2, vy2 = vehicle_box
    v_center_x, v_center_y = get_center(vehicle_box)
    v_bottom_y = vy2 
    
    relevant_lines = []
    for line in bus_lines:
        lx1, ly1, lx2, ly2 = line
        l_center_y = (ly1 + ly2) / 2
        if abs(l_center_y - v_center_y) < (img_height * 0.3): 
            relevant_lines.append(line)
            
    if not relevant_lines:
        return False, "No lines nearby"

    closest_dist = float('inf')
    found_line = False

    for line in relevant_lines:
        lx1, ly1, lx2, ly2 = line
        l_center_x = (lx1 + lx2) / 2
        
        dist = v_center_x - l_center_x 
        
        if LANE_SIDE == 'right':
            if 0 < dist < closest_dist:
                closest_dist = dist
                found_line = True
    
    if found_line:
        perspective_factor = v_bottom_y / img_height
        dynamic_max_dist = MAX_LANE_DIST * perspective_factor
        dynamic_max_dist = max(dynamic_max_dist, 50)

        if closest_dist < dynamic_max_dist:
            return True, f"Violation detected (Dist: {int(closest_dist)})"
        else:
            return False, "Vehicle too far right"
            
    return False, "Vehicle is to the left of lines"

# ------------------------

@app.route('/analyze', methods=['POST'])
def analyze_frame():
    if 'frame' not in request.files:
        return jsonify({"error": "No frame provided"}), 400

    file = request.files['frame']
    np_arr = np.frombuffer(file.read(), np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR )
    
    if img is None:
        return jsonify({"error": "Invalid image"}), 400
    
    height, width, _ = img.shape

    # Run YOLO inference
    results = model(img, conf=0.25) 

    detected_objects = {
        "cars": [], "buses": [], "trucks": [],
        "solid_lines": [], "bus_lines": [], "stop_lines": [],
        "red_lights": [], "green_lights": [],
        "taxi_hats": [],
        "license_plates": [] 
    }

    # Parse detected bounding boxes
    for result in results:
        for box in result.boxes:
            class_id = int(box.cls[0])
            class_name = model.names[class_id] 
            coords = box.xyxy[0].tolist()

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

    # Filter out distant vehicles based on minimum area
    detected_objects["cars"] = [box for box in detected_objects["cars"] if is_vehicle_relevant(box, MIN_VEHICLE_AREA)]
    detected_objects["trucks"] = [box for box in detected_objects["trucks"] if is_vehicle_relevant(box, MIN_VEHICLE_AREA)]

    violation_detected = False
    violation_type = None
    violation_data = {} 
    
    private_vehicles = detected_objects["cars"] + detected_objects["trucks"]
    all_vehicles = private_vehicles + detected_objects["buses"]

    # Helper function to find a license plate within a specific vehicle's bounding box
    def find_plate_text_for_vehicle(vehicle_box):
        vx1, vy1, vx2, vy2 = map(int, vehicle_box)
        plates = detected_objects["license_plates"]
        
        # Debugging output to see how many plates are being analyzed for this vehicle
        if len(plates) > 0:
            print(f"\n🕵️ Analyzing {len(plates)} plates for vehicle at [{vx1}, {vy1}]")

        for i, plate in enumerate(plates):
            # Calculate how much of the plate overlaps with the vehicle bounding box
            ratio = calculate_intersection_ratio(vehicle_box, plate)
            
            print(f"  - Plate #{i} Overlap: {ratio:.4f}")

            #if the plate overlaps significantly with the vehicle, we consider it a match
            if ratio > 0.5:
                print(f"  ✅ MATCH! Ratio {ratio:.4f} is high enough. Sending to OCR...")
                return read_license_plate(img, plate)
        
        return None
    # --- RULE 1: Solid Line Violation ---
    if not violation_detected:
        for vehicle in all_vehicles:
            vx1, vy1, vx2, vy2 = vehicle
            v_center_x, v_center_y = get_center(vehicle)
            v_width = vx2 - vx1
            
            for line in detected_objects["solid_lines"]:
                lx1, ly1, lx2, ly2 = line
                l_center_x = (lx1 + lx2) / 2
                l_center_y = (ly1 + ly2) / 2
                
                # Pre-check: Ensure the line is vertically close to the vehicle
                if abs(l_center_y - v_center_y) > (height * 0.2):
                    continue

                # 1. Calculate overlap ratio (if the vehicle is driving directly over the line)
                ratio = calculate_intersection_ratio(vehicle, line)
                
                # 2. Calculate horizontal distance (positive = left of the line, negative = right of the line)
                dist_x = l_center_x - v_center_x 
                
                # Condition A: Vehicle overlaps the line significantly
                condition_touching = (ratio > 0.15)
                
                # Condition B: Vehicle is entirely to the left of the line, but within oncoming lane bounds
                condition_left_side = (dist_x > 0) and (dist_x < v_width * 2.5)

                if condition_touching or condition_left_side:
                    violation_detected = True
                    violation_type = "Illegal Overtaking"
                      #דיבוג------------------------------------------
                    try:
                        vx1, vy1, vx2, vy2 = map(int, vehicle)
                        
                        # חיתוך הרכב מהתמונה המקורית
                        # הרחבת השטח ב-20 פיקסלים כדי לראות את ההקשר
                        v_crop = img[max(0, vy1-20):min(height, vy2+20), max(0, vx1-20):min(width, vx2+20)].copy()
                        
                        # ציור הריבוע של ה-YOLO על הרכב המכריע
                        # כדי שנראה איזה ריבוע שימש לחישוב
                        cv2.rectangle(v_crop, (20, 20), (v_crop.shape[1]-20, v_crop.shape[0]-20), (0, 0, 255), 3)
                        
                        # שמירת קובץ הדיבאג
                        debug_vehicle_path = "vehicle_debug.jpg"
                        cv2.imwrite(debug_vehicle_path, v_crop)
                        print(f"🕵️ Saved violation vehicle debug image to: {debug_vehicle_path}")
                    except Exception as e:
                        print(f"❌ Failed to save debug image: {e}")
                    # ----------------------------------------------------
                    plate_num = find_plate_text_for_vehicle(vehicle)
                    violation_data = {"box": vehicle, "plate": plate_num}
                    break
            
            if violation_detected: break

    # --- RULE 2: Public Transport Lane Violation ---
    if not violation_detected:
        if len(detected_objects["bus_lines"]) > 0:
            for vehicle in private_vehicles:
                # Optimized Taxi Check
                is_taxi = False
                vx1, vy1, vx2, vy2 = vehicle
                
                # We expand the search area 20 pixels upwards to catch hats sitting on the roof
                for hat in detected_objects["taxi_hats"]:
                    hx, hy = get_center(hat)
                    # Check if hat center is inside vehicle OR slightly above it
                    if (vx1 < hx < vx2) and (vy1 - 30 < hy < vy2): 
                        is_taxi = True
                        break
                
                if is_taxi: 
                    print("🚖 Taxi detected in bus lane - Skipping violation check.")
                    continue 

                # Proceed with bus lane check for private cars
                is_violation, reason = check_bus_lane_violation(vehicle, detected_objects["bus_lines"], height)
                
                if is_violation:
                    violation_detected = True
                    violation_type = "Public Lane Violation"
                    plate_num = find_plate_text_for_vehicle(vehicle)
                    violation_data = {"box": vehicle, "plate": plate_num}
                    break

    # --- RULE 3: Red Light Violation ---
    if not violation_detected:
        # Identify active stop lines associated with red lights
        active_lines = find_active_red_lines(
            detected_objects["stop_lines"], 
            detected_objects["red_lights"], 
            detected_objects["green_lights"],
            height
        )
        
        if len(active_lines) > 0:
            for vehicle in all_vehicles:
                # Check if the vehicle crossed any of the active red lines
                is_violation, line_crossed = check_red_light_violation(vehicle, active_lines, height)
                
                if is_violation:
                    violation_detected = True
                    violation_type = "Red Light Violation"
                    #דיבוג------------------------------------------
                    try:
                        vx1, vy1, vx2, vy2 = map(int, vehicle)
                        
                        # חיתוך הרכב מהתמונה המקורית
                        # הרחבת השטח ב-20 פיקסלים כדי לראות את ההקשר
                        v_crop = img[max(0, vy1-20):min(height, vy2+20), max(0, vx1-20):min(width, vx2+20)].copy()
                        
                        # ציור הריבוע של ה-YOLO על הרכב המכריע
                        # כדי שנראה איזה ריבוע שימש לחישוב
                        cv2.rectangle(v_crop, (20, 20), (v_crop.shape[1]-20, v_crop.shape[0]-20), (0, 0, 255), 3)
                        
                        # שמירת קובץ הדיבאג
                        debug_vehicle_path = "vehicle_debug.jpg"
                        cv2.imwrite(debug_vehicle_path, v_crop)
                        print(f"🕵️ Saved violation vehicle debug image to: {debug_vehicle_path}")
                    except Exception as e:
                        print(f"❌ Failed to save debug image: {e}")
                    # ----------------------------------------------------
                    plate_num = find_plate_text_for_vehicle(vehicle)
                    violation_data = {"box": vehicle, "plate": plate_num, "line": line_crossed}
                    break
                
    # Logging the final result
    if violation_detected:
        plate_str = violation_data.get('plate') if violation_data.get('plate') else "Unknown"
        print(f"⚠️ VIOLATION DETECTED: {violation_type} | Plate: {plate_str}")
    else:
        print("✅ Clean frame") 
   
    return jsonify({
        "violation_detected": violation_detected,
        "type": violation_type,
        "details": violation_data
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=6000, debug=False)