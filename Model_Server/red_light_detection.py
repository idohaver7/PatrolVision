import numpy as np
import time
from utils import (
    get_center_bottom, extract_license_plate, is_far,
    get_unified_stop_line_y, prune_old_entries, should_report_violation,
)

# ── Crossing thresholds ───────────────────────────────────────────────
LOWER_BOUND = 10
UPPER_BOUND = 600

# ── Approach / cross-batch ────────────────────────────────────────────
# A car within this many pixels behind the line is "approaching".
APPROACH_ZONE = 400
# Drop approaching entries older than this — past this, the cross-batch
# link is too unreliable to trust.
APPROACH_EXPIRY_SECONDS = 30

# ── Stop-line cache ───────────────────────────────────────────────────
# If the current batch has no stop line, reuse the previous batch's
# polygons only if they were detected within this many seconds.
STOP_LINE_TTL_SECONDS = 5

# ── Dedup ─────────────────────────────────────────────────────────────
CLEANING_TIME_SECONDS = 20
reported_violators = {}  # track_id -> timestamp
reported_plates = {}     # plate -> timestamp

# ── State carried between batches ─────────────────────────────────────
# Cars seen behind the line at the end of the previous batch. Used by
# the cross-batch strategy to detect crossings that span two batches.
# track_id -> (had_red_at_approach, timestamp)
approaching_vehicles = {}

# Cached stop-line polygons from the most recent batch that detected any.
_last_stop_line_polygons = None
_last_stop_line_time = 0.0

# Confirmed violations waiting to be returned, one per call.
_pending_violations = []


# ──────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────

def _batch_has_red_light(batch_analysis):
    return any(
        det["class_name"] == "traffic_light_red"
        for fd in batch_analysis
        for det in fd["detections"]
    )


def _resolve_batch_stop_line(batch_analysis, current_time):
    """
    Pool stop-line polygons from the current batch. If empty, reuse the
    cached polygons from the previous batch when they're younger than
    STOP_LINE_TTL_SECONDS. Returns a list of polygons, or None.
    """
    global _last_stop_line_polygons, _last_stop_line_time

    polygons = [
        np.array(det["coordinates"])
        for fd in batch_analysis
        for det in fd["detections"]
        if det["class_name"] == "stop_line" and det["type"] == "polygon"
    ]

    if polygons:
        _last_stop_line_polygons = polygons
        _last_stop_line_time = current_time
        return polygons

    age = current_time - _last_stop_line_time
    if _last_stop_line_polygons is not None and age <= STOP_LINE_TTL_SECONDS:
        return _last_stop_line_polygons

    return None


def _build_vehicle_history(batch_analysis, image_height):
    """Group tracked vehicle detections by track_id across batch frames."""
    history = {}
    for frame_data in batch_analysis:
        frame_idx = frame_data["frame_index"]
        for det in frame_data["detections"]:
            if det["class_name"] not in ("car", "bus", "truck"):
                continue
            tid = det.get("track_id", -1)
            if tid == -1 or is_far(det, image_height):
                continue
            if tid not in history:
                history[tid] = {"frames": [], "coords": []}
            history[tid]["frames"].append(frame_idx)
            history[tid]["coords"].append(det["coordinates"])
    return history


def _is_oncoming(coords):
    """Cars moving toward the camera (Y2 increasing) are oncoming traffic."""
    _, start_y = get_center_bottom(coords[0])
    _, end_y = get_center_bottom(coords[-1])
    return end_y > start_y + 10


def _signed_dist_to_line(car_coords, stop_line_polygons):
    """Positive = behind the line, negative = past it."""
    car_x, car_y2 = get_center_bottom(car_coords)
    line_y = get_unified_stop_line_y(stop_line_polygons, car_x)
    return car_y2 - line_y


# ──────────────────────────────────────────────────────────────────────
# Crossing strategies
# ──────────────────────────────────────────────────────────────────────

def _detect_same_batch_crossing(coords, stop_line_polygons):
    """
    The vehicle is behind the line in some frame and past it in a later
    frame within this batch. Returns the index of the frame to display,
    or -1 if no clean crossing was found.
    """
    n = len(coords)
    if n < 2:
        return -1

    dists = [_signed_dist_to_line(c, stop_line_polygons) for c in coords]

    for i in range(n - 1):
        dist_i = dists[i]
        dist_j = dists[i + 1]
        if dist_i >= LOWER_BOUND and dist_j <= 0:
            crossed = -dist_j
            if crossed > UPPER_BOUND:
                return -1
            return min(i + 2, n - 1)

    return -1


def _detect_cross_batch_crossing(tid, coords, stop_line_polygons):
    """
    The vehicle was approaching at the end of a previous batch and is
    now past the line at the start of this batch. Returns
    (crossing_frame_idx, had_red_at_approach) or (-1, False).
    """
    if tid not in approaching_vehicles:
        return -1, False

    had_red, _ = approaching_vehicles[tid]
    dist = _signed_dist_to_line(coords[0], stop_line_polygons)

    if dist >= 0:
        return -1, False

    crossed = -dist
    if crossed > UPPER_BOUND:
        return -1, False

    crossing_frame_idx = min(1, len(coords) - 1)
    return crossing_frame_idx, had_red


def _update_approaching(tid, coords, stop_line_polygons, has_red_in_batch, current_time):
    """Remember vehicles sitting behind the line at the end of this batch."""
    dist_at_end = _signed_dist_to_line(coords[-1], stop_line_polygons)
    if 0 < dist_at_end <= APPROACH_ZONE:
        approaching_vehicles[tid] = (has_red_in_batch, current_time)
    elif tid in approaching_vehicles:
        del approaching_vehicles[tid]


# ──────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────

def detect_red_light_violation(batch_analysis, frames, lpr_model, image_height=512):
    print("\n--- 🚦 RED LIGHT DETECTION ---")
    current_time = time.time()

    # Return queued violations from previous batches first.
    if _pending_violations:
        pv = _pending_violations.pop(0)
        print(f"📋 Returning queued violation for ID {pv['track_id']} (queue: {len(_pending_violations)})")
        return pv

    # Cleanup stale state.
    prune_old_entries(reported_violators, current_time, CLEANING_TIME_SECONDS)
    prune_old_entries(reported_plates, current_time, CLEANING_TIME_SECONDS)
    for k in [k for k, v in list(approaching_vehicles.items())
              if current_time - v[1] > APPROACH_EXPIRY_SECONDS]:
        del approaching_vehicles[k]

    # Skip the batch unless there's a red light here, OR a prior approacher
    # under red waiting for its cross-batch crossing to land.
    has_red_in_batch = _batch_has_red_light(batch_analysis)
    has_prior_red_approachers = any(had_red for had_red, _ in approaching_vehicles.values())
    if not has_red_in_batch and not has_prior_red_approachers:
        print("⏩ No red light and no prior red approachers — skipping.")
        return {"violation": False}

    # Resolve the stop line for this batch (real or cached, no guesses).
    stop_line_polygons = _resolve_batch_stop_line(batch_analysis, current_time)
    if stop_line_polygons is None:
        print("⏩ No stop line available — skipping.")
        return {"violation": False}

    vehicle_history = _build_vehicle_history(batch_analysis, image_height)

    confirmed = []
    for tid, history in vehicle_history.items():
        coords = history["coords"]

        if _is_oncoming(coords):
            continue

        # Strategy 1: same-batch crossing.
        crossing_frame_idx = _detect_same_batch_crossing(coords, stop_line_polygons)
        crossing_kind = "same-batch" if crossing_frame_idx >= 0 else None
        prev_had_red = False

        # Strategy 2: cross-batch crossing.
        if crossing_frame_idx < 0:
            crossing_frame_idx, prev_had_red = _detect_cross_batch_crossing(
                tid, coords, stop_line_polygons
            )
            if crossing_frame_idx >= 0:
                crossing_kind = "cross-batch"

        # Always update approaching state, regardless of crossing outcome.
        _update_approaching(tid, coords, stop_line_polygons, has_red_in_batch, current_time)

        if crossing_frame_idx < 0:
            continue

        # The crossing must happen under a red light: either right now or
        # at the moment we last saw the car approaching.
        if not (has_red_in_batch or prev_had_red):
            continue

        # Plate-based dedup (with track_id fallback when plate unreadable).
        plate = extract_license_plate(history, batch_analysis, frames, lpr_model)
        if not should_report_violation(tid, plate, current_time, reported_violators, reported_plates):
            continue

        approaching_vehicles.pop(tid, None)
        print(f"🏆 RED LIGHT VIOLATION: ID {tid} ({crossing_kind}, plate={plate or 'N/A'})")

        confirmed.append({
            "violation": True,
            "type": "Red Light Violation",
            "track_id": tid,
            "license_plate": plate,
            "last_violation_frame": history["frames"][crossing_frame_idx],
        })

    if not confirmed:
        print("✅ No red light violations in this batch.")
        return {"violation": False}

    first = confirmed[0]
    for extra in confirmed[1:]:
        _pending_violations.append(extra)
        print(f"📋 Queued violation for ID {extra['track_id']} (pending: {len(_pending_violations)})")
    return first
