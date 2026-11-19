# Face Recognition & Verification Microservice

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.9+-3776AB.svg?logo=python&logoColor=white)](https://python.org)
[![OpenCV](https://img.shields.io/badge/OpenCV-YuNet%20%26%20SFace-5C3EE8.svg?logo=opencv&logoColor=white)](https://github.com/opencv/opencv_zoo)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-ready, lightweight **Face Recognition, 1:1 Verification & 1:N Identification** microservice system built with **FastAPI**, **OpenCV YuNet** (Face Detection), **OpenCV SFace** (Face Recognition), **SQLite**, and **TailwindCSS**.

The repository is organized into two completely decoupled components:
1. **Backend API Microservice (`app_saas.py`)**: A pure REST API service accepting and returning **JSON Base64** payloads.
2. **Webcam Test Client (`client_server.py` / `client_test/`)**: A standalone browser-based GUI client utilizing the device's webcam to test Registration, Updates, Deletion, 1:1 Verification, and 1:N Identification in real time.

---

## 🚀 Key Features

- **Pure REST API with Base64 JSON Payloads**: Direct, seamless integration with external backend systems (Java/Spring Boot, Node.js, Go, Python, C#, etc.).
- **Privacy-First & Zero Raw Biometric Image Storage**: Uploaded face images are transformed into a compact **128-dimensional mathematical vector (`BLOB`, 512 bytes)** in SQLite. Raw images are not retained, ensuring data privacy, low disk consumption, and millisecond-level vector search speeds.
- **1:1 Face Verification**: Validates whether a live face matches a designated `user_id` against their stored biometric vector.
- **1:N Face Identification**: Searches an unknown face against all registered users in the database using Cosine Similarity to find the best match (or flags an unregistered stranger).
- **Automated Kiosk Presence Detection & Webhook**: Automatic continuous 3-second dwell detection for registered employees before snapshotting, rotating up to 200 local images (FIFO), and dispatching customizable Webhook callbacks to enterprise backends.
- **Dedicated Webcam Test Client**: Responsive web client running on `http://localhost:8088` with live video stream, frame capture, real-time API inspector, and one-click actions.

---

## 🛠️ Technology Stack

- **Runtime & Language**: Python 3.9+
- **API Framework**: FastAPI, Uvicorn, Pydantic v2
- **AI Models (OpenCV Zoo — Automatically downloaded on initial startup)**:
  - *Face Detection*: YuNet (`models/face_detection_yunet.onnx`)
  - *Face Recognition*: SFace (`models/face_recognition_sface.onnx`, Cosine Similarity threshold: `0.363`)
- **Database**: SQLite (`saas_faces.db`)
- **Test Client UI**: HTML5 Canvas, WebRTC `getUserMedia`, Tailwind CSS, FontAwesome

---

## 📦 Directory Structure

```text
face-recognition/
├── app_saas.py                     # Pure REST API Backend Microservice (Port 8000)
├── client_server.py                # Standalone Web Server for Test Client (Port 8088)
├── client_test/
│   └── index.html                  # Webcam Test Client Web Application
├── models/                         # ONNX Model Directory (YuNet & SFace)
│   └── .gitkeep
├── sample_face_base64.txt          # Valid, ready-to-test sample face Base64 string
├── Face_Recognition_API.postman_collection.json  # Pre-configured Postman Collection v2.1
├── openapi.json                    # OpenAPI 3.1.0 Specification
├── requirements.txt                # Python dependencies
├── run.sh                          # Launcher script for Backend Service
├── run_client.sh                   # Launcher script for Webcam Test Client
└── README.md                       # Documentation
```

---

## ⚙️ Installation & Quick Start

### 1. Prerequisites & Environment Setup

```bash
# Clone the repository
git clone git@github.com:haphamthanh-beep/face-recognition.git
cd face-recognition

# Create a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

### 2. Start the Backend API Service

```bash
# Launch FastAPI backend on port 8000
python3 app_saas.py

# Alternatively, use the launcher script:
./run.sh
```

- **Service Base URL**: `http://localhost:8000`
- **Interactive Swagger UI**: `http://localhost:8000/docs`
- **ReDoc Documentation**: `http://localhost:8000/redoc`
- **OpenAPI 3.1 JSON**: `http://localhost:8000/openapi.json`

*(On the first run, the service will automatically download the required ONNX models into `models/` if they are not already present).*

---

### 3. Start the Webcam Test Client

In a separate terminal window:

```bash
source venv/bin/activate
python3 client_server.py 8088

# Alternatively, use the launcher script:
./run_client.sh
```

Open your browser and navigate to: **`http://localhost:8088`**
- Grant camera access to the browser.
- Use the webcam to register, verify, identify, edit, or delete users through interactive tabs.

---

## 🏆 ACT HR 2026 Hackathon Integration Endpoints

These specialized endpoints directly power the ACT HR 2026 Frontend UI (`FaceEnrollmentPage` & `CheckInPage`):

| Operation | Method | Endpoint | Description |
|---|---|---|---|
| **Biometric Enrollment** | `POST` | `/api/v1/face/enroll-json` | Registers an employee face using 1 frontal photo Base64. Extracted into 128D SFace embedding. |
| **1:N Face Verification** | `POST` | `/api/v1/face/verify-json` | Real-time 1:N biometric search. No employee ID required — AI identifies who is standing in front of the camera. |
| **List Enrolled Employees** | `GET` | `/api/v1/face/employees` | Lists all enrolled biometric profiles for verification and sync. |
| **Mock Check-In Punch** | `POST` | `/api/v1/attendance/check-in` | Mock attendance punch endpoint returning valid attendance status. |
| **Mock Core Enroll** | `POST` | `/api/v1/auth/enroll-face` | Mock core user face enrollment endpoint. |

### Enrollment Request (`POST /api/v1/face/enroll-json`)
```json
{
  "employee_code": "136ACT",
  "full_name": "Vũ Văn Luận",
  "department": "Khối Kỹ Thuật",
  "frontal_image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

### Verification Request (`POST /api/v1/face/verify-json`)
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

### Verification Response `200 OK`
```json
{
  "is_matched": true,
  "quality_passed": true,
  "similarity_score": 0.9749,
  "is_proxy_punch_detected": false,
  "matched_employee": {
    "employee_code": "136ACT",
    "full_name": "Vũ Văn Luận",
    "department": "Khối Kỹ Thuật",
    "confidence_score": 0.9749,
    "is_liveness_verified": true
  },
  "message": "Nhận diện thành công nhân viên: Vũ Văn Luận (136ACT)"
}
```

---

## 📡 REST API Reference

All image endpoints accept either raw Base64 strings (`/9j/4AAQ...`) or Data URI format (`data:image/jpeg;base64,...`).

| Operation | Method | Endpoint | Payload Format |
|---|---|---|---|
| **Register Face** | `POST` | `/api/v1/faces/register` | `application/json` (Base64) |
| **Verify 1:1** | `POST` | `/api/v1/faces/verify` | `application/json` (Base64) |
| **Identify 1:N** | `POST` | `/api/v1/faces/identify` | `application/json` (Base64) |
| **List Users** | `GET` | `/api/v1/faces/users` | Query params (`search`, `limit`, `offset`) |
| **Get User** | `GET` | `/api/v1/faces/users/{user_id}` | Path parameter |
| **Update User** | `PUT` | `/api/v1/faces/users/{user_id}` | `application/json` (Name / Face update) |
| **Delete User** | `DELETE` | `/api/v1/faces/users/{user_id}` | Path parameter |
| **Kiosk Trigger** | `POST` | `/api/v1/presence/detect-and-trigger-json` | `application/json` (Base64) |

---

### API Request & Response Examples

#### 1. Register a New Face (`POST /api/v1/faces/register`)

**Request**:
```json
{
  "user_id": "NV-001",
  "full_name": "John Doe",
  "image_base64": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQ...",
  "tenant_id": "default"
}
```

**Response `200 OK`**:
```json
{
  "success": true,
  "user_id": "NV-001",
  "full_name": "John Doe",
  "tenant_id": "default",
  "message": "Face registered successfully via Base64 JSON payload."
}
```

---

#### 2. 1:1 Face Verification (`POST /api/v1/faces/verify`)

Validates if the provided face matches a specific `user_id`.

**Request**:
```json
{
  "user_id": "NV-001",
  "image_base64": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQ...",
  "tenant_id": "default"
}
```

**Response on Match (`MATCH`)**:
```json
{
  "is_match": true,
  "user_id": "NV-001",
  "full_name": "John Doe",
  "similarity": 0.8247,
  "threshold": 0.363,
  "status": "MATCH",
  "message": "Face matches John Doe (NV-001)."
}
```

*(If the face does not match: `"is_match": false`, `"status": "MISMATCH"`).*

---

#### 3. 1:N Face Identification (`POST /api/v1/faces/identify`)

Searches the provided face against the entire user database without requiring a `user_id`.

**Request**:
```json
{
  "image_base64": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQ...",
  "tenant_id": "default"
}
```

**Response on Successful Identification**:
```json
{
  "is_identified": true,
  "user_id": "NV-001",
  "full_name": "John Doe",
  "similarity": 0.8247,
  "threshold": 0.363,
  "status": "IDENTIFIED",
  "message": "Identified as John Doe (NV-001)"
}
```

*(If unrecognized: `"is_identified": false`, `"status": "UNKNOWN"`).*

---

#### 4. Update User Information or Face Template (`PUT /api/v1/faces/users/{user_id}`)

**Request**:
```json
{
  "full_name": "John Doe (Updated)",
  "image_base64": "/9j/4AAQSkZJRgABAQ...",
  "tenant_id": "default"
}
```

---

#### 5. List Users (`GET /api/v1/faces/users`)

**Request**: `GET /api/v1/faces/users?tenant_id=default&search=John&limit=20&offset=0`

**Response `200 OK`**:
```json
{
  "total": 1,
  "limit": 20,
  "offset": 0,
  "users": [
    {
      "user_id": "NV-001",
      "full_name": "John Doe",
      "created_at": "2026-11-18 14:12:42"
    }
  ]
}
```

---

## 🧪 Testing with Postman

The project includes an importable Postman collection: **[`Face_Recognition_API.postman_collection.json`](Face_Recognition_API.postman_collection.json)**.

1. Open Postman $\rightarrow$ Click **Import** $\rightarrow$ Select `Face_Recognition_API.postman_collection.json`.
2. The collection comes pre-configured with environment variables:
   - `{{baseUrl}}`: `http://localhost:8000`
   - `{{tenantId}}`: `default`
   - `{{sampleBase64}}`: Contains a valid, tested sample face Base64 string from `sample_face_base64.txt`.
3. Simply select any request and hit **Send** to verify immediately.

---

## ☕ Client Integration Examples

### Java / Spring Boot (`RestTemplate`)

```java
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import java.nio.file.*;
import java.util.*;

public class FaceVerificationClient {

    private final RestTemplate restTemplate = new RestTemplate();
    private static final String API_URL = "http://localhost:8000/api/v1/faces/verify";

    public boolean verifyEmployee(String userId, byte[] imageBytes) {
        String base64Image = Base64.getEncoder().encodeToString(imageBytes);

        Map<String, Object> payload = new HashMap<>();
        payload.put("user_id", userId);
        payload.put("image_base64", base64Image);
        payload.put("tenant_id", "default");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
        ResponseEntity<Map> response = restTemplate.postForEntity(API_URL, entity, Map.class);

        if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
            Boolean isMatch = (Boolean) response.getBody().get("is_match");
            Double similarity = (Double) response.getBody().get("similarity");
            System.out.printf("User %s verified: %b (similarity: %.4f)%n", userId, isMatch, similarity);
            return Boolean.TRUE.equals(isMatch);
        }
        return false;
    }
}
```

---

### Python (`httpx`)

```python
import base64
import httpx

with open("path/to/snapshot.jpg", "rb") as f:
    b64_image = base64.b64encode(f.read()).decode("utf-8")

response = httpx.post(
    "http://localhost:8000/api/v1/faces/verify",
    json={
        "user_id": "NV-001",
        "image_base64": b64_image,
        "tenant_id": "default",
    },
)

data = response.json()
print("Verification Result:", data["status"], "Similarity:", data["similarity"])
```

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
