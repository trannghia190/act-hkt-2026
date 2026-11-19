import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';

export const FaceEnrollmentPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  // Employee profile form inputs
  const [employeeCode, setEmployeeCode] = useState<string>(user?.employeeCode || '136ACT');
  const [fullName, setFullName] = useState<string>(user?.fullName || 'Vũ Văn Luận');
  const [department, setDepartment] = useState<string>(user?.department || 'Khối Kỹ Thuật');

  // Camera & Capture state
  const [useRealCamera, setUseRealCamera] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync user state when user changes
  useEffect(() => {
    if (user) {
      if (user.employeeCode) setEmployeeCode(user.employeeCode);
      if (user.fullName) setFullName(user.fullName);
      if (user.department) setDepartment(user.department);
    }
  }, [user]);

  // Clean up media stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraStream]);

  // Auto-connect stream to video element whenever stream updates
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch((err) => {
        console.warn('Video play error in enrollment:', err);
      });
    }
  }, [cameraStream, useRealCamera]);

  // Auto-start camera when opening Face Enrollment page
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      })
      .then((stream) => {
        activeStream = stream;
        setCameraStream(stream);
        setUseRealCamera(true);
      })
      .catch((err) => {
        console.warn('Webcam auto-start in enrollment deferred:', err);
      });

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      setCameraStream(stream);
      setUseRealCamera(true);
    } catch (err: any) {
      alert('Không thể kích hoạt webcam: ' + (err?.message || 'Permission denied'));
      setUseRealCamera(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setUseRealCamera(false);
  };

  const capturePhoto = () => {
    setIsCapturing(true);
    setErrorMessage(null);
    setEnrollmentStatus('idle');

    setTimeout(() => {
      let dataUrl: string | null = null;

      if (useRealCamera && videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth || 480;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        }
      }

      if (!dataUrl) {
        // Fallback realistic placeholder if webcam not connected
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(0, 0, 300, 300);
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.arc(150, 150, 80, 0, Math.PI * 2);
          ctx.fill();
        }
        dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      }

      setCapturedImage(dataUrl);
      setIsCapturing(false);
    }, 300);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCapturedImage(reader.result);
        setErrorMessage(null);
        setEnrollmentStatus('idle');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setErrorMessage(null);
    setEnrollmentStatus('idle');
  };

  const handleCompleteEnrollment = async () => {
    if (!capturedImage) {
      setErrorMessage('Vui lòng chụp ảnh khuôn mặt trước khi bấm đăng ký.');
      return;
    }

    if (!employeeCode.trim() || !fullName.trim()) {
      setErrorMessage('Vui lòng nhập đầy đủ Mã nhân viên và Họ tên.');
      return;
    }

    setEnrollmentStatus('processing');
    setErrorMessage(null);

    try {
      // 1. Send directly to real AI Face Service (OpenCV YuNet + SFace)
      const res = await fetch('/ai-face/api/v1/face/enroll-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_code: employeeCode.trim(),
          full_name: fullName.trim(),
          department: department.trim(),
          frontal_image: capturedImage,
        }),
      });

      const resJson = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(resJson.detail || resJson.message || 'Lỗi khi trích xuất vector từ ảnh khuôn mặt.');
      }

      // 2. Optional: Core Service Auth API call
      try {
        await fetch('/api/v1/auth/enroll-face', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeCode: employeeCode.trim(),
            frontalImage: capturedImage.substring(0, 100),
          }),
        });
      } catch (_) {}

      // 3. Mark user active & enrolled in AuthContext
      updateUser({
        employeeCode: employeeCode.trim(),
        fullName: fullName.trim(),
        department: department.trim(),
        faceEnrolled: true,
        status: 'ACTIVE',
      });

      setSuccessMessage(
        resJson.message || `Đăng ký thành công mẫu khuôn mặt sinh trắc học cho ${fullName.trim()} (${employeeCode.trim()})!`
      );
      setEnrollmentStatus('success');
    } catch (err: any) {
      console.error('Enrollment error:', err);
      setErrorMessage(
        err?.message || 'Không thể đăng ký khuôn mặt. Vui lòng căn chỉnh lại góc máy, đảm bảo đủ sáng và thử lại.'
      );
      setEnrollmentStatus('error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hidden canvas for video frame extraction */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Header Wizard Navigation */}
      <div className="bg-canvas border border-line rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent-soft text-accent rounded-full text-xs font-semibold border border-accent-line mb-2">
              <span>📸</span> Đăng Ký Mẫu Khuôn Mặt Nhận Diện (S01-B)
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Đăng Ký Khuôn Mặt Nhân Viên
            </h1>
            <p className="text-xs text-ink-muted mt-1">
              Chụp 1 ảnh trực tiếp từ webcam để trích xuất vector sinh trắc học (OpenCV YuNet + SFace) lưu vào cơ sở dữ liệu.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => (useRealCamera && cameraStream ? stopCamera() : startCamera())}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                useRealCamera && cameraStream
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                  : 'bg-canvas text-ink-secondary hover:text-ink border-line'
              }`}
            >
              {useRealCamera && cameraStream ? '🟢 Webcam Đang Bật' : '📷 Bật Webcam Thực'}
            </button>
            <button
              onClick={() => navigate('/attendance/checkin')}
              className="px-3 py-1.5 text-xs text-ink-secondary hover:text-ink hover:bg-canvas-subtle rounded-lg border border-line cursor-pointer"
            >
              Vào Thẳng Check-In
            </button>
          </div>
        </div>
      </div>

      {/* Main Viewport & Enrollment Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Live Viewport with circular targeting mask */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-6 text-center">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <span>Khung hình Camera:</span>
                <span className="text-accent font-bold">Chính diện khuôn mặt</span>
              </span>
              <span className="text-[11px] text-ink-muted">
                {useRealCamera && cameraStream ? 'Trực tiếp từ webcam' : 'Chờ mở camera'}
              </span>
            </div>

            {/* Circular Camera Mask */}
            <div className="relative w-64 h-64 mx-auto rounded-full border-4 border-dashed border-accent/60 bg-zinc-950 overflow-hidden flex items-center justify-center shadow-lg">
              {/* Live Video Element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={(e) => {
                  e.currentTarget.play().catch(() => {});
                }}
                className={`w-full h-full object-cover rounded-full ${
                  useRealCamera && cameraStream && !capturedImage ? 'block' : 'hidden'
                }`}
              />

              {/* Captured Photo Preview */}
              {capturedImage && (
                <img
                  src={capturedImage}
                  alt="Captured face preview"
                  className="w-full h-full object-cover rounded-full"
                />
              )}

              {/* Placeholder when no camera and no photo */}
              {!capturedImage && (!useRealCamera || !cameraStream) && (
                <div className="text-center p-6 text-white space-y-2">
                  <div className="text-5xl animate-bounce">👤</div>
                  <div className="text-xs font-semibold text-zinc-300">
                    Căn chỉnh khuôn mặt vào tâm tròn
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Bật webcam hoặc tải ảnh lên để bắt đầu
                  </div>
                </div>
              )}

              {/* Targeting Guideline Overlay */}
              <div className="absolute inset-0 pointer-events-none border border-accent/20 rounded-full flex items-center justify-center">
                <div className="w-48 h-48 border border-white/20 rounded-full" />
              </div>

              {isCapturing && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2">
                  <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium">Đang chụp ảnh...</span>
                </div>
              )}
            </div>

            {/* Prompt Instruction */}
            <div className="mt-4 p-3 bg-canvas-subtle rounded-lg border border-line-subtle text-xs text-ink-secondary">
              <span className="font-semibold text-ink">Hướng dẫn: </span>
              Nhìn thẳng vào tâm khung tròn camera, giữ khuôn mặt thư giãn, đủ ánh sáng và không che mặt.
            </div>

            {/* Capture Buttons */}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button
                variant="primary"
                onClick={capturePhoto}
                disabled={isCapturing}
                className="px-6 py-2.5 text-xs shadow-md cursor-pointer"
              >
                {capturedImage ? '📸 Chụp Lại Ảnh Này' : '📸 Chụp Ảnh Khuôn Mặt'}
              </Button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-line hover:bg-canvas-subtle text-ink-secondary hover:text-ink cursor-pointer"
              >
                📁 Tải Ảnh Từ Máy
              </button>

              {capturedImage && (
                <button
                  type="button"
                  onClick={handleRetake}
                  className="px-3 py-2 text-xs font-semibold text-red-500 hover:text-red-700 cursor-pointer"
                >
                  Xoá ảnh
                </button>
              )}
            </div>
          </Card>
        </div>

        {/* Right Side: Employee Info & Enrollment Confirmation */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-ink flex items-center justify-between">
              <span>Thông Tin Nhân Viên Đăng Ký</span>
              <Badge variant={capturedImage ? 'ok' : 'gray'}>
                {capturedImage ? '✓ Đã Có Ảnh Chụp' : 'Chờ Chụp Ảnh'}
              </Badge>
            </h3>

            {/* Employee Form Inputs */}
            <div className="space-y-3 text-xs text-left">
              <div>
                <label className="block font-semibold text-ink mb-1">Mã nhân viên (User ID / Code):</label>
                <input
                  type="text"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  placeholder="Ví dụ: 136ACT, admin, 05ACT"
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg font-mono text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Họ và tên nhân viên:</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ví dụ: Vũ Văn Luận, AD văn min"
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Phòng ban / Nhóm:</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Ví dụ: Khối Kỹ Thuật, Phòng Nhân Sự"
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>

            {/* Photo Preview Mini-Card */}
            <div className="p-3 bg-canvas-subtle border border-line rounded-lg flex items-center gap-3">
              <div className="w-14 h-14 rounded-full border border-line overflow-hidden bg-zinc-800 flex items-center justify-center flex-shrink-0">
                {capturedImage ? (
                  <img src={capturedImage} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-ink-muted">Chưa có</span>
                )}
              </div>
              <div className="min-w-0 text-left">
                <div className="text-xs font-bold text-ink truncate">
                  {fullName || 'Chưa nhập tên'} ({employeeCode || 'Chưa có mã'})
                </div>
                <div className="text-[11px] text-ink-muted truncate">
                  {department || 'Chưa nhập phòng ban'}
                </div>
                <div className="text-[11px] mt-0.5">
                  {capturedImage ? (
                    <span className="text-emerald-600 font-semibold">✓ Ảnh sẵn sàng để đăng ký</span>
                  ) : (
                    <span className="text-amber-600">● Cần bấm "Chụp Ảnh" bên trái</span>
                  )}
                </div>
              </div>
            </div>

            {/* AI Service Metrics Info */}
            <div className="p-3 bg-canvas rounded-lg border border-line-subtle space-y-1.5 text-[11px] text-ink-secondary text-left">
              <div className="font-semibold text-ink">Thông số dịch vụ Face Recognition:</div>
              <div className="flex justify-between">
                <span>AI Face Engine:</span>
                <span className="font-mono text-ink font-semibold">OpenCV YuNet + SFace (128D)</span>
              </div>
              <div className="flex justify-between">
                <span>Cơ sở dữ liệu:</span>
                <span className="font-mono text-emerald-600 font-semibold">SQLite saas_faces.db</span>
              </div>
              <div className="flex justify-between">
                <span>Endpoint đăng ký:</span>
                <span className="font-mono text-ink">/ai-face/api/v1/face/enroll-json</span>
              </div>
            </div>

            {/* Action buttons & Alerts */}
            <div className="pt-2">
              {enrollmentStatus === 'error' && errorMessage && (
                <div className="p-3 mb-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-600 text-left font-medium">
                  {errorMessage}
                </div>
              )}

              {enrollmentStatus === 'success' ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center space-y-2">
                  <div className="text-emerald-600 font-bold text-sm">🎉 Kích Hoạt Mẫu Khuôn Mặt Thành Công!</div>
                  <p className="text-xs text-ink-muted">
                    {successMessage || 'Dữ liệu sinh trắc học đã được lưu vào Face Recognition Database.'}
                  </p>
                  <div className="flex flex-col gap-2 mt-3">
                    <Button
                      variant="primary"
                      onClick={() => navigate('/attendance/checkin')}
                      className="w-full py-2 text-xs font-bold cursor-pointer"
                    >
                      Đến Màn Hình Chấm Công Ngay
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setCapturedImage(null);
                        setEnrollmentStatus('idle');
                        setSuccessMessage(null);
                      }}
                      className="text-xs text-ink-muted hover:text-ink underline cursor-pointer"
                    >
                      Đăng ký thêm nhân viên khác
                    </button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleCompleteEnrollment}
                  disabled={!capturedImage || enrollmentStatus === 'processing'}
                  className="w-full py-2.5 text-xs font-bold cursor-pointer shadow-md"
                >
                  {enrollmentStatus === 'processing'
                    ? 'Đang Trích Xuất Vector & Lưu CSDL...'
                    : capturedImage
                    ? '✓ Xác Nhận & Đăng Ký Khuôn Mặt'
                    : 'Hãy Chụp Ảnh Để Hoàn Tất'}
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
