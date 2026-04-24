import numpy as np
import time
from utils import (
    get_center_bottom, extract_license_plate, is_far,
    get_unified_line_y
)

CLEANING_TIME_SECONDS = 60
# Minimum pixels the car must have crossed past the stop line (noise filter)
LOWER_BOUND = 10
# Maximum pixels past the stop line for within-batch crossing detection
UPPER_BOUND = 600
# Maximum pixels past the stop line for "just crossed at batch start" detection
BATCH_START_UPPER_BOUND = 400
# Maximum pixels past the stop line for cross-batch crossing detection
CROSS_BATCH_UPPER_BOUND = 500
# Minimum pixels past the stop line for cross-batch crossing (filters stop-line polygon jitter)
CROSS_BATCH_LOWER_BOUND = 20
# A car within this many pixels behind the stop line is considered "approaching"
APPROACH_ZONE = 400

# tid -> timestamp
reported_violators = {}
# (car_x, car_y2) -> timestamp — position-based dedup to catch same car with different track IDs
reported_positions = {}
# X-only threshold: cars in the same lane have similar X regardless of how far past the line they are
POSITION_DEDUP_X_THRESHOLD = 150  # px — X distance to consider same lane

# Anchored stop-line Y from the session's first frame (set by app.py)
session_stop_line_y = None

# Tracks vehicles that were seen behind the stop line recently.
# Used to detect crossings that span two consecutive batches.
# tid -> (x, y2, stop_line_y, timestamp, had_red_light)
approaching_vehicles = {}
APPROACH_EXPIRY_SECONDS = 30

# Queue of confirmed violations waiting to be returned (one per call).
# Each entry: {"tid": int, "history": dict, "crossing_frame_idx": int}
_pending_violations = []


def set_session_stop_line(first_frame_data):
    """
    Called once per session (when is_first_batch=True) to reset all inter-batch
    state and anchor the stop line Y from the first frame.
    """
    global session_stop_line_y
    approaching_vehicles.clear()
    _pending_violations.clear()
    reported_violators.clear()
    reported_positions.clear()
    session_stop_line_y = None
    print("🔄 Session reset: cleared all inter-batch state")
    if first_frame_data is None:
        return
    stop_lines = [
        np.array(det["coordinates"])
        for det in first_frame_data["detections"]
        if det["class_name"] == "stop_line" and det["type"] == "polygon"
    ]
    if stop_lines:
        all_y = np.concatenate([poly[:, 1] for poly in stop_lines])
        session_stop_line_y = float(np.mean(all_y))
        print(f"📍 Session stop line anchored at Y = {session_stop_line_y:.1f}")
    else:
        session_stop_line_y = None
        print("⚠️ No stop line found in first frame — will rely on per-batch detection")


def _resolve_stop_line_y(stop_line_polygons, car_x, image_height=1080):
    """
    Returns the Y of the stop line at the car's X position.
    Falls back to the session anchor, then to an estimate at 65% of image height.
    """
    if stop_line_polygons:
        return get_unified_line_y(stop_line_polygons[0], car_x)
    if session_stop_line_y is not None:
        return session_stop_line_y
    # No painted stop line detected: estimate at 65% of image height.
    # Stopped cars at an intersection sit at ~75-85% from top; after crossing
    # into the intersection they rise to ~40-55%. 65% is a reliable threshold.
    return image_height * 0.65


def _resolve_plate(history, batch_analysis, frames, lpr_model):
    """Extract license plate for a confirmed violation using extract_license_plate from utils."""
    print(f"🔎 [LPR DEBUG] car frames: {history['frames']}")
    for frame_idx, car_coords in zip(history["frames"], history["coords"]):
        cx1, cy1, cx2, cy2 = car_coords
        print(f"   frame {frame_idx}: car_bbox=({cx1:.0f},{cy1:.0f},{cx2:.0f},{cy2:.0f})")
        frame_data = next((fd for fd in batch_analysis if fd["frame_index"] == frame_idx), None)
        if not frame_data:
            continue
        plates = [d for d in frame_data["detections"] if d["class_name"] == "license_plate"]
        for p in plates:
            px1, py1, px2, py2 = p["coordinates"]
            pcx, pcy = (px1 + px2) / 2, (py1 + py2) / 2
            inside = cx1 <= pcx <= cx2 and cy1 <= pcy <= cy2
            print(f"     plate_bbox=({px1:.0f},{py1:.0f},{px2:.0f},{py2:.0f}) center=({pcx:.0f},{pcy:.0f}) inside={inside}")
    return extract_license_plate(history, batch_analysis, frames, lpr_model)


def detect_red_light_violation(batch_analysis, frames, lpr_model, image_height=512):
    print("\n--- 🚦 RED LIGHT DETECTION ---")
    current_time = time.time()

    # ── Return pending violations from previous batches first ─────────────
    if _pending_violations:
        pv = _pending_violations.pop(0)
        print(f"📋 Returning pending violation for ID {pv['tid']} (queue size: {len(_pending_violations)})")
        plate = pv.get("plate_override") or _resolve_plate(
            pv["history"], batch_analysis, frames, lpr_model
        )
        return {
            "violation": True,
            "type": "Red Light Violation",
            "track_id": pv["tid"],
            "license_plate": plate,
            "last_violation_frame": pv["crossing_frame_idx"],
            "frame_image": pv.get("frame_image"),
        }

    vehicle_history = {}

    # Clean up stale state
    for k in [k for k, v in list(reported_violators.items()) if current_time - v > CLEANING_TIME_SECONDS]:
        del reported_violators[k]
    for k in [k for k, v in list(reported_positions.items()) if current_time - v > CLEANING_TIME_SECONDS]:
        del reported_positions[k]
    for k in [k for k, v in list(approaching_vehicles.items()) if current_time - v[3] > APPROACH_EXPIRY_SECONDS]:
        del approaching_vehicles[k]

    # ── Step 1: Check if there is ANY red light in this batch ──────────────
    batch_has_red = any(
        det["class_name"] == "traffic_light_red"
        for fd in batch_analysis
        for det in fd["detections"]
    )
    if not batch_has_red:
        # Still check cross-batch crossings if a car was recently approaching at a red light
        has_prior_red_approachers = any(v[4] for v in approaching_vehicles.values())
        if not has_prior_red_approachers:
            print("⏩ No red light detected in batch — skipping.")
            return {"violation": False}
        print("⚠️ No red light now, but prior red-light approachers exist — checking cross-batch crossings...")

    # ── Step 2: Build vehicle history across the 4 frames ──────────────────
    # Auto-anchor stop line from the first batch that detects one (don't rely on is_first_batch)
    global session_stop_line_y
    if session_stop_line_y is None:
        for frame_data in batch_analysis:
            anchor_lines = [
                np.array(det["coordinates"])
                for det in frame_data["detections"]
                if det["class_name"] == "stop_line" and det["type"] == "polygon"
            ]
            if anchor_lines:
                all_y = np.concatenate([poly[:, 1] for poly in anchor_lines])
                session_stop_line_y = float(np.mean(all_y))
                print(f"📍 Stop line auto-anchored at Y = {session_stop_line_y:.1f}")
                break

    last_known_lines = []
    for frame_data in batch_analysis:
        lines = [
            np.array(det["coordinates"])
            for det in frame_data["detections"]
            if det["class_name"] == "stop_line" and det["type"] == "polygon"
        ]
        if lines:
            last_known_lines = lines

        for det in frame_data["detections"]:
            if det["class_name"] in ["car", "bus", "truck"] \
                    and det.get("track_id", -1) != -1 \
                    and not is_far(det, image_height):
                tid = det["track_id"]
                if tid not in vehicle_history:
                    vehicle_history[tid] = {
                        "frames": [], "coords": [],
                        "stop_lines": [],
                        "red_lights": [], "green_lights": []
                    }
                vehicle_history[tid]["frames"].append(frame_data["frame_index"])
                vehicle_history[tid]["coords"].append(det["coordinates"])
                vehicle_history[tid]["stop_lines"].append(lines if lines else last_known_lines)
                vehicle_history[tid]["red_lights"].append([
                    d["coordinates"] for d in frame_data["detections"]
                    if d["class_name"] == "traffic_light_red"
                ])
                vehicle_history[tid]["green_lights"].append([
                    d["coordinates"] for d in frame_data["detections"]
                    if d["class_name"] == "traffic_light_green"
                ])

    print(f"🚗 Tracked {len(vehicle_history)} vehicles in this batch.")

    confirmed_violations = []

    # ── Step 3: Evaluate ALL vehicles (don't return early) ───────────────

    for tid, history in vehicle_history.items():
        n = len(history["coords"])

        _, start_y = get_center_bottom(history["coords"][0])
        _, end_y   = get_center_bottom(history["coords"][-1])
        delta_y    = end_y - start_y  # negative = moving forward (away from camera)

        # Skip oncoming traffic (Y increasing = moving toward camera)
        if end_y > start_y + 10:
            print(f"  ID {tid}: skipped (oncoming, Δy={delta_y:.1f})")
            continue

        has_red_in_batch = any(bool(rl) for rl in history["red_lights"])

        # Get the car's position at the start of this batch relative to the stop line
        car_x_0, car_y2_0 = get_center_bottom(history["coords"][0])
        stop_line_y_0 = _resolve_stop_line_y(history["stop_lines"][0], car_x_0, image_height)
        dist_at_start  = car_y2_0 - stop_line_y_0  # + = behind line, - = past line

        crossing_found    = False
        crossing_frame_idx = -1

        # ── Spatial approaching lookup ─────────────────────────────────────
        approaching_match = None
        approaching_match_tid = None
        if tid in approaching_vehicles:
            approaching_match = approaching_vehicles[tid]
            approaching_match_tid = tid
        else:
            for atid, ainfo in approaching_vehicles.items():
                a_x = ainfo[0]
                if abs(car_x_0 - a_x) < POSITION_DEDUP_X_THRESHOLD:
                    approaching_match = ainfo
                    approaching_match_tid = atid
                    print(f"  ID {tid}: spatial match to approaching ID {atid}")
                    break

        # ── Cross-batch crossing check (works with n >= 1) ─────────────────
        if approaching_match is not None and dist_at_start < 0:
            prev_had_red = approaching_match[-1]
            crossed_dist = -dist_at_start
            # If we matched by spatial proximity (different ID), the original approacher must be
            # gone from this batch. If it's still visible, this is a different car in the same lane.
            original_still_present = (
                approaching_match_tid != tid and approaching_match_tid in vehicle_history
            )
            if original_still_present:
                print(f"  ⏩ ID {tid}: skipped cross-batch match (ID {approaching_match_tid} still present — different car)")
            elif (prev_had_red or has_red_in_batch) and CROSS_BATCH_LOWER_BOUND <= crossed_dist <= CROSS_BATCH_UPPER_BOUND:
                crossing_found     = True
                crossing_frame_idx = 0
                print(f"  ✅ ID {tid}: CROSS-BATCH CROSSING ({crossed_dist:.1f}px past line)")

        if n >= 2:
            # ── Just-crossed check ──────────────────────────────────────────
            if not crossing_found and dist_at_start < 0 and approaching_match is not None:
                crossed_dist = -dist_at_start
                if LOWER_BOUND <= crossed_dist <= BATCH_START_UPPER_BOUND and has_red_in_batch:
                    crossing_found     = True
                    crossing_frame_idx = n - 1
                    print(f"  ✅ ID {tid}: JUST-CROSSED at batch start ({crossed_dist:.1f}px past line)")

            # ── Within-batch crossing detection ─────────────────────────────
            if not crossing_found:
                for i in range(n - 1):
                    car_x_i,  car_y2_i  = get_center_bottom(history["coords"][i])
                    car_x_i1, car_y2_i1 = get_center_bottom(history["coords"][i + 1])

                    stop_line_y_i  = _resolve_stop_line_y(history["stop_lines"][i],     car_x_i,  image_height)
                    stop_line_y_i1 = _resolve_stop_line_y(history["stop_lines"][i + 1], car_x_i1, image_height)

                    dist_i  = car_y2_i  - stop_line_y_i
                    dist_i1 = car_y2_i1 - stop_line_y_i1

                    print(f"  ID {tid} step {i}: car_y2={car_y2_i:.0f}, line_y={stop_line_y_i:.0f}, dist={dist_i:.1f}")

                    if dist_i > 0 and dist_i1 <= 0:
                        crossed_dist = -dist_i1
                        if LOWER_BOUND <= crossed_dist <= UPPER_BOUND:
                            crossing_found     = True
                            crossing_frame_idx = i + 1
                            print(f"  ✅ ID {tid}: CROSSING at step {i}→{i+1} ({crossed_dist:.1f}px past)")
                        else:
                            print(f"  ⏩ ID {tid}: crossing but too deep ({crossed_dist:.1f}px) — ignored")
                        break

        # ── Update approaching_vehicles state ───────────────────────────────
        car_x_end, car_y2_end = get_center_bottom(history["coords"][-1])
        stop_line_y_end = _resolve_stop_line_y(history["stop_lines"][-1], car_x_end, image_height)
        dist_at_end = car_y2_end - stop_line_y_end
        if 0 < dist_at_end <= APPROACH_ZONE:
            approaching_vehicles[tid] = (car_x_end, car_y2_end, stop_line_y_end, current_time, has_red_in_batch)
            if not crossing_found:
                print(f"  ID {tid}: approaching (dist={dist_at_end:.1f}px) — watching")
        elif tid in approaching_vehicles:
            del approaching_vehicles[tid]

        if not crossing_found:
            if n < 2:
                print(f"  ID {tid}: skipped (only {n} frame, no cross-batch match)")
            continue

        # ── Step 5: Confirm red light was active at the crossing frame ──────
        red_at_crossing = bool(history["red_lights"][crossing_frame_idx])
        if not red_at_crossing:
            red_at_crossing = has_red_in_batch
        if not red_at_crossing and approaching_match is not None:
            # The approaching entry stores whether there was a red when the car was last seen behind the line
            red_at_crossing = approaching_match[4]
        if not red_at_crossing:
            print(f"  ID {tid}: crossing found but no red light confirmed — skipped")
            continue

        # ── Step 6: Dedup ──────────────────────────────────────────────────
        if tid in reported_violators:
            print(f"  ID {tid}: already reported recently — skipped")
            continue

        car_x_viol, car_y2_viol = get_center_bottom(history["coords"][crossing_frame_idx])
        position_dup = False
        for (px, _), _ in reported_positions.items():
            if abs(car_x_viol - px) < POSITION_DEDUP_X_THRESHOLD:
                position_dup = True
                break
        if position_dup:
            print(f"  ID {tid}: same position as recent report — skipped (position dedup)")
            continue

        # ── Mark as reported and clean up approaching state ─────────────────
        reported_violators[tid] = current_time
        reported_positions[(car_x_viol, car_y2_viol)] = current_time
        approaching_vehicles.pop(tid, None)
        if approaching_match_tid is not None and approaching_match_tid != tid:
            approaching_vehicles.pop(approaching_match_tid, None)
        for rem_tid in [k for k, v in approaching_vehicles.items()
                        if abs(v[0] - car_x_viol) < POSITION_DEDUP_X_THRESHOLD]:
            del approaching_vehicles[rem_tid]

        print(f"🏆 >>> RED LIGHT VIOLATION CONFIRMED: ID {tid} <<<")
        confirmed_violations.append({
            "tid": tid,
            "history": history,
            "vehicle_history": vehicle_history,
            "crossing_frame_idx": crossing_frame_idx,
            "car_x": car_x_viol,
            "car_y2": car_y2_viol,
            "frame_image": frames[crossing_frame_idx],
        })

    # ── Return results ────────────────────────────────────────────────────
    if not confirmed_violations:
        print("✅ No red light violations in this batch.")
        return {"violation": False}

    # Return the first violation now; queue the rest for subsequent calls
    first = confirmed_violations[0]
    for extra in confirmed_violations[1:]:
        _pending_violations.append(extra)
        print(f"📋 Queued violation for ID {extra['tid']} (pending: {len(_pending_violations)})")

    plate = first.get("plate_override") or _resolve_plate(
        first["history"], batch_analysis, frames, lpr_model
    )
    return {
        "violation": True,
        "type": "Red Light Violation",
        "track_id": first["tid"],
        "license_plate": plate,
        "last_violation_frame": first["crossing_frame_idx"],
        "frame_index": first["crossing_frame_idx"],
        "frame_image": first.get("frame_image"),
    }