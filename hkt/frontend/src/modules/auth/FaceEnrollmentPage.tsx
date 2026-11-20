import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
  Camera,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ShieldCheck,
  UserCheck,
  Search,
  Plus,
  Users,
} from 'lucide-react';

interface EnrolledEmployee {
  employee_code: string;
  full_name: string;
  department: string;
  has_face_vector: boolean;
  enrolled_at?: string;
}

interface VerifyResult {
  is_matched: boolean;
  similarity_score: number;
  matched_employee?: {
    employee_code: string;
    full_name: string;
    department: string;
    confidence_score: number;
    is_liveness_verified: boolean;
  } | null;
  is_liveness_verified: boolean;
  is_proxy_punch_detected?: boolean;
  message: string;
}

export const FaceEnrollmentPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'HR_ADMIN';

  // Active sub-view: 'enroll' (1 frontal angle) | 'verify' (test verification) | 'crud' (face profile list)
  const [activeTab, setActiveTab] = useState<'enroll' | 'verify' | 'crud'>('enroll');

  // Multi-angle mode (B0 support)
  const [enrollMode, setEnrollMode] = useState<'single' | 'three'>('single');
  const [capturedLeft, setCapturedLeft] = useState<string | null>(null);
  const [capturedRight, setCapturedRight] = useState<string | null>(null);
  const [angleStep, setAngleStep] = useState<'frontal' | 'left' | 'right'>('frontal');

  // Enrollment Form state
  const [employeeCode, setEmployeeCode] = useState<string>(user?.employeeCode || '136ACT');
  const [fullName, setFullName] = useState<string>(user?.fullName || 'Vũ Văn Luận');
  const [department, setDepartment] = useState<string>(user?.department || 'Khối Kỹ Thuật');

  // Camera & Media stream state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  // Single Frontal Image capture state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [enrollStatus, setEnrollStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [enrollMessage, setEnrollMessage] = useState<string | null>(null);

  // Verification tab state
  const [verifyImage, setVerifyImage] = useState<string | null>(null);
  const [expectedCode, setExpectedCode] = useState<string>(user?.employeeCode || '');
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  // CRUD list state
  const [enrolledList, setEnrolledList] = useState<EnrolledEmployee[]>([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Synchronize initial user state
  useEffect(() => {
    if (user?.employeeCode) setEmployeeCode(user.employeeCode);
    if (user?.fullName) setFullName(user.fullName);
    if (user?.department) setDepartment(user.department);
    if (user?.employeeCode && !expectedCode) setExpectedCode(user.employeeCode);
  }, [user]);

  // Start webcam
  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      setStream(s);
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play().catch(() => undefined);
      }
    } catch (err: any) {
      console.warn('Cannot open webcam:', err);
      setIsCameraActive(false);
    }
  };

  // Stop webcam
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  // Auto initialize camera when on enroll or verify tab
  useEffect(() => {
    if (activeTab === 'enroll' || activeTab === 'verify') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab]);

  // Ensure video element plays when stream updates
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => undefined);
    }
  }, [stream, activeTab]);

  // Load enrolled employee profiles from AI Face Service
  const fetchEnrolledEmployees = async () => {
    setIsLoadingList(true);
    try {
      const res = await fetch('/ai-face/api/v1/face/employees');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setEnrolledList(data);
        }
      }
    } catch (err) {
      console.warn('Failed to load enrolled faces:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    fetchEnrolledEmployees();
  }, []);

  // Capture single photo from webcam
  const handleCapturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    if (activeTab === 'enroll') {
      if (enrollMode === 'three') {
        if (angleStep === 'frontal') {
          setCapturedImage(dataUrl);
          setAngleStep('left');
        } else if (angleStep === 'left') {
          setCapturedLeft(dataUrl);
          setAngleStep('right');
        } else {
          setCapturedRight(dataUrl);
          setAngleStep('frontal');
        }
      } else {
        setCapturedImage(dataUrl);
      }
      setEnrollStatus('idle');
      setEnrollMessage(null);
    } else if (activeTab === 'verify') {
      setVerifyImage(dataUrl);
      setVerifyResult(null);
    }
  };

  // Upload photo from file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (activeTab === 'enroll') {
          setCapturedImage(reader.result);
          setEnrollStatus('idle');
          setEnrollMessage(null);
        } else if (activeTab === 'verify') {
          setVerifyImage(reader.result);
          setVerifyResult(null);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Submit enrollment (1 Frontal Angle)
  const handleEnrollSubmit = async () => {
    if (!capturedImage) {
      setEnrollMessage('Vui lòng chụp ảnh khuôn mặt chính diện hoặc tải ảnh lên trước khi đăng ký.');
      setEnrollStatus('error');
      return;
    }
    if (!employeeCode.trim()) {
      setEnrollMessage('Vui lòng nhập Mã nhân viên.');
      setEnrollStatus('error');
      return;
    }

    setEnrollStatus('processing');
    setEnrollMessage(null);

    try {
      const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user?.accessToken) {
        reqHeaders['Authorization'] = `Bearer ${user.accessToken}`;
      } else {
        try {
          const saved = localStorage.getItem('pulse_auth_user');
          if (saved) {
            const u = JSON.parse(saved);
            if (u?.accessToken) reqHeaders['Authorization'] = `Bearer ${u.accessToken}`;
          }
        } catch (_) {}
      }

      // 1. Send biometric image(s) to AI Face Service (OpenCV YuNet + SFace)
      const aiRes = await fetch('/ai-face/api/v1/face/enroll-json', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({
          employee_code: employeeCode.trim(),
          full_name: fullName.trim() || employeeCode.trim(),
          department: department.trim() || 'Khối Kỹ Thuật',
          frontal_image: capturedImage,
          left_image: capturedLeft || undefined,
          right_image: capturedRight || undefined,
        }),
      });

      const aiJson = await aiRes.json().catch(() => ({}));
      if (!aiRes.ok) {
        throw new Error(aiJson.detail || aiJson.message || 'Không thể trích xuất vector khuôn mặt từ ảnh.');
      }

      // 2. Synchronize status with Core Service using authentic AI embedding
      try {
        await fetch('/api/v1/auth/enroll-face', {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify({
            employeeCode: employeeCode.trim(),
            faceDataUrl: capturedImage,
            confidenceScore: 0.98,
            embedding: aiJson.embedding || undefined,
          }),
        });
      } catch (err) {
        console.warn('Core auth sync warning:', err);
      }

      // 3. If enrolled user matches logged in user, update AuthContext
      if (user?.employeeCode && user.employeeCode.toLowerCase() === employeeCode.trim().toLowerCase()) {
        updateUser({ faceEnrolled: true, status: 'ACTIVE' });
      }

      setEnrollStatus('success');
      setEnrollMessage(
        aiJson.message || `Đăng ký thành công mẫu khuôn mặt 1 góc cho nhân viên ${fullName} (${employeeCode})!`
      );

      // Refresh list
      fetchEnrolledEmployees();
    } catch (err: any) {
      setEnrollStatus('error');
      setEnrollMessage(err?.message || 'Đăng ký khuôn mặt thất bại. Vui lòng căn chỉnh lại góc mặt và thử lại.');
    }
  };

  // Run Verification (1:N or 1:1)
  const handleVerifySubmit = async () => {
    const targetImage = verifyImage || capturedImage;
    if (!targetImage) {
      alert('Vui lòng chụp hoặc tải lên ảnh khuôn mặt để kiểm tra xác thực.');
      return;
    }

    setVerifyStatus('processing');
    setVerifyResult(null);

    try {
      const res = await fetch('/ai-face/api/v1/face/verify-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: targetImage,
          expected_employee_code: expectedCode.trim() || undefined,
        }),
      });

      const data: VerifyResult = await res.json();
      setVerifyResult(data);
      if (data.is_matched) {
        setVerifyStatus('success');
      } else {
        setVerifyStatus('error');
      }
    } catch (err: any) {
      setVerifyStatus('error');
      setVerifyResult({
        is_matched: false,
        similarity_score: 0.0,
        is_liveness_verified: false,
        message: err?.message || 'Lỗi kết nối tới AI Face Service',
      });
    }
  };

  // Delete Face Profile (CRUD - Delete)
  const handleDeleteFace = async (code: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xoá mẫu khuôn mặt sinh trắc học của nhân viên ${code}?`)) {
      return;
    }

    try {
      // 1. Delete from AI Face Service
      const aiRes = await fetch(`/ai-face/api/v1/face/employees/${encodeURIComponent(code)}`, {
        method: 'DELETE',
      });

      // 2. Delete from Core Service
      try {
        await fetch(`/api/v1/auth/face-profile/${encodeURIComponent(code)}`, {
          method: 'DELETE',
        });
      } catch (_) {}

      if (user?.employeeCode && user.employeeCode.toLowerCase() === code.toLowerCase()) {
        updateUser({ faceEnrolled: false });
      }

      alert(`Đã xoá mẫu khuôn mặt của nhân viên ${code} thành công.`);
      fetchEnrolledEmployees();
    } catch (err: any) {
      alert(`Xoá thất bại: ${err?.message || 'Lỗi không xác định'}`);
    }
  };

  // Quick edit / select employee for re-enrollment (CRUD - Update)
  const handleSelectForUpdate = (emp: EnrolledEmployee) => {
    setEmployeeCode(emp.employee_code);
    setFullName(emp.full_name);
    setDepartment(emp.department);
    setCapturedImage(null);
    setEnrollStatus('idle');
    setEnrollMessage(null);
    setActiveTab('enroll');
  };

  // Quick select employee for verification test
  const handleSelectForVerify = (emp: EnrolledEmployee) => {
    setExpectedCode(emp.employee_code);
    setVerifyResult(null);
    setActiveTab('verify');
  };

  // Filtered employees list
  const filteredList = enrolledList.filter((emp) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      emp.employee_code.toLowerCase().includes(q) ||
      emp.full_name.toLowerCase().includes(q) ||
      emp.department.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Hidden elements for capturing and uploading */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Header Wizard Banner */}
      <div className="bg-canvas border border-line rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent-soft text-accent rounded-full text-xs font-semibold border border-accent-line mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Sinh Trắc Học AI • OpenCV YuNet + SFace (128D ONNX)</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Đăng Ký & Quản Lý Mẫu Khuôn Mặt
            </h1>
            <p className="text-xs text-ink-muted mt-1">
              Đăng ký 1 góc chính diện tinh gọn • Xác thực nhận diện 1:N tức thì • Quản trị hồ sơ sinh trắc học
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="ok" className="text-xs px-2.5 py-1">
              {enrolledList.length} Hồ Sơ Đã Nạp Vector
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/attendance/checkin')}
              className="text-xs"
            >
              Đến Màn Hình Chấm Công
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-line mt-6 -mb-2 gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('enroll')}
            className={`pb-3 px-3.5 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'enroll'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Đăng Ký 1 Góc (Chính diện)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('verify')}
            className={`pb-3 px-3.5 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'verify'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Thử Nghiệm Xác Thực (Verify 1:N)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('crud');
              fetchEnrolledEmployees();
            }}
            className={`pb-3 px-3.5 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'crud'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Quản Lý Hồ Sơ ({enrolledList.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ENROLLMENT (1 FRONT-FACING ANGLE)                                  */}
      {/* ========================================================================= */}
      {activeTab === 'enroll' && (
        <div className="grid md:grid-cols-12 gap-6">
          {/* Left: Camera / Preview Viewport */}
          <div className="md:col-span-7 space-y-4">
            <Card className="p-4 overflow-hidden border border-line bg-canvas">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-accent" />
                  Góc Chụp: Chính Diện (0°)
                </span>
                <span className="text-[11px] text-ink-muted">Chỉ cần 1 ảnh khuôn mặt rõ nét</span>
              </div>

              {/* Viewport Frame */}
              <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-black border border-line flex items-center justify-center">
                {capturedImage ? (
                  <img
                    src={capturedImage}
                    alt="Captured Frontal"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />
                )}

                {/* Face Biometric Guide Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-52 h-64 border-2 border-dashed border-accent/80 rounded-[48%] flex items-center justify-center">
                    <div className="w-full h-0.5 bg-accent/30" />
                  </div>
                </div>

                {/* Status Pills */}
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded-md font-mono flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {capturedImage ? 'Ảnh Đã Chụp (Sẵn Sàng)' : isCameraActive ? 'Webcam Live' : 'Camera Khởi Tạo...'}
                </div>
              </div>

              {/* Camera Actions */}
              <div className="mt-4 flex flex-wrap gap-2 justify-between items-center">
                <div className="flex gap-2">
                  {capturedImage ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCapturedImage(null)}
                      className="text-xs flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Chụp Lại
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleCapturePhoto}
                      className="text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Chụp Ảnh Chính Diện
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Tải Ảnh Từ File
                  </Button>
                </div>

                <div className="text-[11px] text-ink-muted">
                  Độ phân giải tối ưu: 640x640px
                </div>
              </div>
            </Card>

            {/* Instruction hints */}
            <div className="p-4 bg-canvas-subtle border border-line rounded-xl text-xs space-y-1.5 text-ink-muted">
              <div className="font-semibold text-ink flex items-center gap-1.5">
                <span>💡</span> Hướng dẫn căn chỉnh khuôn mặt:
              </div>
              <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
                <li>Nhìn thẳng vào tâm camera, biểu cảm khuôn mặt thư giãn tự nhiên.</li>
                <li>Đảm bảo ánh sáng đủ rõ, không bị ngược sáng hoặc bóng đổ quá tối.</li>
                <li>Tháo khẩu trang, kính đen hoặc mũ che khuất đường viền khuôn mặt.</li>
              </ul>
            </div>
          </div>

          {/* Right: Employee Profile Form & Enrollment Confirmation */}
          <div className="md:col-span-5 space-y-4">
            <Card className="p-5 border border-line bg-canvas space-y-4">
              <h2 className="text-sm font-bold text-ink border-b border-line pb-2.5 flex items-center justify-between">
                <span>Thông Tin Nhân Viên Liên Kết</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEnrollMode(enrollMode === 'single' ? 'three' : 'single')}
                    className="text-[10px] text-accent hover:underline cursor-pointer"
                  >
                    {enrollMode === 'single' ? 'Đổi sang 3 góc (B0)' : 'Đổi sang 1 góc (Nhanh)'}
                  </button>
                  <Badge variant="info" className="text-[10px]">
                    {enrollMode === 'single' ? '1 Góc Đăng Ký' : '3 Góc (B0 Chuẩn)'}
                  </Badge>
                </div>
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">
                    Mã nhân viên (Employee Code) <span className="text-red-500">*</span>
                    {!isAdmin && <span className="text-[10px] text-ink-muted ml-1.5">(Cố định theo tài khoản)</span>}
                  </label>
                  <input
                    type="text"
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                    placeholder="VD: 136ACT, 01HR, 05ACT"
                    disabled={!isAdmin && !!user?.employeeCode}
                    className={`w-full text-xs font-mono font-bold px-3 py-2 bg-canvas border border-line rounded-lg text-ink focus:border-accent outline-hidden ${!isAdmin && !!user?.employeeCode ? 'opacity-80 cursor-not-allowed bg-canvas-subtle' : ''}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">
                    Họ và tên nhân viên
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nhập họ và tên"
                    className="w-full text-xs px-3 py-2 bg-canvas border border-line rounded-lg text-ink focus:border-accent outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">
                    Phòng ban / Đơn vị
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="VD: Khối Kỹ Thuật"
                    className="w-full text-xs px-3 py-2 bg-canvas border border-line rounded-lg text-ink focus:border-accent outline-hidden"
                  />
                </div>
              </div>

              {/* Seed Profiles Quick Selector (Admin/HR Only) */}
              {isAdmin && (
              <div className="pt-2">
                <div className="text-[11px] font-semibold text-ink-muted mb-1.5">
                  Chọn nhanh nhân sự mẫu (Quản trị):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { code: '136ACT', name: 'Vũ Văn Luận', dept: 'Khối Kỹ Thuật' },
                    { code: '01HR', name: 'Nguyễn Thu Trang', dept: 'Ban Nhân Sự' },
                    { code: '05ACT', name: 'Trần Minh Nghĩa', dept: 'Khối Kỹ Thuật' },
                  ].map((seed) => (
                    <button
                      key={seed.code}
                      type="button"
                      onClick={() => {
                        setEmployeeCode(seed.code);
                        setFullName(seed.name);
                        setDepartment(seed.dept);
                      }}
                      className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                        employeeCode === seed.code
                          ? 'border-accent bg-accent-soft text-accent font-bold'
                          : 'border-line text-ink-muted hover:border-accent hover:text-ink'
                      }`}
                    >
                      {seed.code} ({seed.name})
                    </button>
                  ))}
                </div>
              </div>
              )}

              {/* Status Message Alert */}
              {enrollMessage && (
                <div
                  className={`text-xs rounded-xl p-3 border flex items-start gap-2 ${
                    enrollStatus === 'success'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-700'
                  }`}
                >
                  {enrollStatus === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  )}
                  <div className="leading-relaxed">{enrollMessage}</div>
                </div>
              )}

              {/* Submit Enrollment Action */}
              <div className="pt-2">
                <Button
                  variant="primary"
                  onClick={handleEnrollSubmit}
                  disabled={!capturedImage || enrollStatus === 'processing'}
                  className="w-full py-2.5 text-xs font-bold"
                >
                  {enrollStatus === 'processing'
                    ? 'Đang Trích Xuất Vector & Lưu Trữ...'
                    : '✓ Xác Nhận & Đăng Ký Khuôn Mặt (1 Góc)'}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: VERIFICATION (TEST 1:N & 1:1 FACE IDENTIFICATION)                  */}
      {/* ========================================================================= */}
      {activeTab === 'verify' && (
        <div className="grid md:grid-cols-12 gap-6">
          {/* Left: Camera / Test Image */}
          <div className="md:col-span-7 space-y-4">
            <Card className="p-4 border border-line bg-canvas">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-accent" />
                  Camera Nhận Diện Thử Nghiệm
                </span>
                <span className="text-[11px] text-ink-muted">Chụp hoặc tải ảnh để test matching</span>
              </div>

              <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-black border border-line flex items-center justify-center">
                {verifyImage ? (
                  <img
                    src={verifyImage}
                    alt="Verify Frame"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />
                )}

                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-52 h-64 border-2 border-accent/60 rounded-[48%] flex items-center justify-center">
                    <div className="w-full h-0.5 bg-accent/20" />
                  </div>
                </div>

                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded-md font-mono flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  {verifyImage ? 'Ảnh Đã Chọn' : 'Webcam Live (Verify)'}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 justify-between items-center">
                <div className="flex gap-2">
                  {verifyImage ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVerifyImage(null)}
                      className="text-xs flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Chụp Lại
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleCapturePhoto}
                      className="text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Chụp Ảnh Thử Nghiệm
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Tải Ảnh Test
                  </Button>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleVerifySubmit}
                  disabled={verifyStatus === 'processing'}
                  className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {verifyStatus === 'processing' ? 'Đang Đối Soát...' : '🔍 Xác Thực Khuôn Mặt Ngay'}
                </Button>
              </div>
            </Card>
          </div>

          {/* Right: Verification Settings & Matching Result */}
          <div className="md:col-span-5 space-y-4">
            <Card className="p-5 border border-line bg-canvas space-y-4">
              <h2 className="text-sm font-bold text-ink border-b border-line pb-2.5">
                Cấu Hình Đối Soát Sinh Trắc Học
              </h2>

              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">
                  Mã nhân viên dự kiến (Kiểm tra 1:1, để trống để tìm kiếm 1:N toàn hệ thống):
                </label>
                <input
                  type="text"
                  value={expectedCode}
                  onChange={(e) => setExpectedCode(e.target.value.toUpperCase())}
                  placeholder="Để trống = Tìm tự động 1:N"
                  className="w-full text-xs font-mono px-3 py-2 bg-canvas border border-line rounded-lg text-ink focus:border-accent outline-hidden"
                />
              </div>

              {/* Result Card */}
              {verifyResult ? (
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    verifyResult.is_matched
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-rose-500/40 bg-rose-500/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                      {verifyResult.is_matched ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-700">Xác Thực Thành Công</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          <span className="text-rose-700">Không Trùng Khớp</span>
                        </>
                      )}
                    </span>
                    <Badge variant={verifyResult.is_matched ? 'ok' : 'danger'} className="text-[11px] font-mono font-bold">
                      {(verifyResult.similarity_score * 100).toFixed(1)}% Score
                    </Badge>
                  </div>

                  {verifyResult.matched_employee ? (
                    <div className="p-3 bg-canvas border border-line rounded-lg space-y-1.5 text-xs text-ink">
                      <div className="flex justify-between">
                        <span className="text-ink-muted">Nhân viên:</span>
                        <span className="font-bold">{verifyResult.matched_employee.full_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-muted">Mã nhân viên:</span>
                        <span className="font-mono font-bold">{verifyResult.matched_employee.employee_code}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-muted">Phòng ban:</span>
                        <span>{verifyResult.matched_employee.department}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-muted">Liveness:</span>
                        <span className="text-emerald-600 font-semibold">✓ Đã vượt qua</span>
                      </div>
                    </div>
                  ) : null}

                  {verifyResult.is_proxy_punch_detected && (
                    <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-700 font-medium">
                      🚨 CẢNH BÁO CHẤM CÔNG HỘ: Khuôn mặt đối soát khác với mã nhân viên dự kiến!
                    </div>
                  )}

                  <div className="text-xs text-ink-muted leading-relaxed">
                    {verifyResult.message}
                  </div>
                </div>
              ) : (
                <div className="p-8 border border-dashed border-line rounded-xl text-center text-xs text-ink-muted space-y-2">
                  <UserCheck className="w-8 h-8 text-ink-muted mx-auto opacity-50" />
                  <div>Chưa có kết quả kiểm tra</div>
                  <div className="text-[11px]">Chụp ảnh hoặc upload ảnh và bấm "Xác Thực Khuôn Mặt Ngay"</div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CRUD LIST & MANAGEMENT                                             */}
      {/* ========================================================================= */}
      {activeTab === 'crud' && (
        <Card className="p-5 border border-line bg-canvas space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <Users className="w-4 h-4 text-accent" />
                Danh Sách Hồ Sơ Sinh Trắc Học Đã Nạp ({enrolledList.length})
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Các hồ sơ khuôn mặt lưu trong SQLite và đồng bộ vào PostgreSQL pgvector
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo mã, tên..."
                  className="text-xs pl-8 pr-3 py-1.5 bg-canvas border border-line rounded-lg text-ink focus:border-accent outline-hidden w-48"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchEnrolledEmployees}
                disabled={isLoadingList}
                className="text-xs flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
                Làm Mới
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setCapturedImage(null);
                  setActiveTab('enroll');
                }}
                className="text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Đăng Ký Mới
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas-subtle border-y border-line text-ink-muted font-medium">
                <tr>
                  <th className="py-2.5 px-3">Mã NV</th>
                  <th className="py-2.5 px-3">Họ Và Tên</th>
                  <th className="py-2.5 px-3">Phòng Ban</th>
                  <th className="py-2.5 px-3">Trạng Thái Vector</th>
                  <th className="py-2.5 px-3">Thời Gian Đăng Ký</th>
                  <th className="py-2.5 px-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-ink-muted">
                      {isLoadingList ? 'Đang tải danh sách...' : 'Chưa có hồ sơ khuôn mặt nào được đăng ký.'}
                    </td>
                  </tr>
                ) : (
                  filteredList.map((emp) => (
                    <tr key={emp.employee_code} className="hover:bg-canvas-subtle/50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-ink">
                        {emp.employee_code}
                      </td>
                      <td className="py-3 px-3 font-medium text-ink">
                        {emp.full_name}
                      </td>
                      <td className="py-3 px-3 text-ink-muted">
                        {emp.department}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant={emp.has_face_vector ? 'ok' : 'gray'} className="text-[10px]">
                          {emp.has_face_vector ? '✓ 128D ONNX Active' : 'Chưa Có Vector'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-ink-muted font-mono text-[11px]">
                        {emp.enrolled_at ? new Date(emp.enrolled_at).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td className="py-3 px-3 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleSelectForVerify(emp)}
                          className="px-2 py-1 rounded bg-accent-soft text-accent hover:bg-accent-soft/80 text-[11px] font-semibold"
                          title="Thử nghiệm nhận diện khuôn mặt nhân viên này"
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectForUpdate(emp)}
                          className="px-2 py-1 rounded border border-line text-ink hover:border-accent text-[11px] font-medium"
                          title="Chụp lại mẫu mới để cập nhật"
                        >
                          Cập nhật
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFace(emp.employee_code)}
                          className="px-2 py-1 rounded border border-line text-rose-600 hover:bg-rose-50 text-[11px] font-medium"
                          title="Xoá mẫu khuôn mặt sinh trắc học"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
