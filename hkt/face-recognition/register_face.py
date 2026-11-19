import os
import pickle
import time
import urllib.request
import cv2
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
DB_FILE = os.path.join(BASE_DIR, "face_database.pkl")

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


def ensure_models_exist():
    """
    Ensure the YuNet and SFace model files are downloaded.
    """
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
            print("Download completed.")


def load_known_faces():
    """
    Load stored face encodings and names.
    """
    if os.path.exists(DB_FILE):
        with open(DB_FILE, "rb") as f:
            return pickle.load(f)
    return {"names": [], "features": []}


def save_known_faces(data):
    """
    Persist face encodings and names to disk.
    """
    with open(DB_FILE, "wb") as f:
        pickle.dump(data, f)


def main():
    ensure_models_exist()

    # Initialize OpenCV AI models
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

    video_capture = cv2.VideoCapture(0)
    if not video_capture.isOpened():
        print("Error: Cannot access webcam.")
        return

    frame_width = int(video_capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(video_capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    detector.setInputSize((frame_width, frame_height))

    input_name = ""
    status_msg = "Type name on keyboard, then press [ENTER] to save"
    status_color = (255, 255, 255)
    last_saved_time = 0

    print("Phase 1: Registration Mode running...")

    while True:
        ret, frame = video_capture.read()
        if not ret:
            break

        h, w = frame.shape[:2]
        _, faces = detector.detect(frame)

        # Draw detected face boxes
        detected_one_face = False
        target_face = None

        if faces is not None:
            if len(faces) == 1:
                detected_one_face = True
                target_face = faces[0]
                box = target_face[0:4].astype(np.int32)
                x, y, bw, bh = box[0], box[1], box[2], box[3]
                cv2.rectangle(frame, (x, y), (x + bw, y + bh), (0, 255, 255), 2)
                cv2.putText(
                    frame,
                    "Ready to Register",
                    (x, y - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (0, 255, 255),
                    2,
                )
            else:
                for face in faces:
                    box = face[0:4].astype(np.int32)
                    cv2.rectangle(
                        frame,
                        (box[0], box[1]),
                        (box[0] + box[2], box[1] + box[3]),
                        (0, 0, 255),
                        2,
                    )
                cv2.putText(
                    frame,
                    "Keep ONLY 1 person in frame",
                    (30, 80),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 0, 255),
                    2,
                )

        # Render top header bar
        cv2.rectangle(frame, (0, 0), (w, 60), (40, 40, 40), cv2.FILLED)
        cv2.putText(
            frame,
            "PHASE 1: DANG KY KHUON MAT",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 255),
            2,
        )
        registered_count_str = f"Da luu: {len(face_db['names'])} nguoi"
        cv2.putText(
            frame,
            registered_count_str,
            (w - 240, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (200, 200, 200),
            1,
        )

        # Render bottom input panel
        panel_h = 100
        cv2.rectangle(frame, (0, h - panel_h), (w, h), (30, 30, 30), cv2.FILLED)

        # Draw text input box
        cv2.rectangle(
            frame, (20, h - panel_h + 15), (w - 20, h - 35), (255, 255, 255), cv2.FILLED
        )
        cursor = "_" if int(time.time() * 2) % 2 == 0 else ""
        prompt_prefix = "Nhap ten: "
        cv2.putText(
            frame,
            prompt_prefix + input_name + cursor,
            (30, h - panel_h + 45),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.75,
            (0, 0, 0),
            2,
        )

        # Draw status / guide text
        if time.time() - last_saved_time > 4.0:
            status_msg = "[Enter] Luu mat  |  [Backspace] Xoa  |  [Esc / q] Thoat"
            status_color = (180, 180, 180)

        cv2.putText(
            frame,
            status_msg,
            (25, h - 12),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            status_color,
            1,
        )

        cv2.imshow("Phase 1 - Dang Ky Khuon Mat", frame)
        key = cv2.waitKey(20) & 0xFF

        # Esc or 'q' to quit when input is empty
        if key == 27 or (key == ord("q") and len(input_name) == 0):
            break

        # Enter key to confirm registration
        elif key in (13, 10):
            name_clean = input_name.strip()
            if not name_clean:
                status_msg = "Loi: Vui long nhap ten truoc khi an Enter!"
                status_color = (0, 0, 255)
                last_saved_time = time.time()
            elif not detected_one_face:
                status_msg = "Loi: Chua tim thay khuon mat truoc camera!"
                status_color = (0, 0, 255)
                last_saved_time = time.time()
            else:
                # Align and extract embedding
                aligned_face = recognizer.alignCrop(frame, target_face)
                feature = recognizer.feature(aligned_face)

                face_db["names"].append(name_clean)
                face_db["features"].append(feature)
                save_known_faces(face_db)

                status_msg = f"THANH CONG: Da luu khuon mat cho '{name_clean}'!"
                status_color = (0, 255, 0)
                last_saved_time = time.time()
                input_name = ""

        # Backspace / Delete
        elif key in (8, 127):
            input_name = input_name[:-1]

        # Printable characters
        elif 32 <= key <= 126:
            if len(input_name) < 30:
                input_name += chr(key)

    video_capture.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

