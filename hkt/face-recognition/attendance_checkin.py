from datetime import datetime
import os
import pickle
import time
import urllib.request
import cv2
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
DB_FILE = os.path.join(BASE_DIR, "face_database.pkl")
LOG_FILE = os.path.join(BASE_DIR, "attendance_history.csv")

YUNET_MODEL_PATH = os.path.join(MODELS_DIR, "face_detection_yunet.onnx")
SFACE_MODEL_PATH = os.path.join(MODELS_DIR, "face_recognition_sface.onnx")

YUNET_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/"
    "face_detection_yunet/face_detection_yunet_2023mar.onnx"
)
SFACE_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/"
    "face_recognition_sface/face_recognition_sface_2021dec.onnx"
)

COSINE_SIMILARITY_THRESHOLD = 0.363
REQUIRED_DWELL_SECONDS = 3.0
COOLDOWN_SECONDS = 2.0  # Cooldown updated to 2 seconds


def ensure_models_exist():
    os.makedirs(MODELS_DIR, exist_ok=True)
    for model_path, url in [
        (YUNET_MODEL_PATH, YUNET_URL),
        (SFACE_MODEL_PATH, SFACE_URL),
    ]:
        if not os.path.exists(model_path):
            print(f"Downloading {os.path.basename(model_path)}...")
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req) as resp, open(
                model_path, "wb"
            ) as out_file:
                out_file.write(resp.read())


def load_known_faces():
    if os.path.exists(DB_FILE):
        with open(DB_FILE, "rb") as f:
            return pickle.load(f)
    return {"names": [], "features": []}


def record_attendance(name, score):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    header_needed = not os.path.exists(LOG_FILE)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        if header_needed:
            f.write("ThoiGian,HoTen,DoChinhXac\n")
        f.write(f'"{timestamp}","{name}",{score:.2f}\n')


def main():
    ensure_models_exist()

    detector = cv2.FaceDetectorYN.create(
        model=YUNET_MODEL_PATH,
        config="",
        input_size=(320, 320),
        score_threshold=0.6,
        nms_threshold=0.3,
        top_k=5000,
    )
    recognizer = cv2.FaceRecognizerSF.create(model=SFACE_MODEL_PATH, config="")

    face_db = load_known_faces()
    print(f"Phase 2: Loaded {len(face_db['names'])} registered users.")

    video_capture = cv2.VideoCapture(0)
    if not video_capture.isOpened():
        print("Error: Cannot open camera.")
        return

    frame_width = int(video_capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(video_capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    detector.setInputSize((frame_width, frame_height))

    # Tracking dwell time
    tracking_name = None
    dwell_start_time = None

    # Cooldown tracker
    cooldown_map = {}
    active_announcement = None

    print("\n" + "=" * 60)
    print("🚀 Auto-Scan Attendance running:")
    print(" - Look at camera continuously for 3.0s to trigger check-in")
    print(" - Cooldown: 2.0s")
    print(" - Press 'q' to quit")
    print("=" * 60 + "\n")

    while True:
        ret, frame = video_capture.read()
        if not ret:
            break

        h, w = frame.shape[:2]
        _, faces = detector.detect(frame)

        current_time = time.time()
        detected_valid_face = False
        current_matched_name = None
        current_score = 0.0

        if faces is not None:
            for face in faces:
                box = face[0:4].astype(np.int32)
                x, y, bw, bh = box[0], box[1], box[2], box[3]

                aligned_face = recognizer.alignCrop(frame, face)
                feature = recognizer.feature(aligned_face)

                highest_score = 0.0
                matched_name = None

                if len(face_db["features"]) > 0:
                    for reg_name, reg_feature in zip(
                        face_db["names"], face_db["features"]
                    ):
                        score = recognizer.match(
                            feature, reg_feature, cv2.FaceRecognizerSF_FR_COSINE
                        )
                        if score > highest_score:
                            highest_score = score
                            if score >= COSINE_SIMILARITY_THRESHOLD:
                                matched_name = reg_name

                if matched_name:
                    detected_valid_face = True
                    current_matched_name = matched_name
                    current_score = highest_score

                    box_color = (0, 255, 0)
                    cv2.rectangle(frame, (x, y), (x + bw, y + bh), box_color, 2)
                    tag = f"{matched_name} ({highest_score:.2f})"
                    cv2.putText(
                        frame,
                        tag,
                        (x + 5, y - 10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        box_color,
                        2,
                    )
                else:
                    cv2.rectangle(frame, (x, y), (x + bw, y + bh), (0, 0, 255), 2)
                    cv2.putText(
                        frame,
                        "Chua dang ky",
                        (x + 5, y - 10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.55,
                        (0, 0, 255),
                        1,
                    )

        # Handle 3-second Dwell Time State Machine
        if detected_valid_face and current_matched_name:
            # Check 2-second cooldown
            if (
                current_matched_name in cooldown_map
                and current_time < cooldown_map[current_matched_name]
            ):
                remaining = cooldown_map[current_matched_name] - current_time
                cv2.putText(
                    frame,
                    f"[{current_matched_name}] Lam nguoi con {remaining:.1f}s",
                    (20, h - 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (200, 200, 200),
                    2,
                )
                tracking_name = None
                dwell_start_time = None
            else:
                if tracking_name == current_matched_name:
                    elapsed = current_time - dwell_start_time

                    # Trigger Attendance when reached 3.0 seconds
                    if elapsed >= REQUIRED_DWELL_SECONDS:
                        record_attendance(current_matched_name, current_score)
                        print(
                            f"[TRIGGER CHECK-IN] {datetime.now().strftime('%H:%M:%S')} - {current_matched_name} (Stood for 3s)"
                        )

                        active_announcement = {
                            "name": current_matched_name,
                            "time_str": datetime.now().strftime("%H:%M:%S"),
                            "expires": current_time + 2.5,
                        }
                        # Cooldown set to 2.0s
                        cooldown_map[current_matched_name] = (
                            current_time + COOLDOWN_SECONDS
                        )
                        tracking_name = None
                        dwell_start_time = None
                else:
                    tracking_name = current_matched_name
                    dwell_start_time = current_time
        else:
            tracking_name = None
            dwell_start_time = None

        # Top status banner
        cv2.rectangle(frame, (0, 0), (w, 45), (35, 35, 35), cv2.FILLED)
        cv2.putText(
            frame,
            "AUTO-SCAN KIOSK: DUNG YEN 3S DE DIEM DANH",
            (20, 28),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (0, 255, 255),
            2,
        )

        # Success modal card
        if active_announcement and current_time < active_announcement["expires"]:
            banner_w, banner_h = 540, 110
            bx1 = (w - banner_w) // 2
            by1 = 60
            bx2, by2 = bx1 + banner_w, by1 + banner_h

            cv2.rectangle(
                frame, (bx1, by1), (bx2, by2), (255, 255, 255), cv2.FILLED
            )
            cv2.rectangle(frame, (bx1, by1), (bx2, by2), (0, 200, 0), 4)

            cv2.putText(
                frame,
                "✓ DIEM DANH THANH CONG!",
                (bx1 + 20, by1 + 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.85,
                (0, 150, 0),
                3,
            )
            cv2.putText(
                frame,
                f"Xin chao: {active_announcement['name']} (Da dung du 3s)",
                (bx1 + 20, by1 + 75),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 0, 0),
                2,
            )

        cv2.imshow("Auto-Scan Kiosk (3s Trigger)", frame)

        key = cv2.waitKey(20) & 0xFF
        if key == 27 or key == ord("q"):
            break

    video_capture.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
