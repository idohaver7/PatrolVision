from ultralytics import YOLO
import cv2

def inspect_model_predictions(model_path, image_path, conf_threshold=0.25):
    """
    Runs the model on an image and prints all raw detection data.
    """
    try:
        # 1. Load the model
        print(f"Loading model from: {model_path}...")
        model = YOLO(model_path)

        # 2. Run inference
        # We use stream=True usually for video, but for single image it's fine.
        # save=True will save the annotated image automatically to 'runs/detect/...'
        print(f"Running inference on: {image_path} with confidence {conf_threshold}...")
        results = model.predict(source=image_path, conf=conf_threshold, save=True)

        # 3. Analyze results
        result = results[0] # We only have one image
        
        print("\n--- RAW DETECTION RESULTS ---")
        print(f"Total detections: {len(result.boxes)}")
        
        if len(result.boxes) == 0:
            print("No objects detected. The model sees nothing above the threshold.")
        else:
            # Loop through every detection
            for box in result.boxes:
                # Get the class ID and map it to the name
                cls_id = int(box.cls[0])
                class_name = model.names[cls_id]
                
                # Get confidence
                confidence = float(box.conf[0])
                
                # Get bounding box coordinates (x1, y1, x2, y2)
                coords = box.xyxy[0].tolist()
                
                print(f"Detected: '{class_name}' | Confidence: {confidence:.4f} | Box: {coords}")

        print("\n-----------------------------")
        print(f"Annotated image saved to: {result.save_dir}")
        print("Check the saved image to see exactly where the boxes are.")

    except Exception as e:
        print(f"An error occurred: {e}")

# --- Configuration ---
# Replace these with your actual file paths
MODEL_PATH = 'traffic_model.pt'  # Path to your .pt file (e.g., 'best.pt')
IMAGE_PATH = 'violation_frames/violation_at_249s.jpg' # Path to the image you uploaded
CONFIDENCE = 0.25 # The threshold you mentioned

if __name__ == "__main__":
    inspect_model_predictions(MODEL_PATH, IMAGE_PATH, CONFIDENCE)