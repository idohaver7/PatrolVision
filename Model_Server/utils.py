import numpy as np
import cv2


LPR_WORD_TO_DIGIT = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
}

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
def get_box_center(box):
    """Returns the (x, y) center of a bounding box."""
    return (box[0] + box[2]) / 2, (box[1] + box[3]) / 2

# --- Geometric & Polygon Utilities ---

def get_polygon_center(poly_coords):
    """Finds the mean (x, y) center point of a polygon."""
    pts = np.array(poly_coords)
    cx = np.mean(pts[:, 0])
    cy = np.mean(pts[:, 1])
    return cx, cy

def calculate_distance(p1, p2):
    """Calculates the Euclidean distance between two points."""
    return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)
#Get all the polygons of the detected horizontal lines (stop lines) across the frames
#fit a 2nd-degree curve y(x) and return the Y position of the line at a given vehicle X position.
def get_unified_stop_line_y(stop_line_polygons, car_x):
    if not stop_line_polygons:
        return None

    all_x = []
    all_y = []
    for poly in stop_line_polygons:
        all_x.extend(poly[:, 0])
        all_y.extend(poly[:, 1])

    # Need at least 3 points to fit a quadratic; otherwise fall back to mean Y.
    if len(all_x) < 3:
        return float(np.mean(all_y))

    curve_coefficients = np.polyfit(all_x, all_y, 2)
    return float(np.polyval(curve_coefficients, car_x))


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
    # Collect every plate crop belonging to this car across its history, then try LPR
    # from biggest plate to smallest — bigger = more pixels = more likely readable,
    # so we typically succeed on the first try and skip the rest.
    candidates = []  # list of (area, frame_idx, crop)

    for frame_idx, car_coords in zip(history["frames"], history["coords"]):
        frame_data = next((item for item in batch_analysis if item["frame_index"] == frame_idx), None)
        if not frame_data:
            continue

        for det in frame_data["detections"]:
            if det["class_name"] != "license_plate":
                continue
            px1, py1, px2, py2 = det["coordinates"]
            cx1, cy1, cx2, cy2 = car_coords

            # Plate center must sit inside this car's bbox (expanded by 30px on each side
            # to account for tracker model bbox being slightly tighter than the actual car)
            plate_cx = (px1 + px2) / 2
            plate_cy = (py1 + py2) / 2
            margin = 30
            if not (cx1 - margin <= plate_cx <= cx2 + margin and cy1 - margin <= plate_cy <= cy2 + margin):
                continue

            plate_area = (px2 - px1) * (py2 - py1)

            orig_frame = frames[frame_idx]
            img_h, img_w = orig_frame.shape[:2]

            crop_x1 = max(0, int(px1))
            crop_y1 = max(0, int(py1))
            crop_x2 = min(img_w, int(px2))
            crop_y2 = min(img_h, int(py2))

            crop = orig_frame[crop_y1:crop_y2, crop_x1:crop_x2]
            if crop.size > 0:
                candidates.append((plate_area, frame_idx, crop))

    if not candidates:
        return ""

    # Largest plate first — early exit on first successful read
    candidates.sort(key=lambda c: c[0], reverse=True)

    plate_text = "Unreadable"
    for attempt_idx, (_, frame_idx, crop) in enumerate(candidates):
        upscaled_plate = cv2.resize(
            crop, (crop.shape[1] * 4, crop.shape[0] * 4),
            interpolation=cv2.INTER_LANCZOS4,
        )

        print(f"🔍 LPR attempt {attempt_idx + 1}/{len(candidates)} (frame {frame_idx})...")
        lpr_results = lpr_model(upscaled_plate, conf=0.5)

        if len(lpr_results) == 0 or len(lpr_results[0].boxes) == 0:
            continue

        detected_chars = []
        for box in lpr_results[0].boxes:
            x1, _, x2, _ = box.xyxy[0].tolist()
            cls_id = int(box.cls[0].item())
            digit = LPR_WORD_TO_DIGIT.get(lpr_model.names[cls_id])
            if digit is None:
                continue
            detected_chars.append({
                "char": digit,
                "x_center": (x1 + x2) / 2.0,
            })

        detected_chars.sort(key=lambda d: d["x_center"])
        candidate_text = "".join(d["char"] for d in detected_chars)

        if candidate_text and len(candidate_text) in [7, 8]:
            print(f"🔢 Plate Detected: {candidate_text}")
            return candidate_text

        # Remember the best partial read in case every candidate fails validation
        if candidate_text:
            plate_text = candidate_text

    print(f"⚠️ LPR failed validation on all {len(candidates)} candidates. Best guess: {plate_text}")
    return plate_text


def prune_old_entries(d, current_time, ttl_seconds):
    # Drop dict entries whose timestamp is older than ttl_seconds.
    for k in [k for k, v in d.items() if current_time - v > ttl_seconds]:
        del d[k]


def should_report_violation(track_id, license_plate, current_time, reported_violators, reported_plates):
    # Dedup by track_id and by plate. Returns True if this violation should be
    # reported now; updates the provided dicts as a side effect.
    #
    # If the track_id was already reported, skip — even when we now have a valid plate.
    # The car is likely farther away on this re-detection, so a fresh LPR read is more
    # likely to be wrong than the original report, and re-reporting just spams the same car.
    plate_is_valid = license_plate and license_plate != "Unreadable" and len(license_plate) in (7, 8)

    if track_id in reported_violators:
        reported_violators[track_id] = current_time
        if plate_is_valid:
            reported_plates[license_plate] = current_time
        print(f"   ⏩ Skipped: ID {track_id} was already reported recently.")
        return False

    if plate_is_valid:
        if license_plate in reported_plates:
            reported_plates[license_plate] = current_time
            reported_violators[track_id] = current_time
            print(f"   ⏩ Skipped: Plate {license_plate} was already reported recently.")
            return False
        reported_plates[license_plate] = current_time

    reported_violators[track_id] = current_time
    return True