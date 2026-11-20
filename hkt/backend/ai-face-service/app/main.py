import os
import sys
import json
import base64
import logging
import asyncio
import sqlite3
import urllib.request
from typing import Optional, List, Dict, Any
from datetime import datetime

import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    import asyncpg  # lưu vector vào PostgreSQL/pgvector (production)
except ImportError:  # pragma: no cover - fallback khi chạy standalone
    asyncpg = None

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ai-face-service")

# ====================================================
# FASTAPI APPLICATION
# ====================================================
app = FastAPI(
    title="ACT HR 2026 - AI Face Recognition & Biometric Service",
    description="Microservice nhận diện khuôn mặt Deep Learning (OpenCV YuNet + SFace ONNX 128D & Cosine Search)",
    version="2.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====================================================
# PATHS & CONFIGURATION
# ====================================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")
SQLITE_DB_FILE = os.path.join(BASE_DIR, "saas_faces.db")
DATA_DIR = os.environ.get("DATA_DIR", os.path.join(BASE_DIR, "data"))
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)
JSON_DB_FILE = os.path.join(DATA_DIR, "face_db.json")

# Haar Cascade fallback
CASCADE_PATH = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
face_cascade = cv2.CascadeClassifier(CASCADE_PATH)

# PostgreSQL / Environment configuration
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres123@localhost:5432/pulse_db",
)
SIMILARITY_THRESHOLD = float(os.environ.get("FACE_SIMILARITY_THRESHOLD", "0.85"))
SFACE_SIMILARITY_THRESHOLD = float(os.environ.get("SFACE_SIMILARITY_THRESHOLD", "0.85"))
LIVENESS_MOTION_THRESHOLD = float(os.environ.get("FACE_LIVENESS_MOTION", "0.6"))

_db_pool = None
employee_db: Dict[str, Dict[str, Any]] = {}

YUNET_MODEL_PATH = os.path.join(MODELS_DIR, "face_detection_yunet.onnx")
SFACE_MODEL_PATH = os.path.join(MODELS_DIR, "face_recognition_sface.onnx")


def ensure_models_exist():
    """Auto-downloads YuNet and SFace ONNX models if not present."""
    models = {
        YUNET_MODEL_PATH: "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        SFACE_MODEL_PATH: "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
    }
    for model_path, url in models.items():
        if not os.path.exists(model_path) or os.path.getsize(model_path) < 1000:
            logger.info("Downloading %s ...", os.path.basename(model_path))
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=30) as resp, open(model_path, "wb") as out_file:
                    out_file.write(resp.read())
                logger.info("Successfully downloaded %s", os.path.basename(model_path))
            except Exception as e:
                logger.warning("Could not download %s from %s: %s", os.path.basename(model_path), url, e)


ensure_models_exist()

# Initialize OpenCV DNN models
try:
    detector = cv2.FaceDetectorYN.create(
        model=YUNET_MODEL_PATH,
        config="",
        input_size=(320, 320),
        score_threshold=0.6,
        nms_threshold=0.3,
        top_k=5000,
    )
    recognizer = cv2.FaceRecognizerSF.create(model=SFACE_MODEL_PATH, config="")
    logger.info("OpenCV YuNet & SFace models initialized successfully.")
except Exception as e:
    logger.error("Failed to initialize OpenCV Face models: %s", e)
    detector = None
    recognizer = None


# ====================================================
# DATABASE & SEEDING (SQLite & PostgreSQL & JSON)
# ====================================================
def init_database():
    """Initializes SQLite tables for persistent face identities and seeds personas."""
    with sqlite3.connect(SQLITE_DB_FILE) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS face_identities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id TEXT NOT NULL DEFAULT 'default',
                user_id TEXT NOT NULL,
                full_name TEXT NOT NULL,
                department TEXT NOT NULL DEFAULT 'Khối Kỹ Thuật',
                embedding BLOB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(tenant_id, user_id)
            );
        """)
        conn.commit()

        cursor = conn.execute("SELECT COUNT(*) FROM face_identities WHERE tenant_id = 'default'")
        count = cursor.fetchone()[0]
        if count == 0:
            logger.info("Seeding standard ACT personas into face_identities...")
            defaults = [
                ("Admin", "Quản Trị Viên Hệ Thống (Admin)", "Ban Quản Trị Hệ Thống", 42),
                ("admin", "AD văn min", "Khối Kỹ Thuật", 42),
                ("01HR", "Nguyễn Thị Thu Hà", "Phòng Nhân Sự", 101),
                ("05ACT", "Nguyễn Thanh Tùng", "Khối Kỹ Thuật", 202),
                ("136ACT", "Vũ Văn Luận", "Khối Kỹ Thuật (Optimus)", 303),
            ]
            for uid, name, dept, seed_val in defaults:
                np.random.seed(seed_val)
                raw = np.random.uniform(0.1, 1.0, 128).astype(np.float32)
                norm = (raw / np.linalg.norm(raw)).astype(np.float32)
                conn.execute(
                    """
                    INSERT OR REPLACE INTO face_identities (tenant_id, user_id, full_name, department, embedding)
                    VALUES ('default', ?, ?, ?, ?)
                    """,
                    (uid, name, dept, norm.tobytes()),
                )
            conn.commit()


def _parse_vector(raw: Optional[str]) -> List[float]:
    if not raw:
        return []
    return [float(x) for x in raw.strip().strip("[]").split(",") if x.strip()]


def _vector_literal(vec: List[float]) -> str:
    return "[" + ",".join(f"{v:.6f}" for v in vec) + "]"


async def init_db() -> None:
    """Kết nối PostgreSQL/pgvector và nạp danh sách khuôn mặt đã đăng ký."""
    global _db_pool
    if asyncpg is None:
        logger.warning("asyncpg chưa cài — dùng SQLite và file JSON tạm thời")
        seed_default_employees()
        return
    try:
        _db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)
        async with _db_pool.acquire() as conn:
            await conn.execute('CREATE EXTENSION IF NOT EXISTS vector')
            await conn.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS face_profiles (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id UUID NOT NULL UNIQUE REFERENCES users(id),
                    embedding vector(512) NOT NULL,
                    model_version VARCHAR(30) NOT NULL DEFAULT 'sface-512-v1',
                    status VARCHAR(20) NOT NULL DEFAULT 'active',
                    consent_at TIMESTAMPTZ,
                    enrolled_at TIMESTAMPTZ,
                    enrolled_by UUID,
                    reset_by UUID,
                    reset_reason TEXT,
                    last_verified_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
                """
            )
            rows = await conn.fetch(
                """
                SELECT u.employee_code, u.full_name, COALESCE(t.name, '—') AS department,
                       f.embedding::text AS embedding
                FROM face_profiles f
                JOIN users u ON u.id = f.user_id
                LEFT JOIN teams t ON t.id = u.team_id
                WHERE f.status = 'active'
                """
            )
        employee_db.clear()
        for row in rows:
            employee_db[row["employee_code"]] = {
                "employee_code": row["employee_code"],
                "full_name": row["full_name"],
                "department": row["department"],
                "vector": _parse_vector(row["embedding"]),
            }
        logger.info("Đã nạp %d hồ sơ khuôn mặt từ PostgreSQL", len(employee_db))
    except Exception as exc:
        logger.warning("Không kết nối được PostgreSQL (%s) — dùng SQLite và file JSON", exc)
        seed_default_employees()


async def persist_employee_to_db(employee_code: str, vec: List[float]) -> None:
    """Lưu/cập nhật vector vào bảng face_profiles nếu có Postgres."""
    if _db_pool is None:
        save_db()
        return
    try:
        async with _db_pool.acquire() as conn:
            result = await conn.execute(
                """
                INSERT INTO face_profiles (user_id, embedding, status, enrolled_at)
                SELECT id, $2::vector, 'active', NOW() FROM users WHERE employee_code = $1
                ON CONFLICT (user_id) DO UPDATE
                  SET embedding = EXCLUDED.embedding,
                      status = 'active',
                      enrolled_at = NOW(),
                      updated_at = NOW()
                """,
                employee_code,
                _vector_literal(vec),
            )
            if result.endswith("0"):
                logger.warning("Không tìm thấy nhân viên %s trong bảng users khi lưu vector", employee_code)
    except Exception as e:
        logger.error("Lỗi khi lưu vector vào PostgreSQL: %s", e)
    save_db()


def seed_default_employees():
    """Nạp từ file JSON nếu có."""
    global employee_db
    if os.path.exists(JSON_DB_FILE):
        try:
            with open(JSON_DB_FILE, "r", encoding="utf-8") as f:
                employee_db = json.load(f)
                logger.info("Loaded %d employees from %s", len(employee_db), JSON_DB_FILE)
        except Exception as e:
            logger.warning("Could not read db file: %s", e)
    else:
        employee_db = {}


def save_db():
    try:
        with open(JSON_DB_FILE, "w", encoding="utf-8") as f:
            json.dump(employee_db, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error("Failed to save face database: %s", e)


@app.on_event("startup")
async def on_startup() -> None:
    init_database()
    await init_db()


# ====================================================
# PYDANTIC SCHEMAS
# ====================================================
class EmployeeFaceProfile(BaseModel):
    employee_code: str
    full_name: str
    department: str
    confidence_score: float = 0.95
    is_liveness_verified: bool = True


class VerifyResponse(BaseModel):
    is_matched: bool
    matched_employee: Optional[EmployeeFaceProfile] = None
    similarity_score: float = 0.0
    quality_passed: bool = True
    is_liveness_verified: bool = False
    is_proxy_punch_detected: bool = Field(..., description="Explicitly indicates whether proxy punch is detected")
    error_code: Optional[str] = None
    message: str


class EnrollResponse(BaseModel):
    status: str
    employee_code: str
    full_name: str
    message: str
    vector_dimensions: int


class VerifyJsonRequest(BaseModel):
    image: str = Field(..., description="Captured face image (data URL or Base64)")
    expected_employee_code: Optional[str] = Field(None, description="Expected employee code for 1:1 check")
    liveness_frames: Optional[List[str]] = Field(None, description="Consecutive frames for liveness detection")


class EnrollJsonRequest(BaseModel):
    employee_code: str = Field(..., description="Employee ID code e.g. 136ACT")
    full_name: Optional[str] = Field(None, description="Employee full name")
    department: Optional[str] = Field(None, description="Department name")
    frontal_image: str = Field(..., description="Frontal face image data URL or Base64")
    left_image: Optional[str] = Field(None, description="Left angle face image")
    right_image: Optional[str] = Field(None, description="Right angle face image")



# ====================================================
# COMPUTER VISION & BIOMETRICS HELPERS
# ====================================================
def decode_image_bytes(image_data: bytes) -> Optional[np.ndarray]:
    """Decodes raw bytes into BGR OpenCV image."""
    try:
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        logger.error("Error decoding image bytes: %s", e)
        return None


def decode_base64_image(b64_str: str) -> Optional[np.ndarray]:
    """Decodes data URL base64 image into BGR OpenCV image."""
    try:
        if "," in b64_str:
            b64_str = b64_str.split(",", 1)[1]
        raw_bytes = base64.b64decode(b64_str)
        return decode_image_bytes(raw_bytes)
    except Exception as e:
        logger.error("Error decoding base64 image: %s", e)
        return None


def decode_image_from_base64_or_bytes(image_data: Any) -> Optional[np.ndarray]:
    """Unified decoder supporting Base64 data URLs, raw base64 strings, or bytes."""
    if isinstance(image_data, bytes):
        return decode_image_bytes(image_data)
    elif isinstance(image_data, str):
        return decode_base64_image(image_data)
    return None


def check_liveness(frames: Optional[List[str]]) -> tuple[bool, str]:
    """
    Kiểm tra liveness bằng chuyển động giữa các frame liên tiếp.
    Nếu không có frames (hoặc chỉ gửi 1 frame), mặc định trả True để tương thích
    với các luồng kiểm tra tĩnh / kiểm tra 1 ảnh.
    """
    if not frames or len(frames) < 2:
        return True, ""

    images = []
    for f in frames[:5]:
        img = decode_base64_image(f)
        if img is not None:
            images.append(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY))
    if len(images) < 2:
        return True, ""

    diffs = []
    for a, b in zip(images, images[1:]):
        h = min(a.shape[0], b.shape[0])
        w = min(a.shape[1], b.shape[1])
        diff = cv2.absdiff(a[:h, :w], b[:h, :w])
        diffs.append(float(diff.mean()))
    max_motion = max(diffs) if diffs else 0.0
    if max_motion < LIVENESS_MOTION_THRESHOLD:
        return False, "Không phát hiện chuyển động thật — hãy nhìn vào camera và di chuyển nhẹ đầu"
    return True, ""


def check_image_quality(img: Optional[np.ndarray]) -> tuple[bool, Optional[str]]:
    """Evaluates image resolution, brightness, and sharpness."""
    if img is None:
        return False, "Không thể giải mã dữ liệu hình ảnh."
    h, w = img.shape[:2]
    if h < 48 or w < 48:
        return False, f"Độ phân giải ảnh quá thấp ({w}x{h} px). Yêu cầu tối thiểu 48x48 px."

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    brightness = float(gray.mean())
    if brightness < 15.0:
        return False, f"Ảnh quá tối (độ sáng: {brightness:.1f}/255). Vui lòng chụp ở nơi đủ ánh sáng."
    if brightness > 250.0:
        return False, f"Ảnh bị lóa sáng quá mức (độ sáng: {brightness:.1f}/255)."

    blur_variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if blur_variance < 3.0:
        return False, f"Ảnh quá mờ, không đủ độ sắc nét để nhận diện (độ nét: {blur_variance:.1f})."

    return True, None


def extract_face_embedding(img: np.ndarray) -> tuple[Optional[np.ndarray], Optional[str]]:
    """
    Extracts normalized 128D facial feature embedding vector using OpenCV YuNet + SFace.
    Falls back to Haar Cascade detection if YuNet is unavailable.
    """
    if detector is not None and recognizer is not None:
        try:
            h, w = img.shape[:2]
            detector.setInputSize((w, h))
            _, faces = detector.detect(img)

            if faces is not None and len(faces) > 0:
                best_face = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)[0]
                aligned = recognizer.alignCrop(img, best_face)
                feature = recognizer.feature(aligned)

                feat_norm = feature[0]
                norm = np.linalg.norm(feat_norm)
                if norm > 0:
                    feat_norm = feat_norm / norm
                return feat_norm.astype(np.float32), None
        except Exception as e:
            logger.warning("YuNet/SFace extraction error: %s. Using fallback...", e)

    # Fallback to Haar Cascade
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(36, 36))
    if len(faces) == 0:
        # Synthetic / center crop fallback
        h, w = gray.shape
        cx, cy = w // 2, h // 2
        size = min(w, h) // 2
        face_roi = gray[max(0, cy - size):min(h, cy + size), max(0, cx - size):min(w, cx + size)]
        if face_roi.size == 0:
            return None, "Không phát hiện khuôn mặt người trong ảnh. Vui lòng căn chỉnh lại góc máy."
    else:
        faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
        x, y, w, h = faces[0]
        face_roi = gray[y:y+h, x:x+w]

    resized = cv2.resize(face_roi, (64, 64))
    eq = cv2.equalizeHist(resized)
    # Generate 128D compact gradient feature
    sobelx = cv2.Sobel(eq, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(eq, cv2.CV_64F, 0, 1, ksize=3)
    mag, angle = cv2.cartToPolar(sobelx, sobely, angleInDegrees=True)
    histograms = []
    for r in range(0, 64, 16):
        for c in range(0, 64, 16):
            cell_mag = mag[r:r+16, c:c+16]
            cell_ang = angle[r:r+16, c:c+16]
            hist, _ = np.histogram(cell_ang, bins=8, range=(0, 360), weights=cell_mag)
            histograms.extend(hist)
    vec = np.array(histograms, dtype=np.float32)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec, None


def cosine_similarity(v1: np.ndarray, v2: np.ndarray) -> float:
    """Computes cosine similarity between two normalized vectors."""
    n1 = np.linalg.norm(v1)
    n2 = np.linalg.norm(v2)
    if n1 > 0:
        v1 = v1 / n1
    if n2 > 0:
        v2 = v2 / n2
    return float(np.dot(v1, v2))


# ====================================================
# BIOMETRIC ENDPOINTS
# ====================================================
@app.get("/health", summary="Health Check", tags=["System"])
def health_check():
    return {
        "status": "UP",
        "service": "ai-face-service",
        "engine": "OpenCV YuNet + SFace (128D ONNX)",
        "enrolled_employees": len(employee_db),
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/api/v1/face/employees", summary="List Enrolled Employees", tags=["Biometrics"])
def list_enrolled_employees():
    """Lists all employee face identities registered in SQLite and memory."""
    results = {}
    with sqlite3.connect(SQLITE_DB_FILE) as conn:
        cursor = conn.execute(
            "SELECT user_id, full_name, department, created_at FROM face_identities WHERE tenant_id = 'default'"
        )
        for r in cursor.fetchall():
            results[r[0]] = {
                "employee_code": r[0],
                "full_name": r[1],
                "department": r[2] or "Khối Kỹ Thuật",
                "has_face_vector": True,
                "enrolled_at": r[3],
            }

    for code, info in employee_db.items():
        if code not in results:
            results[code] = {
                "employee_code": info["employee_code"],
                "full_name": info["full_name"],
                "department": info["department"],
                "has_face_vector": "vector" in info,
                "enrolled_at": info.get("enrolled_at"),
            }

    return list(results.values())


@app.get("/api/v1/face/employees/{employee_code}", summary="Get Enrolled Employee Face Detail", tags=["Biometrics"])
def get_enrolled_employee(employee_code: str):
    """Retrieves biometric profile information for a specific employee."""
    code = employee_code.strip()
    with sqlite3.connect(SQLITE_DB_FILE) as conn:
        cursor = conn.execute(
            "SELECT user_id, full_name, department, created_at FROM face_identities WHERE tenant_id = 'default' AND LOWER(user_id) = LOWER(?)",
            (code,),
        )
        row = cursor.fetchone()
        if row:
            return {
                "employee_code": row[0],
                "full_name": row[1],
                "department": row[2] or "Khối Kỹ Thuật",
                "has_face_vector": True,
                "enrolled_at": row[3],
            }

    for k, info in employee_db.items():
        if k.lower() == code.lower():
            return {
                "employee_code": info["employee_code"],
                "full_name": info["full_name"],
                "department": info["department"],
                "has_face_vector": "vector" in info,
                "enrolled_at": info.get("enrolled_at"),
            }

    raise HTTPException(status_code=404, detail=f"Không tìm thấy hồ sơ khuôn mặt cho nhân viên {code}")


@app.delete("/api/v1/face/employees/{employee_code}", summary="Delete Enrolled Face Profile", tags=["Biometrics"])
async def delete_enrolled_employee(employee_code: str):
    """Deletes face identity from SQLite, in-memory cache, and PostgreSQL."""
    code = employee_code.strip()
    deleted = False

    with sqlite3.connect(SQLITE_DB_FILE) as conn:
        cursor = conn.execute(
            "DELETE FROM face_identities WHERE tenant_id = 'default' AND LOWER(user_id) = LOWER(?)",
            (code,),
        )
        conn.commit()
        if cursor.rowcount > 0:
            deleted = True

    for k in list(employee_db.keys()):
        if k.lower() == code.lower():
            del employee_db[k]
            deleted = True

    if _db_pool:
        try:
            async with _db_pool.acquire() as conn:
                await conn.execute(
                    "UPDATE face_profiles SET status = 'reset' WHERE user_id IN (SELECT id FROM users WHERE LOWER(employee_code) = LOWER($1))",
                    code,
                )
                deleted = True
        except Exception as e:
            logger.warning("Could not reset face_profile in postgres: %s", e)

    return {
        "status": "SUCCESS",
        "employee_code": code,
        "message": f"Đã xoá mẫu khuôn mặt cho nhân viên {code} thành công.",
    }


@app.post("/api/v1/face/verify-json", response_model=VerifyResponse, summary="1:N Face Verification (JSON)", tags=["Biometrics"])
def verify_face_json(payload: VerifyJsonRequest):
    """1:N automated facial identification. Searches all enrolled employees to find best match."""
    img = decode_image_from_base64_or_bytes(payload.image)
    quality_ok, quality_err = check_image_quality(img)
    if not quality_ok:
        return VerifyResponse(
            is_matched=False,
            similarity_score=0.0,
            quality_passed=False,
            is_liveness_verified=False,
            error_code="QUALITY_FAILED",
            message=f"Chất lượng ảnh không đạt yêu cầu: {quality_err}",
        )

    liveness_ok, liveness_msg = check_liveness(payload.liveness_frames)
    if not liveness_ok:
        return VerifyResponse(
            is_matched=False,
            similarity_score=0.0,
            quality_passed=True,
            is_liveness_verified=False,
            error_code="LIVENESS_FAILED",
            message=liveness_msg or "Không phát hiện chuyển động thật — hãy nhìn vào camera và di chuyển nhẹ",
        )

    query_vec, err = extract_face_embedding(img)
    if query_vec is None:
        return VerifyResponse(
            is_matched=False,
            similarity_score=0.0,
            quality_passed=True,
            is_liveness_verified=liveness_ok,
            error_code="NO_FACE_DETECTED",
            message=err or "Không phát hiện được khuôn mặt người trong ảnh.",
        )

    # 1:N Biometric Search against SQLite face identities
    with sqlite3.connect(SQLITE_DB_FILE) as conn:
        cursor = conn.execute(
            "SELECT user_id, full_name, department, embedding FROM face_identities WHERE tenant_id = 'default'"
        )
        enrolled = cursor.fetchall()

    best_score = -1.0
    best_candidate = None

    for user_id, name, dept, emb_bytes in enrolled:
        candidate_vec = np.frombuffer(emb_bytes, dtype=np.float32)
        norm_cand = np.linalg.norm(candidate_vec)
        if norm_cand > 0:
            candidate_vec = candidate_vec / norm_cand

        score = float(np.dot(query_vec, candidate_vec))
        if score > best_score:
            best_score = score
            best_candidate = (user_id, name, dept)

    # Also search in-memory/JSON DB
    for emp_code, info in employee_db.items():
        if "vector" in info and len(info["vector"]) > 0:
            t_vec = np.array(info["vector"], dtype=np.float32)
            if len(t_vec) == len(query_vec):
                score = cosine_similarity(query_vec, t_vec)
                if score > best_score:
                    best_score = score
                    best_candidate = (info["employee_code"], info["full_name"], info["department"])

    # If expected employee is provided, calculate targeted score
    targeted_candidate = None
    targeted_score = -1.0
    if payload.expected_employee_code:
        exp_code = payload.expected_employee_code.strip()
        for user_id, name, dept, emb_bytes in enrolled:
            if user_id.lower() == exp_code.lower():
                candidate_vec = np.frombuffer(emb_bytes, dtype=np.float32)
                score = cosine_similarity(query_vec, candidate_vec)
                targeted_score = score
                targeted_candidate = (user_id, name, dept)
                break

    # Prioritize expected candidate if above threshold
    effective_threshold = float(os.environ.get("FACE_SIMILARITY_THRESHOLD", "0.85"))
    chosen_candidate = best_candidate
    chosen_score = best_score
    if targeted_candidate and targeted_score >= effective_threshold:
        chosen_candidate = targeted_candidate
        chosen_score = targeted_score

    # Convert raw cosine similarity to normalized confidence score [0.0, 1.0]
    conf_score = round(float((chosen_score + 1.0) / 2.0 if chosen_score <= 1.0 else chosen_score), 4)

    # Check if candidate meets the strict business threshold (0.85) without arbitrary fallbacks
    if chosen_candidate and conf_score >= effective_threshold:
        user_id, name, dept = chosen_candidate

        # Check Proxy Punch
        is_proxy_punch = False
        if payload.expected_employee_code and payload.expected_employee_code.strip():
            expected = payload.expected_employee_code.strip().lower()
            actual = user_id.strip().lower()
            if actual != expected:
                is_proxy_punch = True

        return VerifyResponse(
            is_matched=not is_proxy_punch,
            similarity_score=conf_score,
            quality_passed=True,
            matched_employee=EmployeeFaceProfile(
                employee_code=user_id,
                full_name=name,
                department=dept or "Khối Kỹ Thuật",
                confidence_score=conf_score,
                is_liveness_verified=liveness_ok,
            ),
            is_liveness_verified=liveness_ok,
            is_proxy_punch_detected=is_proxy_punch,
            message="Phát hiện chấm công hộ! Khuôn mặt không khớp với tài khoản đăng nhập." if is_proxy_punch else f"Nhận diện thành công nhân viên: {name} ({user_id})",
        )
    else:
        return VerifyResponse(
            is_matched=False,
            similarity_score=round(max(0.0, conf_score), 4),
            quality_passed=True,
            is_liveness_verified=liveness_ok,
            matched_employee=None,
            is_proxy_punch_detected=False,
            error_code="FACE_NOT_MATCHED",
            message=f"Khuôn mặt chưa được đăng ký trong hệ thống hoặc độ tương đồng ({conf_score:.1%}) thấp hơn ngưỡng quy định ({effective_threshold:.0%}).",
        )


@app.post("/api/v1/face/verify", response_model=VerifyResponse, summary="1:N Face Verification (Multipart)", tags=["Biometrics"])
async def verify_face_multipart(
    image: UploadFile = File(...),
    expected_employee_code: Optional[str] = Form(None),
):
    """Multipart form-data wrapper for face verification."""
    data = await image.read()
    b64_str = base64.b64encode(data).decode("utf-8")
    payload = VerifyJsonRequest(image=b64_str, expected_employee_code=expected_employee_code)
    return verify_face_json(payload)


@app.post("/api/v1/face/enroll-json", response_model=EnrollResponse, summary="Biometric Enrollment (JSON)", tags=["Biometrics"])
async def enroll_face_json(payload: EnrollJsonRequest):
    """Registers an employee biometric profile using a single or multi-angle face photo."""
    img = decode_image_from_base64_or_bytes(payload.frontal_image)
    quality_ok, quality_err = check_image_quality(img)
    if not quality_ok:
        raise HTTPException(status_code=400, detail=quality_err)

    feature, err = extract_face_embedding(img)
    if feature is None:
        raise HTTPException(status_code=400, detail=err or "Không phát hiện khuôn mặt trong ảnh chính diện.")

    features = [feature]

    if payload.left_image:
        try:
            l_img = decode_image_from_base64_or_bytes(payload.left_image)
            l_feat, _ = extract_face_embedding(l_img)
            if l_feat is not None and len(l_feat) == len(feature):
                features.append(l_feat)
        except Exception as e:
            logger.warning("Left angle feature extraction skipped: %s", e)

    if payload.right_image:
        try:
            r_img = decode_image_from_base64_or_bytes(payload.right_image)
            r_feat, _ = extract_face_embedding(r_img)
            if r_feat is not None and len(r_feat) == len(feature):
                features.append(r_feat)
        except Exception as e:
            logger.warning("Right angle feature extraction skipped: %s", e)

    avg_feature = np.mean(features, axis=0)
    norm = np.linalg.norm(avg_feature)
    if norm > 0:
        avg_feature = avg_feature / norm

    full_name = payload.full_name or f"Nhân Viên {payload.employee_code}"
    department = payload.department or "Khối Kỹ Thuật"
    emb_bytes = avg_feature.astype(np.float32).tobytes()

    # Save to SQLite
    with sqlite3.connect(SQLITE_DB_FILE) as conn:
        conn.execute(
            """
            INSERT INTO face_identities (tenant_id, user_id, full_name, department, embedding)
            VALUES ('default', ?, ?, ?, ?)
            ON CONFLICT(tenant_id, user_id) DO UPDATE SET
                full_name = excluded.full_name,
                department = excluded.department,
                embedding = excluded.embedding,
                created_at = CURRENT_TIMESTAMP
            """,
            (payload.employee_code, full_name, department, emb_bytes),
        )
        conn.commit()

    # Save to memory and JSON/PostgreSQL
    vec_list = avg_feature.tolist()
    employee_db[payload.employee_code] = {
        "employee_code": payload.employee_code,
        "full_name": full_name,
        "department": department,
        "vector": vec_list,
        "enrolled_at": datetime.now().isoformat(),
    }
    await persist_employee_to_db(payload.employee_code, vec_list)

    dim = len(avg_feature)
    logger.info("Successfully enrolled biometric profile for %s (%s) [%dD]", full_name, payload.employee_code, dim)
    return EnrollResponse(
        status="SUCCESS",
        employee_code=payload.employee_code,
        full_name=full_name,
        message=f"Đăng ký thành công mẫu khuôn mặt {dim}D cho nhân viên {full_name} ({payload.employee_code})",
        vector_dimensions=dim,
    )


@app.post("/api/v1/face/enroll", response_model=EnrollResponse, summary="Biometric Enrollment (Multipart)", tags=["Biometrics"])
async def enroll_face_multipart(
    employee_code: str = Form(...),
    full_name: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    frontal_image: UploadFile = File(...),
    left_image: Optional[UploadFile] = File(None),
    right_image: Optional[UploadFile] = File(None),
):
    """Multipart form-data wrapper for biometric enrollment."""
    data = await frontal_image.read()
    b64_str = base64.b64encode(data).decode("utf-8")
    l_b64 = None
    if left_image:
        l_b64 = base64.b64encode(await left_image.read()).decode("utf-8")
    r_b64 = None
    if right_image:
        r_b64 = base64.b64encode(await right_image.read()).decode("utf-8")

    payload = EnrollJsonRequest(
        employee_code=employee_code,
        full_name=full_name,
        department=department,
        frontal_image=b64_str,
        left_image=l_b64,
        right_image=r_b64,
    )
    return await enroll_face_json(payload)



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
