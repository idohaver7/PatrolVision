import numpy as np
import cv2
# Utility functions for analyzing the batch of frames
def is_far(car, image_height=512, threshold_ratio=0.05):
    coords = car["coordinates"]
    car_height = coords[3] - coords[1]
    return car_height <= threshold_ratio * image_height

def get_center_bottom(box_coords):    
    x1, y1, x2, y2 = box_coords
    center_x = (x1 + x2) / 2.0
    center_y = y2  #center bottom is at the bottom edge of the box
    return center_x, center_y

def get_box_area(box_coords):
    # Calculates the area of a bounding box to help determine if a vehicle is getting closer (growing box) or farther (shrinking box)
    x1, y1, x2, y2 = box_coords
    return (x2 - x1) * (y2 - y1)

#Get all the polygons of the detected lines across the frames
#fit a curve to the lines and return the relative X position of the line at a given vechicle Y position.
def get_unified_line_x(lines_polygons, car_y):
    all_x = []
    all_y = []
    
    # collect all points from the detected line polygons
    for poly in lines_polygons:
        all_x.extend(poly[:, 0])
        all_y.extend(poly[:, 1])
        
    # if there are less than 3 points, we can't fit a curve, so we just return the average X (or 0 if no points)
    if len(all_y) < 3:
        return np.mean(all_x) if all_x else 0
    
    # fit a 2nd degree polynomial (quadratic curve) to the points to get a smooth line representation
    curve_coefficients = np.polyfit(all_y, all_x, 2)
    #if the car is farest then the farest detected line we ignored
    min_line_y = min([point[1] for poly in lines_polygons for point in poly])
    if car_y < min_line_y:
        return None
    # use the fitted curve to calculate the X position of the line at the target Y
    exact_line_x = np.polyval(curve_coefficients, car_y)
    
    
    return exact_line_x
    
#Extracts the license plate from the original high-resolution frame
def extract_license_plate(history, batch_analysis, frames, lpr_model):
    best_plate_crop = None
    max_plate_area = 0
    plate_text = ""
    
    #loop through the history of the car's positions and look for license plate detections in those frames.
    for frame_idx, car_coords in zip(history["frames"], history["coords"]):
        # Find the analysis data for this specific frame index
        frame_data = next((item for item in batch_analysis if item["frame_index"] == frame_idx), None)
        if not frame_data:
            continue
            
        # Look for license plate detections in this frame's analysis results
        for det in frame_data["detections"]:
            if det["class_name"] == "license_plate":
                px1, py1, px2, py2 = det["coordinates"]
                cx1, cy1, cx2, cy2 = car_coords
                
                #Verify that the detected license plate is within the bounding box of the car in this frame
                if px1 >= cx1 and py1 >= cy1 and px2 <= cx2 and py2 <= cy2:
                    plate_area = (px2 - px1) * (py2 - py1)
                    
                    # Get the largest detected plate area across the frames
                    if plate_area > max_plate_area:
                        max_plate_area = plate_area
                        
                        
                        padding_x = int((px2 - px1) * 0.1) # 10% width
                        padding_y = int((py2 - py1) * 0.1) # 10% height
                        
                        # calculate the crop coordinates with padding
                        orig_frame = frames[frame_idx]
                        img_h, img_w = orig_frame.shape[:2]
                        
                        crop_x1 = max(0, int(px1) - padding_x)
                        crop_y1 = max(0, int(py1) - padding_y)
                        crop_x2 = min(img_w, int(px2) + padding_x)
                        crop_y2 = min(img_h, int(py2) + padding_y)
                        
                        #crop from the original high-resolution frame
                        best_plate_crop = orig_frame[crop_y1:crop_y2, crop_x1:crop_x2]

    # if we found a plate crop, we enhance it and run the LPR model to read the text
    if best_plate_crop is not None and best_plate_crop.size > 0:
        
        
        # 1. Enhance the plate crop ()
        upscaled_plate = cv2.resize(best_plate_crop,(best_plate_crop.shape[1]*4, best_plate_crop.shape[0]*4), 
                      interpolation=cv2.INTER_LANCZOS4 )
        
       
        
        cv2.imwrite("debug_plate.jpg", best_plate_crop) 
        cv2.imwrite("debug_plate_upscaled.jpg", upscaled_plate) 
        
        # 3. הפעלת מודל ה-LPR
        print("🔍 Running LPR model on optimized crop...")
        lpr_results = lpr_model(upscaled_plate, conf=0.5) 
        
        
        if len(lpr_results) > 0 and len(lpr_results[0].boxes) > 0:
            
            detected_chars = []
            for box in lpr_results[0].boxes:
               x1, _, x2, _ = box.xyxy[0].tolist()
               cls_id = int(box.cls[0].item())
               char_name = lpr_model.names[cls_id]
               detected_chars.append({
                "char": char_name,
                "x_center": (x1 + x2) / 2.0
            })
            
            #sort the detected characters by their X coordinate to reconstruct the plate text in the correct order
            detected_chars.sort(key=lambda d: d["x_center"]) 
            plate_text = "".join([str(d["char"]) for d in detected_chars])
            print(f"🔢 Plate Detected: {plate_text}")
            if plate_text and len(plate_text) in [7, 8]:  # Assuming license plates have 7 or 8 digits
                return plate_text
        else:
            print("⚠️ LPR model could not read the plate.")
            plate_text = "Unreadable"

    return plate_text