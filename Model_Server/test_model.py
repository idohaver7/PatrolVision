from ultralytics import YOLO
import cv2
import numpy as np

def debug_segmentation_families_clear_text(model_path, image_path, conf_threshold=0.25):
    # 1. טעינת המודל
    try:
        model = YOLO(model_path)
    except Exception as e:
        print(f"❌ שגיאה בטעינת המודל: {e}")
        return
    
    # 2. הרצת הפרדיקציה
    results = model.predict(source=image_path, conf=conf_threshold, verbose=False)
    result = results[0]
    
    # טעינת התמונה המקורית
    img = cv2.imread(image_path)
    if img is None:
        print(f"❌ לא ניתן לטעון את התמונה בנתיב: {image_path}")
        return
        
    overlay = img.copy() # שכבה עבור השקיפות
    
    if result.masks is None:
        print("❌ לא נמצאו מסיכות סגמנטציה. וודא שהמודל הוא מודל -seg.")
        return

    # הגדרת צבעים לפי משפחות (BGR)
    FAMILIES = {
        'vehicles': (255, 0, 0),    # כחול (car, truck, bus)
        'lines': (0, 255, 0),       # ירוק (solid_line, stop_line, bus_line)
        'lights': (0, 0, 255),      # אדום (traffic_lights)
        'others': (0, 255, 255)     # צהוב (license_plate, taxi_hat)
    }

    print(f"🔍 מנתח {len(result.masks)} אובייקטים...")

    # הגדרות גופן משופרות
    font_face = cv2.FONT_HERSHEY_DUPLEX # גופן קריא יותר
    font_scale = 0.7                  # גודל הגופן (הגדלנו מ-0.5)
    text_thickness = 1                # עובי הטקסט הלבן
    outline_thickness = 3             # עובי ה"הילה" השחורה
    
    for i, mask in enumerate(result.masks.xy):
        cls_id = int(result.boxes.cls[i])
        label = model.names[cls_id].lower()
        
        # שיוך למשפחה
        if label in ['car', 'truck', 'bus']:
            color = FAMILIES['vehicles']
        elif 'line' in label or 'stop' in label:
            color = FAMILIES['lines']
        elif 'traffic_light' in label:
            color = FAMILIES['lights']
        else:
            color = FAMILIES['others']
            
        # הכנת נקודות המצולע
        points = np.array(mask, dtype=np.int32)
        
        # 3. ציור המצולע על שכבת ה-Overlay
        cv2.fillPoly(overlay, [points], color)
        # ציור קו מתאר חזק
        cv2.polylines(img, [points], isClosed=True, color=color, thickness=2)
        
        # --- הוספת שם האובייקט בצורה קריאה ---
        # אנחנו לוקחים את הנקודה הראשונה של המצולע וזזים מעט למעלה ולשמאל כדי שהטקסט לא יסתיר את הפינה
        text_position = (points[0][0] - 10, points[0][1] - 10)
        
        # א. ציור ה"הילה" השחורה (Outline)
        cv2.putText(img, label, text_position, font_face, font_scale, (0, 0, 0), outline_thickness, cv2.LINE_AA)
        
        # ב. ציור הטקסט הלבן מעליה
        cv2.putText(img, label, text_position, font_face, font_scale, (255, 255, 255), text_thickness, cv2.LINE_AA)

    # 4. שילוב השקיפות (Alpha Blending)
    alpha = 0.4  # העלינו מעט את השקיפות (מ-0.3) כדי שהצבעים יהיו ברורים יותר
    cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, img)

    # שמירה והצגה
    output_name = "family_polygon_clear_text.jpg"
    cv2.imwrite(output_name, img)
    print(f"✅ התמונה נקייה נשמרה בנתיב: {output_name}")

# הרצה
if __name__ == "__main__":
    MODEL_PATH = 'traffic_model.pt'  # המודל שאימנת ב-Colab
    IMAGE_PATH = 'raw_incoming_1.jpg' # התמונה לבדיקה
    debug_segmentation_families_clear_text(MODEL_PATH, IMAGE_PATH)