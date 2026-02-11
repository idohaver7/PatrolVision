import cv2
import numpy as np
from ultralytics import YOLO

# --- הגדרות (חייבות להיות זהות ל-app.py) ---
MODEL_PATH = 'traffic_model.pt'
IMAGE_PATH = 'test.jpeg'  # שים פה את התמונה שלך
CONFIDENCE = 0.25
MIN_VEHICLE_AREA = 4000   
MAX_LANE_DIST = 500       
LANE_SIDE = 'right'       

# --- Helper Functions ---
def get_center(box):
    return (box[0] + box[2]) / 2, (box[1] + box[3]) / 2

def is_vehicle_relevant(box, min_area):
    width = box[2] - box[0]
    height = box[3] - box[1]
    area = width * height
    return area > min_area, area  # מחזיר גם את השטח לדיבוג

def debug_check_violation(img, vehicle_box, bus_lines, img_height):
    """
    גרסה ויזואלית של הלוגיקה - מציירת את החישובים על התמונה
    """
    vx1, vy1, vx2, vy2 = map(int, vehicle_box)
    v_center_x, v_center_y = get_center(vehicle_box)
    
    # 1. בדיקת קווים רלוונטיים בגובה
    relevant_lines = []
    for line in bus_lines:
        lx1, ly1, lx2, ly2 = map(int, line)
        l_center_y = (ly1 + ly2) / 2
        
        # ציור כל הקווים באפור דהוי
        cv2.rectangle(img, (lx1, ly1), (lx2, ly2), (100, 100, 100), 1)
        
        # אם הקו רלוונטי בגובה - נצבע אותו בצהוב
        if abs(l_center_y - v_center_y) < (img_height * 0.3): 
            relevant_lines.append(line)
            cv2.rectangle(img, (lx1, ly1), (lx2, ly2), (0, 255, 255), 2)
            # מותח קו בין הרכב לקו הרלוונטי
            cv2.line(img, (int(v_center_x), int(v_center_y)), (int((lx1+lx2)/2), int(l_center_y)), (0, 255, 255), 1)

    if not relevant_lines:
        return "No vertical match"

    # 2. חיפוש הקו הקרוב ביותר
    closest_dist = float('inf')
    found_line = False
    target_line = None

    for line in relevant_lines:
        lx1, ly1, lx2, ly2 = line
        l_center_x = (lx1 + lx2) / 2
        
        dist = v_center_x - l_center_x 
        
        if LANE_SIDE == 'right':
            if 0 < dist < closest_dist:
                closest_dist = dist
                found_line = True
                target_line = line
    
    # 3. הכרעה וציור נתונים
    if found_line:
        perspective_factor = vy2 / img_height
        dynamic_max_dist = MAX_LANE_DIST * perspective_factor
        dynamic_max_dist = max(dynamic_max_dist, 50)

        # נתונים להדפסה
        info_text = f"Dist:{int(closest_dist)} | Max:{int(dynamic_max_dist)}"
        
        # צבע לפי התוצאה
        if closest_dist < dynamic_max_dist:
            color = (0, 0, 255) # אדום - עבירה
            status = "VIOLATION"
        else:
            color = (0, 255, 0) # ירוק - רחוק מדי
            status = "Too Far Right"

        cv2.putText(img, status, (vx1, vy1 - 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        cv2.putText(img, info_text, (vx1, vy1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        # קו המחשה למרחק
        if target_line is not None:
             tl_center_x = int((target_line[0] + target_line[2]) / 2)
             tl_center_y = int((target_line[1] + target_line[3]) / 2)
             cv2.line(img, (int(v_center_x), int(v_center_y)), (tl_center_x, int(v_center_y)), color, 2)

        return status
            
    return "Left of lines"

# --- MAIN RUN ---
print("Running Deep Debug...")
model = YOLO(MODEL_PATH)
img = cv2.imread(IMAGE_PATH)
height, width, _ = img.shape
results = model.predict(img, conf=CONFIDENCE)[0]

bus_lines = []
cars = []

# איסוף
for box in results.boxes:
    name = model.names[int(box.cls[0])]
    coords = box.xyxy[0].cpu().numpy()
    
    if name in ['bus_line', 'bus line']:
        bus_lines.append(coords)
    elif name == 'car':
        cars.append(coords)

# עיבוד
for car in cars:
    x1, y1, x2, y2 = map(int, car)
    is_relevant, area = is_vehicle_relevant(car, MIN_VEHICLE_AREA)
    
    if not is_relevant:
        # רכב קטן מדי - נסמן באפור ונכתוב את הגודל
        cv2.rectangle(img, (x1, y1), (x2, y2), (100, 100, 100), 1)
        cv2.putText(img, f"Small: {int(area)}", (x1, y1-5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100,100,100), 1)
    else:
        # רכב רלוונטי - נבדוק לוגיקה
        cv2.rectangle(img, (x1, y1), (x2, y2), (255, 255, 255), 2)
        res = debug_check_violation(img, car, bus_lines, height)
        print(f"Vehicle Area: {int(area)} | Result: {res}")

cv2.imwrite("deep_debug.jpg", img)
print("Done. Open 'deep_debug.jpg' to see the numbers.")