import numpy as np
# Utility functions for analyzing the batch of frames


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
    
    # use the fitted curve to calculate the X position of the line at the target Y
    exact_line_x = np.polyval(curve_coefficients, car_y)
    
    return exact_line_x
    
#Pass all the history and extract the license plate with the best confidence score.
def extract_license_plate(history, batch_analysis, frames,ocr_reader):
  best_conf = -1.0
  best_crop = None  
  for i in range(len(history["frames"])):
        frame_idx = history["frames"][i]
        vehicle_coords = history["coords"][i]
        vx1, vy1, vx2, vy2 = map(int, vehicle_coords)
        all_detections = batch_analysis[frame_idx]["detections"]
        for det in all_detections:
            if det["class_name"] in ["license_plate"]:
                px1, py1, px2, py2 = map(int, det["coordinates"])
                conf = det.get("confidence", 0)
                # Check if the license plate box is within the vehicle box (with some tolerance)
                if px1 >= vx1 and py1 >= vy1 and px2 <= vx2 and py2 <= vy2:
                    if conf > best_conf:
                        best_conf = conf
                        best_crop = frames[frame_idx][py1:py2, px1:px2]
  if best_crop is not None:
        #gray_crop = cv2.cvtColor(best_crop, cv2.COLOR_BGR2GRAY)
        ocr_results = ocr_reader.readtext(best_crop,allowlist='0123456789')
        plate_text = "".join([res[1] for res in ocr_results])
        clean_text = ''.join(filter(str.isdigit, plate_text))
        if clean_text and len(clean_text) in [7,8]:  # Assuming license plates have 7 or 8 digits
            return clean_text 
        else:
            return 'Unknown'  # OCR failed to extract a valid plate number
        
  return None    