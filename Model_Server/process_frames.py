from ultralytics import YOLO
import cv2
import numpy as np
from pathlib import Path

def process_images_with_segmentation(model_path, input_dir, output_dir, conf_threshold=0.25):
    """
    Processes all images in a directory with a YOLO segmentation model,
    draws colored polygons and labels for each object, and saves the results.
    """
    # 1. Load the model
    try:
        model = YOLO(model_path)
        print("✅ Model loaded successfully.")
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        return

    # Create output directory if it doesn't exist
    output_dir.mkdir(exist_ok=True)
    print(f"📂 Output will be saved to: {output_dir}")

    # Define colors for object families (BGR format)
    FAMILIES = {
        'vehicles': (255, 0, 0),    # Blue (car, truck, bus)
        'lines': (0, 255, 0),       # Green (solid_line, stop_line, bus_line)
        'lights': (0, 0, 255),      # Red (traffic_lights)
        'others': (0, 255, 255)     # Yellow (license_plate, taxi_hat)
    }

    # Font settings for labels
    font_face = cv2.FONT_HERSHEY_DUPLEX
    font_scale = 0.7
    text_thickness = 1
    outline_thickness = 3

    image_paths = sorted(list(input_dir.glob('*.jpg')) + list(input_dir.glob('*.png')))
    if not image_paths:
        print("⚠️ No images found in the input directory.")
        return

    print(f"🚀 Found {len(image_paths)} images to process...")

    for image_path in image_paths:
        # 2. Run tracking (same flow as server's /analyze_batch)
        try:
            results = model.track(source=str(image_path), conf=conf_threshold, persist=True, tracker="bytetrack.yaml", verbose=False)
            result = results[0]
        except Exception as e:
            print(f"❌ Error tracking on {image_path.name}: {e}")
            continue

        # Load the original image
        img = cv2.imread(str(image_path))
        if img is None:
            print(f"❌ Could not load image: {image_path.name}")
            continue
            
        overlay = img.copy()  # Overlay for transparency

        if result.masks is None or len(result.masks) == 0:
            print(f"ℹ️ No segmentation masks found in {image_path.name}. Saving original image.")
            output_path = output_dir / image_path.name
            cv2.imwrite(str(output_path), img)
            continue

        # 3. Process and draw each detected object
        for i, mask in enumerate(result.masks.xy):
            cls_id = int(result.boxes.cls[i])
            conf = float(result.boxes.conf[i])
            label_text = f"{model.names[cls_id].lower()} {conf:.2f}"
            
            # Assign to a family
            if model.names[cls_id].lower() in ['car', 'truck', 'bus']:
                color = FAMILIES['vehicles']
            elif 'line' in model.names[cls_id].lower() or 'stop' in model.names[cls_id].lower():
                color = FAMILIES['lines']
            elif 'traffic_light' in model.names[cls_id].lower():
                color = FAMILIES['lights']
            else:
                color = FAMILIES['others']
                
            # Prepare polygon points
            points = np.array(mask, dtype=np.int32)
            
            # Draw the filled polygon on the overlay
            cv2.fillPoly(overlay, [points], color)
            # Draw a strong outline on the main image
            cv2.polylines(img, [points], isClosed=True, color=color, thickness=2)
            
            # Add the object label with a clear outline
            text_position = (points[0][0] - 10, points[0][1] - 10)
            
            # a. Draw the black "halo" (outline)
            cv2.putText(img, label_text, text_position, font_face, font_scale, (0, 0, 0), outline_thickness, cv2.LINE_AA)
            
            # b. Draw the white text on top
            cv2.putText(img, label_text, text_position, font_face, font_scale, (255, 255, 255), text_thickness, cv2.LINE_AA)

        # 4. Blend the overlay with the original image
        alpha = 0.4
        cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, img)

        # 5. Save the result
        output_path = output_dir / f"processed_{image_path.name}"
        cv2.imwrite(str(output_path), img)
        print(f"✅ Processed {image_path.name} and saved to {output_path}")

    print("\n🎉 All images processed successfully!")

# --- Main execution block ---
if __name__ == "__main__":
    MODEL_PATH = 'traffic_model.pt'
    INPUT_DIR = Path('frames+')
    OUTPUT_DIR = Path('output_frames')
    
    process_images_with_segmentation(MODEL_PATH, INPUT_DIR, OUTPUT_DIR)