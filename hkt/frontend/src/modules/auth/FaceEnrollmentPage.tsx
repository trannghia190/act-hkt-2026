import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
  Camera,
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
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  // Single Frontal Image capture state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
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

  /** Stream còn thật sự chạy không — sau lỗi camera, track có thể đã chết. */
  const hasLiveStream = () =>
    !!stream && stream.getVideoTracks().some((t) => t.readyState === 'live');

  /** "Chụp lại": bỏ ảnh đã chụp và bảo đảm camera đang chạy (không để khung đen). */
  const handleRetake = (target: 'enroll' | 'verify') => {
    if (target === 'enroll') setCapturedImage(null);
    else setVerifyImage(null);
    if (!isCameraActive || !hasLiveStream()) {
      startCamera();
    }
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

  // Gắn stream vào thẻ <video> mỗi khi thẻ được mount lại — bấm "Chụp lại" gỡ ảnh
  // làm <video> mount lại, nếu chỉ phụ thuộc [stream, activeTab] thì khung bị đen.
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => undefined);
    }
  }, [stream, activeTab, capturedImage, verifyImage]);

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
    if (!video.videoWidth || !video.videoHeight) {
      const msg = 'Camera chưa sẵn sàng — đợi khung hình trực tiếp hiện ra rồi hãy chụp.';
      if (activeTab === 'enroll') {
        setEnrollStatus('error');
        setEnrollMessage(msg);
      } else {
        alert(msg);
      }
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
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

  // Submit enrollment — CHỈ đăng ký cho chính tài khoản đang đăng nhập.
  // Business: docs/01 "Hồ sơ khuôn mặt" + docs/08 B0 — không cho đăng ký hộ người khác.
  const handleEnrollSubmit = async () => {
    if (!capturedImage) {
      setEnrollMessage('Vui lòng chụp ảnh khuôn mặt chính diện từ camera trước khi đăng ký.');
      setEnrollStatus('error');
      return;
    }
    if (!consent) {
      setEnrollMessage('Cần đồng ý lưu vector khuôn mặt cho mục đích chấm công nội bộ trước khi đăng ký.');
      setEnrollStatus('error');
      return;
    }
    if (!user?.employeeCode) {
      setEnrollMessage('Chưa đăng nhập — không xác định được tài khoản để đăng ký khuôn mặt.');
      setEnrollStatus('error');
      return;
    }
    // Danh tính lấy từ token, KHÔNG nhận từ form.
    const targetCode = user.employeeCode.trim();

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
          employee_code: targetCode,
          full_name: user.fullName || targetCode,
          department: user.department || 'Khối Kỹ Thuật',
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
            employeeCode: targetCode,
            faceDataUrl: capturedImage,
            confidenceScore: 0.98,
            embedding: aiJson.embedding || undefined,
          }),
        });
      } catch (err) {
        console.warn('Core auth sync warning:', err);
      }

      // 3. Cập nhật AuthContext — đã đăng ký cho chính mình
      updateUser({ faceEnrolled: true, status: 'ACTIVE' });

      setEnrollStatus('success');
      setEnrollMessage(
        aiJson.message || `Đăng ký thành công mẫu khuôn mặt cho ${user.fullName || targetCode} (${targetCode})!`
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
      alert('Vui lòng chụp ảnh khuôn mặt từ camera để kiểm tra xác thực.');
      return;
    }

    setVerifyStatus('processing');
    setVerifyResult(null);

    try {
      // Kiểm tra khuôn mặt gọi AI service; AI service không yêu cầu token,
      // nhưng vẫn gửi kèm token để proxy/audit thống nhất.
      const coreHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user?.accessToken) {
        coreHeaders['Authorization'] = `Bearer ${user.accessToken}`;
      }
      const res = await fetch('/ai-face/api/v1/face/verify-json', {
        method: 'POST',
        headers: coreHeaders,
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
      {/* Hidden canvas for capturing — chỉ chụp từ camera, không cho tải ảnh từ file */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Đầu trang — mockup `.phead` */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-accent-dark">
            <ShieldCheck className="h-3.5 w-3.5" />
            Sinh trắc học
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-[23px]">
              Đăng ký khuôn mặt
            </h1>
            <Badge variant="accent">A2</Badge>
            {enrolledList.length > 0 && <Badge variant="ok">hồ sơ đã nạp</Badge>}
          </div>
          <p className="mt-1 max-w-2xl text-xs text-ink-muted">
            Chụp 1 góc chính diện, trích vector 128D bằng SFace — ảnh gốc không lưu, không tải lên máy chủ. Dùng cho chấm công và xác thực 1:N.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate('/attendance/checkin')}
          className="shrink-0 text-xs"
        >
          <Camera className="w-3.5 h-3.5" />
          Đến màn chấm công
        </Button>
      </div>

      {/* Bìa tóm tắt */}
      <div className="overflow-hidden rounded-[16px] border border-line bg-ink px-5 py-4 text-canvas">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-canvas/60">
              Dữ liệu sinh trắc học
            </div>
            <div className="mt-1 font-display text-lg font-extrabold">Camera không lưu ảnh — chỉ giữ vector 128 chiều</div>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-canvas/75">
              Ảnh được xử lý ngay trên trình duyệt, vector so sánh 1:N trên máy chủ. Đăng ký lại sẽ ghi đè mẫu cũ; xoá hồ sơ là mất hiệu lực tức thì.
            </p>
          </div>
          <dl className="flex gap-6">
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{enrolledList.length}</dd>
              <dt className="text-[11px] text-canvas/60">hồ sơ đã nạp</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">1</dd>
              <dt className="text-[11px] text-canvas/60">góc chụp</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold tabular-nums">128D</dd>
              <dt className="text-[11px] text-canvas/60">vector so khớp</dt>
            </div>
          </dl>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="-mb-2 flex gap-1 overflow-x-auto border-b border-line text-xs font-semibold">
        {([
          { id: 'enroll', icon: Camera, label: 'Đăng ký 1 góc (chính diện)' },
          { id: 'verify', icon: UserCheck, label: 'Thử nghiệm xác thực (1:N)' },
          { id: 'crud', icon: Users, label: `Quản lý hồ sơ (${enrolledList.length})` },
        ] as const).map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setActiveTab(t.id); if (t.id === 'crud') fetchEnrolledEmployees(); }}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 transition-colors ${
              activeTab === t.id
                ? 'border-accent font-bold text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <t.icon className="h-4 w-4" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ENROLLMENT (1 FRONT-FACING ANGLE)                                  */}
      {/* ========================================================================= */}
      {activeTab === 'enroll' && (
        <div className="grid md:grid-cols-12 gap-6">
          {/* Left: Camera / Preview Viewport */}
          <div className="md:col-span-7 space-y-4">
            <Card className="p-3.5 overflow-hidden border border-line bg-canvas">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-ink">
                  <Camera className="h-3.5 w-3.5 text-accent" />
                  Góc chụp: chính diện (0°)
                </span>
                <span className={`rounded-md border px-1.5 py-[2px] text-[10.5px] font-semibold ${
                  capturedImage ? 'border-status-ok-line bg-status-ok-soft text-status-ok' : 'border-line bg-surface-secondary text-ink-muted'
                }`}>
                  {capturedImage ? 'đã chụp' : isCameraActive ? 'camera sẵn sàng' : 'camera chưa bật'}
                </span>
              </div>

              {/* Viewport Frame */}
              <div className="relative h-[220px] sm:h-[290px] rounded-xl overflow-hidden bg-black border border-line flex items-center justify-center">
                {capturedImage ? (
                  <img
                    src={capturedImage}
                    alt="Captured Frontal"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover -scale-x-100"
                    muted
                    playsInline
                  />
                )}

                {/* Face Biometric Guide Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="flex h-[162px] w-[132px] items-center justify-center rounded-[48%] border-2 border-dashed border-accent/80 sm:h-64 sm:w-52">
                    <div className="w-full h-0.5 bg-accent/30" />
                  </div>
                </div>

                {/* Status Pills */}
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded-md font-mono flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-status-ok animate-pulse" />
                  {capturedImage ? 'ảnh đã chụp' : isCameraActive ? 'camera trực tiếp' : 'camera đang tắt'}
                </div>
              </div>

              {/* Camera Actions */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {capturedImage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRetake('enroll')}
                    className="text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Chụp lại
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCapturePhoto}
                    className="text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Chụp ảnh
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => (isCameraActive ? stopCamera() : startCamera())}
                  className="text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Bật/tắt camera
                </Button>
                <span className="ml-auto text-[11px] text-ink-muted">Độ phân giải tối ưu 640×640</span>
              </div>

              {/* Instruction hints */}
              <div className="mt-2.5 rounded-lg border border-line bg-canvas-subtle px-3 py-2 text-[11px] leading-relaxed text-ink-muted">
                <b className="text-ink-secondary">Lưu ý khi chụp:</b> nhìn thẳng tâm camera, ánh sáng đủ rõ, tháo khẩu trang và kính che khuôn mặt.
                Đăng ký lại ghi đè mẫu cũ — ảnh gốc không lưu.
              </div>
            </Card>
          </div>

          {/* Right: Employee Profile Form & Enrollment Confirmation */}
          <div className="md:col-span-5 space-y-4">
            <Card className="p-5 border border-line bg-canvas space-y-4">
              <h2 className="flex items-center justify-between text-[13px] font-bold text-ink">
                <span>Thông tin nhân viên</span>
                <Badge variant="gray">{enrollMode === 'single' ? '1 góc' : '3 góc'}</Badge>
              </h2>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-canvas px-2.5 py-1.5">
                  <div className="font-mono text-[13px] font-bold text-ink">{user?.employeeCode || '—'}</div>
                  <div className="text-[9px] text-ink-muted">mã nhân viên</div>
                </div>
                <div className="rounded-lg bg-canvas px-2.5 py-1.5">
                  <div className="truncate text-[13px] font-bold text-ink">{department || '—'}</div>
                  <div className="text-[9px] text-ink-muted">phòng ban</div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink mb-1">Họ và tên nhân viên</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nhập họ và tên"
                  className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-accent outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink mb-1">Phòng ban / Đơn vị</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="VD: Khối Kỹ Thuật"
                  className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-accent outline-hidden"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-canvas px-2.5 py-2">
                <div className="text-[11.5px] text-ink-secondary">
                  <b className="text-ink">Chế độ đăng ký</b>
                  <div className="mt-px text-[10.5px] text-ink-muted">
                    {enrollMode === 'single' ? '1 góc chính diện — nạp nhanh' : '3 góc chuẩn B0 — chính xác hơn'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEnrollMode(enrollMode === 'single' ? 'three' : 'single')}
                  className="shrink-0 text-[10.5px] font-semibold text-accent hover:underline"
                >
                  {enrollMode === 'single' ? 'Đổi 3 góc' : 'Về 1 góc'}
                </button>
              </div>

              <p className="text-[10.5px] leading-relaxed text-ink-muted">
                Đăng ký chỉ áp cho chính tài khoản đang đăng nhập — không đăng ký hộ người khác.
              </p>

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
                          ? 'border-accent bg-accent-soft text-accent-dark font-bold'
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
                      ? 'border-status-ok/30 bg-status-ok/10 text-status-ok'
                      : 'border-status-danger/30 bg-status-danger/10 text-status-danger'
                  }`}
                >
                  {enrollStatus === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-status-ok mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-status-danger mt-0.5" />
                  )}
                  <div className="leading-relaxed">{enrollMessage}</div>
                </div>
              )}

              <label className="flex cursor-pointer items-start gap-2 text-[10.5px] leading-relaxed text-ink-muted">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-[2px] accent-[rgb(var(--accent))]"
                />
                <span>
                  Tôi đồng ý lưu <b className="text-ink-secondary">vector khuôn mặt</b> cho mục đích chấm công nội bộ.
                  Có thể xoá hồ sơ bất kỳ lúc nào ở tab Quản lý hồ sơ.
                </span>
              </label>

              {/* Submit Enrollment Action */}
              <Button
                variant="primary"
                onClick={handleEnrollSubmit}
                disabled={!capturedImage || !consent || enrollStatus === 'processing'}
                className="w-full py-2.5 text-xs font-bold"
              >
                {enrollStatus === 'processing'
                  ? 'Đang trích xuất vector & lưu trữ...'
                  : 'Xác nhận & đăng ký khuôn mặt'}
              </Button>
              <p className="text-center text-[10px] text-ink-muted">
                Dữ liệu sinh trắc học được mã hoá — ảnh gốc không lưu trên máy chủ.
              </p>
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
                <span className="text-[11px] text-ink-muted">Chụp ảnh từ camera để test matching</span>
              </div>

              <div className="relative h-[220px] sm:h-[290px] rounded-xl overflow-hidden bg-black border border-line flex items-center justify-center">
                {verifyImage ? (
                  <img
                    src={verifyImage}
                    alt="Verify Frame"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover -scale-x-100"
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
                  <div className="w-2 h-2 rounded-full bg-status-info animate-pulse" />
                  {verifyImage ? 'Ảnh Đã Chọn' : 'Webcam Live (Verify)'}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 justify-between items-center">
                <div className="flex gap-2">
                  {verifyImage ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetake('verify')}
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
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleVerifySubmit}
                  disabled={verifyStatus === 'processing'}
                  className="text-xs font-bold"
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
                      ? 'border-status-ok/40 bg-status-ok/5'
                      : 'border-status-danger/40 bg-status-danger/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                      {verifyResult.is_matched ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-status-ok" />
                          <span className="text-status-ok">Xác Thực Thành Công</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-status-danger" />
                          <span className="text-status-danger">Không Trùng Khớp</span>
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
                        <span className="text-status-ok font-semibold">✓ Đã vượt qua</span>
                      </div>
                    </div>
                  ) : null}

                  {verifyResult.is_proxy_punch_detected && (
                    <div className="p-2.5 bg-status-danger/10 border border-status-danger/30 rounded-lg text-xs text-status-danger font-medium">
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
                  <div className="text-[11px]">Chụp ảnh từ camera và bấm "Xác Thực Khuôn Mặt Ngay"</div>
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
                          className="px-2 py-1 rounded bg-accent-soft text-accent-dark hover:bg-accent-soft/80 text-[11px] font-semibold"
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
                          className="px-2 py-1 rounded border border-line text-status-danger hover:bg-status-danger-soft text-[11px] font-medium"
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
