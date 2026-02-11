from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
from ultralytics import YOLO
import easyocr
import re
import time
import os

app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
LANE_SIDE = 'right'      
MIN_VEHICLE_AREA = 4000  
MAX_LANE_DIST = 500      # הערך המעודכן שעובד לך

# --- LOAD MODELS ---
try:
    print("⏳ Loading YOLO model...")
    model = YOLO("traffic_model.pt")
    print("✅ YOLO model loaded!")
    
    print("⏳ Loading OCR model (this might take a moment)...")
    # טוענים רק אנגלית כי לוחיות רישוי הן מספרים (שנחשבים אנגלית ב-OCR)
    reader = easyocr.Reader(['en'], gpu=False) 
    print("✅ OCR model loaded!")
except Exception as e:
    print(f"❌ Error loading models: {e}")

# --- HELPER FUNCTIONS ---

def get_center(box):
    cx = (box[0] + box[2]) / 2
    cy = (box[1] + box[3]) / 2
    return cx, cy

def is_center_inside(center, target_box):
    cx, cy = center
    tx1, ty1, tx2, ty2 = target_box
    return (tx1 < cx < tx2) and (ty1 < cy < ty2)

def calculate_intersection_ratio(box1, box2):
    """
    מחשב כמה אחוז מהשטח של התיבה הקטנה (הקו) מוכל בתוך התיבה הגדולה (הרכב)
    או פשוט בודק אם יש מגע משמעותי
    """
    xA = max(box1[0], box2[0])
    yA = max(box1[1], box2[1])
    xB = min(box1[2], box2[2])
    yB = min(box1[3], box2[3])

    # חישוב שטח החיתוך
    interArea = max(0, xB - xA + 1) * max(0, yB - yA + 1)
    
    # אם אין חיתוך בכלל
    if interArea == 0: return 0

    # נחשב את היחס ביחס לגודל הקו (box2 בדוגמה שלנו יהיה הקו)
    box2Area = (box2[2] - box2[0] + 1) * (box2[3] - box2[1] + 1)
    
    return interArea / float(box2Area)

def is_past_line(vehicle_box, line_box):
    return vehicle_box[3] < line_box[3]

def is_vehicle_relevant(box, min_area):
    width = box[2] - box[0]
    height = box[3] - box[1]
    return (width * height) > min_area

def find_closest_light_color(vehicle_box, red_lights, green_lights):
    v_cx, v_cy = get_center(vehicle_box)
    closest_distance = float('inf')
    closest_color = None
    
    for light in red_lights:
        l_cx, l_cy = get_center(light)
        dist = abs(v_cx - l_cx)
        if dist < closest_distance:
            closest_distance = dist
            closest_color = 'red'

    for light in green_lights:
        l_cx, l_cy = get_center(light)
        dist = abs(v_cx - l_cx)
        if dist < closest_distance:
            closest_distance = dist
            closest_color = 'green'
            
    if closest_distance > 500: return None
    return closest_color

# --- OCR FUNCTION ---
def read_license_plate(img, plate_box):
    x1, y1, x2, y2 = map(int, plate_box)
    h, w, _ = img.shape
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    
    plate_img = img[y1:y2, x1:x2]
    
    try:
        results = reader.readtext(plate_img, detail=0)
        full_text = "".join(results)
        clean_number = re.sub(r'[^0-9]', '', full_text)
        
        if 5 <= len(clean_number) <= 8:
            return clean_number
        else:
            return None 
    except Exception:
        return None
# --- LOGIC ---
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
    violation_detected = False
    violation_type = None
    details = None
    
    if 'frame' not in request.files:
        return jsonify({"error": "No frame provided"}), 400

    file = request.files['frame']
    np_arr = np.frombuffer(file.read(), np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img is None:
        return jsonify({"error": "Invalid image"}), 400
    print(f"✅ Image received! Size: {img.shape}")
    
    height, width, _ = img.shape

    results = model(img, conf=0.25) 

    detected_objects = {
        "cars": [], "buses": [], "trucks": [],
        "solid_lines": [], "bus_lines": [], "stop_lines": [],
        "red_lights": [], "green_lights": [],
        "taxi_hats": [],
        "license_plates": [] # הוספנו רשימה ללוחיות
    }

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

    # סינון רכבים רחוקים
    detected_objects["cars"] = [box for box in detected_objects["cars"] if is_vehicle_relevant(box, MIN_VEHICLE_AREA)]
    detected_objects["trucks"] = [box for box in detected_objects["trucks"] if is_vehicle_relevant(box, MIN_VEHICLE_AREA)]

    violation_detected = False
    violation_type = None
    violation_data = {} 
    
    private_vehicles = detected_objects["cars"] + detected_objects["trucks"]
    all_vehicles = private_vehicles + detected_objects["buses"]

    # פונקציית עזר למציאת לוחית של רכב ספציפי
    def find_plate_text_for_vehicle(vehicle_box):
        # מחפש לוחית שנמצאת פיזית בתוך הריבוע של הרכב
        for plate in detected_objects["license_plates"]:
            plate_center = get_center(plate)
            if is_center_inside(plate_center, vehicle_box):
                # מצאנו לוחית ששייכת לרכב הזה! נשלח ל-OCR
                return read_license_plate(img, plate)
        return None

   # --- RULE 1: Solid Line (STATE + CROSSING DETECTION) ---
    if not violation_detected:
        for vehicle in all_vehicles:
            vx1, vy1, vx2, vy2 = vehicle
            v_center_x, v_center_y = get_center(vehicle)
            v_width = vx2 - vx1
            
            for line in detected_objects["solid_lines"]:
                lx1, ly1, lx2, ly2 = line
                l_center_x = (lx1 + lx2) / 2
                l_center_y = (ly1 + ly2) / 2
                
                # בדיקה מקדימה: האם הקו בכלל רלוונטי לרכב הזה? (נמצא לידו בגובה)
                if abs(l_center_y - v_center_y) > (height * 0.2):
                    continue

                # 1. חישוב חפיפה (למקרה שהוא דורס את הקו)
                ratio = calculate_intersection_ratio(vehicle, line)
                
                # 2. חישוב מרחק אופקי (למקרה שהוא כבר עבר את הקו)
                # חיובי אם הרכב משמאל לקו, שלילי אם מימין
                dist_x = l_center_x - v_center_x 
                
                # תנאי א': הרכב דורס את הקו (כמו מקודם)
                condition_touching = (ratio > 0.15)
                
                # תנאי ב': הרכב נמצא כולו משמאל לקו, אבל קרוב אליו (בנתיב הנגדי)
                # אנו מניחים שרוחב נתיב הוא בערך רוחב וחצי של רכב
                # אז אם הוא משמאל לקו, ומרחק המרכזים הוא לא עצום - הוא בנתיב הנגדי
                condition_left_side = (dist_x > 0) and (dist_x < v_width * 2.5)

                if condition_touching or condition_left_side:
                    
                    violation_detected = True
                    violation_type = "Illegal Overtaking (Solid Line)"
                    plate_num = find_plate_text_for_vehicle(vehicle)
                    violation_data = {"box": vehicle, "plate": plate_num}
                    
                    print(f"DEBUG: Solid Line Violation! Ratio: {ratio:.2f}, Dist: {dist_x:.1f}")
                    break
            if violation_detected: break
    # --- RULE 2: Bus Lane ---
    if not violation_detected:
        if len(detected_objects["bus_lines"]) > 0:
            for vehicle in private_vehicles:
                is_taxi = False
                for hat in detected_objects["taxi_hats"]:
                    if is_center_inside(get_center(hat), vehicle):
                        is_taxi = True
                        break
                if is_taxi: continue 

                is_violation, reason = check_bus_lane_violation(vehicle, detected_objects["bus_lines"], height)
                
                if is_violation:
                    violation_detected = True
                    violation_type = f"Public Lane Violation"
                    # שליחת הלוחית לזיהוי
                    plate_num = find_plate_text_for_vehicle(vehicle)
                    violation_data = {"box": vehicle, "plate": plate_num}
                    break

    # --- RULE 3: Red Light ---
    if not violation_detected:
        for vehicle in all_vehicles:
            for line in detected_objects["stop_lines"]:
                v_center = get_center(vehicle)
                is_crossing = is_center_inside(v_center, line) or is_past_line(vehicle, line)
                
                if is_crossing:
                    relevant_color = find_closest_light_color(vehicle, detected_objects["red_lights"], detected_objects["green_lights"])
                    if relevant_color == 'red':
                        violation_detected = True
                        violation_type = "Red Light Crossing"
                        plate_num = find_plate_text_for_vehicle(vehicle)
                        violation_data = {"box": vehicle, "plate": plate_num}
                        break
            if violation_detected: break

    if violation_detected:
        plate_str = violation_data.get('plate') if violation_data.get('plate') else "Unknown"
        print(f"⚠️ VIOLATION: {violation_type} | Plate: {plate_str}")
    else:
        print("✅ Clean frame")   
   
    return jsonify({
        "violation_detected": violation_detected,
        "type": violation_type,
        "details": violation_data
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=6000, debug=False)