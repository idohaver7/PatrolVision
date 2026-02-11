import cv2
import requests
import os

# --- הגדרות ---
# הנתיב לסרטון שלך (תשנה את זה לשם הקובץ האמיתי!)
VIDEO_PATH = 'test3.mp4' 

SERVER_URL = 'http://127.0.0.1:6000/analyze'
OUTPUT_FOLDER = 'violation_frames' # כאן נשמור את הפריימים שתפסו עבירה

if not os.path.exists(OUTPUT_FOLDER):
    os.makedirs(OUTPUT_FOLDER)

def test_video_logic():
    # פתיחת הוידאו
    cap = cv2.VideoCapture(VIDEO_PATH)
    
    if not cap.isOpened():
        print(f"❌ Error: Could not open video file '{VIDEO_PATH}'. Check the path!")
        return

    # שליפת נתונים על הוידאו
    fps = cap.get(cv2.CAP_PROP_FPS) # פריימים לשנייה
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps
    
    print(f"🎬 Video loaded: {duration:.1f} seconds long, {fps:.1f} FPS.")
    print("🚀 Starting simulation (sending 1 frame per second)...\n")
    print(f"{'Time':<10} | {'Status':<15} | {'Server Response'}")
    print("-" * 60)

    current_sec = 0
    violations_count = 0

    while True:
        # חישוב הפריים המדויק לפי השניות (למשל: ב-fps 30, שנייה 2 היא פריים 60)
        frame_id = int(current_sec * fps)
        
        # אם עברנו את אורך הסרטון - עוצרים
        if frame_id >= total_frames:
            break

        # קפיצה לפריים הספציפי
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_id)
        ret, frame = cap.read()
        
        if not ret: break # הגנה למקרה שהקריאה נכשלה

        # המרת התמונה לפורמט לשליחה
        _, img_encoded = cv2.imencode('.jpg', frame)
        files = {'frame': ('frame.jpg', img_encoded.tobytes(), 'image/jpeg')}

        try:
            # שליחה לשרת
            response = requests.post(SERVER_URL, files=files)
            data = response.json()
            
            # ניתוח התשובה
            is_violation = data.get('violation_detected', False)
            violation_type = data.get('type')
            plate = data.get('details', {}).get('plate')
            
            # הדפסה יפה לטרמינל
            time_str = f"00:{current_sec:02d}"
            status = "🔴 VIOLATION" if is_violation else "🟢 CLEAN"
            detail_str = f"{violation_type} (Plate: {plate})" if is_violation else "-"
            
            print(f"{time_str:<10} | {status:<15} | {detail_str}")

            if is_violation:
                violations_count += 1
                # שמירת הפריים להוכחה
                filename = f"violation_at_{current_sec}s.jpg"
                cv2.imwrite(os.path.join(OUTPUT_FOLDER, filename), frame)

        except Exception as e:
            print(f"{current_sec}s: Error connecting to server - {e}")

        current_sec += 1

    cap.release()
    print("\n" + "="*30)
    print(f"🏁 Test Finished.")
    print(f"Total Violations Caught: {violations_count}")
    if violations_count > 0:
        print(f"✅ SUCCESS: The system caught the vehicle in {violations_count} different frames!")
        print(f"Check the '{OUTPUT_FOLDER}' folder to see the evidence.")
    else:
        print("❌ FAILURE: The system missed the violation completely.")

if __name__ == "__main__":
    test_video_logic()