import cv2
from ultralytics import YOLO

def test_lpr_model(image_path, model_path='lpr_model.pt', conf_threshold=0.20):
    print(f"🚀 Loading LPR model from '{model_path}'...")
    try:
        model = YOLO(model_path)
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        return

    print(f"📸 Loading image '{image_path}'...")
    img = cv2.imread(image_path)
    if img is None:
        print("❌ Could not read image. Please check the path and filename.")
        return
    
    img_h, img_w = img.shape[:2]
    print(f"📐 Image dimensions: {img_w}x{img_h} pixels (Width x Height)")

    # מריצים את המודל (שמתי ביטחון נמוך בכוונה כדי לראות הכל)
    print(f"🔍 Running inference with confidence threshold: {conf_threshold}...")
    results = model(img, conf=conf_threshold, verbose=False)

    if len(results) == 0 or len(results[0].boxes) == 0:
        print("⚠️ Model did not detect any characters in this image.")
        return

    boxes = results[0].boxes
    detections = []

    # שולפים את כל הזיהויים
    for box in boxes:
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        conf = box.conf[0].item()
        cls_id = int(box.cls[0].item())
        char_name = model.names[cls_id]
        
        detections.append({
            "char": char_name,
            "conf": conf,
            "x_center": (x1 + x2) / 2.0,
            "box": (int(x1), int(y1), int(x2), int(y2))
        })

    # ממיינים משמאל לימין לפי ציר ה-X
    detections = sorted(detections, key=lambda d: d["x_center"])

    # --- הדפסת תוצאות מפורטת למסך ---
    print("\n📊 --- DETECTION RESULTS (Left to Right) ---")
    raw_text = ""
    for d in detections:
        print(f"Char: '{d['char']}' | Confidence: {d['conf']:.2f} | X-Center: {d['x_center']:.1f}")
        raw_text += str(d['char'])
        
        # ציור על התמונה לטובת דיבאג ויזואלי
        cv2.rectangle(img, (d['box'][0], d['box'][1]), (d['box'][2], d['box'][3]), (0, 255, 0), 1)
        cv2.putText(img, f"{d['char']} ({d['conf']:.2f})", (d['box'][0], d['box'][1] - 5), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)

    # סינון למספרים בלבד
    clean_text = ''.join(filter(str.isdigit, raw_text))
    
    print("-" * 40)
    print(f"🔡 Raw string:    {raw_text}")
    print(f"🔢 Digits only:   {clean_text} (Length: {len(clean_text)})")
    
    if len(clean_text) in [7, 8]:
        print("✅ VALID PLATE LENGTH")
    else:
        print("⚠️ INVALID PLATE LENGTH")

    # שמירת התמונה המצוירת
    output_path = "annotated_test_plate.jpg"
    cv2.imwrite(output_path, img)
    print(f"\n🖼️ Saved annotated image to '{output_path}'. Open it to see the bounding boxes!")

if __name__ == "__main__":
    # החלף את שם התמונה אם קראת לה בשם אחר
    test_lpr_model("check.png", conf_threshold=0.45)