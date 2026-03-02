import os
import cv2
import requests
import glob
import numpy as np

# --- הגדרות ---
SERVER_URL = 'http://127.0.0.1:6000/analyze' # הכתובת של השרת שלך
INPUT_FOLDER = 'test'   # התיקייה שבה שמים תמונות לבדיקה
OUTPUT_FOLDER = 'violation_frames' # התיקייה שבה ישמרו התוצאות

# יצירת תיקיית פלט אם לא קיימת
if not os.path.exists(OUTPUT_FOLDER):
    os.makedirs(OUTPUT_FOLDER)

def run_batch_test():
    # איסוף כל התמונות (jpg, png, jpeg)
    types = ('*.jpg', '*.jpeg', '*.png') 
    images_list = []
    for files in types:
        images_list.extend(glob.glob(os.path.join(INPUT_FOLDER, files)))
    
    print(f"📂 Found {len(images_list)} images to process...")

    for img_path in images_list:
        filename = os.path.basename(img_path)
        print(f"Testing {filename}...", end=" ")
        
        try:
            # 1. שליחת התמונה לשרת
            with open(img_path, 'rb') as f:
                response = requests.post(SERVER_URL, files={'frame': f})
            
            if response.status_code != 200:
                print(f"❌ Server Error: {response.status_code}")
                continue

            data = response.json()
            
            # 2. טעינת התמונה המקורית לציור
            img = cv2.imread(img_path)
            
            # 3. ניתוח התשובה וציור על התמונה
            violation = data.get('violation_detected', False)
            v_type = data.get('type', "None")
            details = data.get('details', {})
            
            if violation:
                # --- מצב עבירה (אדום) ---
                color = (0, 0, 255) # אדום
                status_text = f"VIOLATION: {v_type}"
                
                # ציור ריבוע סביב הרכב העבריין
                if 'box' in details and details['box']:
                    x1, y1, x2, y2 = map(int, details['box'])
                    cv2.rectangle(img, (x1, y1), (x2, y2), color, 3)
                    
                    # הצגת לוחית אם זוהתה
                    plate_text = details.get('plate')
                    if plate_text:
                        cv2.putText(img, f"Plate: {plate_text}", (x1, y1 - 10), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
                    else:
                        cv2.putText(img, "Plate: ???", (x1, y1 - 10), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
            else:
                # --- מצב תקין (ירוק) ---
                color = (0, 255, 0) # ירוק
                status_text = "CLEAN"
            
            # כתיבת הסטטוס בראש התמונה
            cv2.putText(img, status_text, (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
            
            # 4. שמירת התמונה המנותחת
            save_path = os.path.join(OUTPUT_FOLDER, "res_" + filename)
            cv2.imwrite(save_path, img)
            print(f"Done -> {status_text}")

        except Exception as e:
            print(f"❌ Error: {e}")

    print(f"\n✅ Finished! Check the '{OUTPUT_FOLDER}' folder.")

if __name__ == "__main__":
    run_batch_test()