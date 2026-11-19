import os
import pickle
import time
import urllib.request
import cv2
import numpy as np

# Storage path for database and models
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

# SFace cosine similarity threshold (recommended by OpenCV: 0.363)
COSINE_SIMILARITY_THRESHOLD = 0.363


def download_file(url, target_path):
    """
    Download a file from a URL with browser User-Agent header.
    """
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    print(f"Downloading model to {target_path} ...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as response, open(target_path, "wb") as out_file:
        out_file.write(response.read())
    print("Download completed.")


def ensure_models_exist():
    """
    Ensure the YuNet detector and SFace recognizer model weights are downloaded.
    """
    if not os.path.exists(YUNET_MODEL_PATH):
        download_file(YUNET_URL, YUNET_MODEL_PATH)
    if not os.path.exists(SFACE_MODEL_PATH):
        download_file(SFACE_URL, SFACE_MODEL_PATH)


def load_known_faces():
    """
    Load registered face features and names from disk.
    """
    if os.path.exists(DB_FILE):
        with open(DB_FILE, "rb") as f:
            return pickle.load(f)
    return {"names": [], "features": []}


def save_known_faces(data):
    """
    Save registered face features and names to disk.
    """
    with open(DB_FILE, "wb") as f:
        pickle.dump(data, f)


def draw_registration_modal(frame, input_name):
    """
    Draw an interactive on-screen modal directly inside the OpenCV window.
    """
    h, w = frame.shape[:2]

    # Modal dimensions
    modal_w, modal_h = 500, 160
    x1 = (w - modal_w) // 2
    y1 = (h - modal_h) // 2
    x2, y2 = x1 + modal_w, y1 + modal_h

    # Semi-transparent overlay background
    overlay = frame.copy()
    cv2.rectangle(overlay, (x1, y1), (x2, y2), (30, 30, 30), cv2.FILLED)
    cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)

    # Modal border
    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 255), 2)

    # Modal title
    cv2.putText(
        frame,
        "REGISTER NEW FACE",
        (x1 + 20, y1 + 35),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.75,
        (0, 255, 255),
        2,
    )

    # Input box
    box_y = y1 + 55
    cv2.rectangle(
        frame, (x1 + 20, box_y), (x2 - 20, box_y + 40), (255, 255, 255), cv2.FILLED
    )
    cv2.rectangle(frame, (x1 + 20, box_y), (x2 - 20, box_y + 40), (0, 0, 0), 1)

    # Display typed text with a blinking cursor
    cursor = "_" if int(time.time() * 2) % 2 == 0 else ""
    display_text = input_name + cursor
    cv2.putText(
        frame,
        display_text,
        (x1 + 30, box_y + 28),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (0, 0, 0),
        2,
    )

    # Instructions
    cv2.putText(
        frame,
        "[Enter] Save  |  [Esc] Cancel  |  [Backspace] Delete",
        (x1 + 20, y2 - 20),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.48,
        (200, 200, 200),
        1,
    )


def main():
    ensure_models_exist()

    # Initialize OpenCV Face Detector (YuNet) and Recognizer (SFace)
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
    print(f"Loaded {len(face_db['names'])} registered user(s).")

    # Start webcam capture
    video_capture = cv2.VideoCapture(0)
    if not video_capture.isOpened():
        print("Error: Unable to open webcam. Please grant camera permission.")
        return

    frame_width = int(video_capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(video_capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    detector.setInputSize((frame_width, frame_height))

    # Application state: 'RECOGNIZE' or 'REGISTER'
    app_state = "RECOGNIZE"
    input_name = ""
    captured_face = None
    captured_frame = None

    status_message = "Press 'r': Register | 'q': Quit"
    status_color = (255, 255, 255)
    status_time = time.time()

    while True:
        ret, frame = video_capture.read()
        if not ret:
            print("Failed to receive video frame.")
            break

        if app_state == "RECOGNIZE":
            # Detect faces in current frame
            _, faces = detector.detect(frame)

            if faces is not None:
                for face in faces:
                    # Bounding box coordinates: [x, y, w, h]
                    box = face[0:4].astype(np.int32)
                    x, y, w, h = box[0], box[1], box[2], box[3]

                    # Align and extract 128-d feature
                    aligned_face = recognizer.alignCrop(frame, face)
                    feature = recognizer.feature(aligned_face)

                    name = "Unknown"
                    best_score = 0.0

                    if len(face_db["features"]) > 0:
                        for reg_name, reg_feature in zip(
                            face_db["names"], face_db["features"]
                        ):
                            score = recognizer.match(
                                feature, reg_feature, cv2.FaceRecognizerSF_FR_COSINE
                            )
                            if score > best_score:
                                best_score = score
                                if score >= COSINE_SIMILARITY_THRESHOLD:
                                    name = reg_name

                    box_color = (0, 255, 0) if name != "Unknown" else (0, 0, 255)
                    cv2.rectangle(frame, (x, y), (x + w, y + h), box_color, 2)

                    label = f"{name}"
                    if name != "Unknown":
                        label += f" ({best_score:.2f})"

                    # Draw text background
                    cv2.rectangle(
                        frame,
                        (x, y - 28),
                        (x + len(label) * 11, y),
                        box_color,
                        cv2.FILLED,
                    )
                    cv2.putText(
                        frame,
                        label,
                        (x + 5, y - 8),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.5,
                        (255, 255, 255),
                        1,
                    )

            # Reset status message after 3 seconds
            if time.time() - status_time > 3.0:
                status_message = "Press 'r': Register | 'q': Quit"
                status_color = (255, 255, 255)

            # Display top banner status
            cv2.putText(
                frame,
                status_message,
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                status_color,
                2,
            )

        elif app_state == "REGISTER":
            # In register state: draw the captured frame and render interactive modal
            frame = captured_frame.copy()
            draw_registration_modal(frame, input_name)

        cv2.imshow("Face Recognition Demo (OpenCV YuNet + SFace)", frame)

        # Handle keyboard input
        key = cv2.waitKey(20) & 0xFF

        if app_state == "RECOGNIZE":
            if key == ord("r"):
                # Detect face on current frame before switching to registration
                _, faces = detector.detect(frame)
                if faces is None or len(faces) == 0:
                    status_message = "No face detected! Look at camera and press 'r'"
                    status_color = (0, 0, 255)
                    status_time = time.time()
                elif len(faces) > 1:
                    status_message = "Multiple faces! Only 1 person can register"
                    status_color = (0, 0, 255)
                    status_time = time.time()
                else:
                    captured_face = faces[0]
                    captured_frame = frame.copy()
                    input_name = ""
                    app_state = "REGISTER"

            elif key == ord("q"):
                break

        elif app_state == "REGISTER":
            # Enter key (13 or 10): Confirm and save
            if key in (13, 10):
                final_name = input_name.strip()
                if final_name:
                    aligned_face = recognizer.alignCrop(captured_frame, captured_face)
                    feature = recognizer.feature(aligned_face)

                    face_db["names"].append(final_name)
                    face_db["features"].append(feature)
                    save_known_faces(face_db)

                    status_message = (
                        f"Success: Registered '{final_name}'! Total: {len(face_db['names'])}"
                    )
                    status_color = (0, 255, 0)
                else:
                    status_message = "Registration canceled: Empty name"
                    status_color = (0, 165, 255)

                status_time = time.time()
                app_state = "RECOGNIZE"

            # Escape key (27): Cancel registration
            elif key == 27:
                status_message = "Registration canceled"
                status_color = (0, 165, 255)
                status_time = time.time()
                app_state = "RECOGNIZE"

            # Backspace / Delete key (8 or 127): Delete character
            elif key in (8, 127):
                input_name = input_name[:-1]

            # Printable characters (A-Z, a-z, 0-9, space, hyphen, etc.)
            elif 32 <= key <= 126:
                if len(input_name) < 25:
                    input_name += chr(key)

    video_capture.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
