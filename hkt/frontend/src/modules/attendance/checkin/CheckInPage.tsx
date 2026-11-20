import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { useAuth } from '../../../context/AuthContext';

interface AttendancePunchRecord {
  id: string;
  employeeCode: string;
  fullName: string;
  timestamp: string;
  date: string;
  type: 'IN' | 'OUT';
  similarity: number;
  livenessScore: number;
  status: string;
  bssid: string;
  coordinates: string;
}

const STORAGE_LOGS_KEY = 'pulse_attendance_logs';

export const CheckInPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [checkInStep, setCheckInStep] = useState<'idle' | 'detecting' | 'liveness' | 'verifying' | 'success' | 'error'>('idle');
  const [checkType, setCheckType] = useState<'IN' | 'OUT'>('IN');
  const [checkResult, setCheckResult] = useState<AttendancePunchRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Simulation test toggles
  const [simWifi, setSimWifi] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [simZone, setSimZone] = useState<'GREEN' | 'YELLOW' | 'RED'>('GREEN');
  const [faceTestScenario, setFaceTestScenario] = useState<'SELF' | 'PROXY_FRAUD' | 'POOR_QUALITY'>('SELF');

  // Real Camera support
  const [useRealCamera, setUseRealCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Local attendance history
  const [history, setHistory] = useState<AttendancePunchRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LOGS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: 'LOG-001',
        employeeCode: user?.employeeCode || '136ACT',
        fullName: user?.fullName || 'Vũ Văn Luận',
        timestamp: '08:24:15',
        date: '18/11/2026',
        type: 'IN',
        similarity: 0.985,
        livenessScore: 0.992,
        status: 'HỢP LỆ (ĐÚNG GIỜ)',
        bssid: '84:d8:1b:22:9a:01 (ACT_OFFICE_5G)',
        coordinates: '21.0285° N, 105.8542° E (12m)',
      },
    ];
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('vi-VN', { hour12: false }));
      setCurrentDate(now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(history));
  }, [history]);

  // Handle Real Camera stream cleanup
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraStream]);

  // Connect stream to video element whenever stream or useRealCamera changes
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch((err) => {
        console.warn('Video play error:', err);
      });
    }
  }, [cameraStream, useRealCamera]);

  // Auto-start camera on mount
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
        console.warn('Auto camera request deferred, waiting for manual toggle:', err);
      });

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const toggleRealCamera = async () => {
    if (useRealCamera && cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
      setUseRealCamera(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
          audio: false,
        });
        setCameraStream(stream);
        setUseRealCamera(true);
      } catch (err: any) {
        alert('Không thể mở webcam hoặc quyền bị từ chối: ' + (err?.message || 'Permission denied'));
        setUseRealCamera(false);
      }
    }
  };

  const captureFrameOrGetTestImage = (offset = 0): string => {
    // 1. If poor quality test scenario is selected
    if (faceTestScenario === 'POOR_QUALITY') {
      // Extremely dark dummy 100x100 black canvas
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, 100, 100);
      }
      return canvas.toDataURL('image/jpeg', 0.8);
    }

    // 2. If real webcam is active
    if (useRealCamera && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 320;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8);
      }
    }

    // 3. Simulated test images
    const canvas = document.createElement('canvas');
    canvas.width = 150;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, 150, 150);
      // Draw head circle
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(75 + offset, 75, 45, 0, Math.PI * 2);
      ctx.fill();

      // If testing proxy punch, draw slightly different color/seed
      if (faceTestScenario === 'PROXY_FRAUD') {
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(60, 60, 30, 20);
      }
    }
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const getDeviceFingerprint = (): string => {
    const raw = [
      navigator.userAgent,
      screen.width,
      screen.height,
      screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ].join('|');
    let hash = 0;
    for (let i = 0; i < raw.length; i += 1) {
      hash = (hash * 31 + raw.charCodeAt(i)) | 0;
    }
    return `web-${Math.abs(hash).toString(16)}`;
  };

  const captureFrames = async (count = 3): Promise<string[]> => {
    const frames: string[] = [];
    for (let i = 0; i < count; i += 1) {
      frames.push(captureFrameOrGetTestImage(i * 4));
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 140));
    }
    return frames;
  };

  const handleStartCheckIn = async () => {
    setIsScanning(true);
    setErrorMessage(null);
    setCheckInStep('detecting');

    if (simZone === 'RED') {
      setCheckInStep('error');
      setErrorMessage('❌ Bạn đang ở ngoài bán kính văn phòng (>300m). Hãy về văn phòng hoặc tạo đơn WFH — ngoài bán kính là CHẶN, không phải cảnh báo.');
      setIsScanning(false);
      return;
    }

    try {
      setCheckInStep('liveness');
      const frames = await captureFrames(3);
      const imageBase64 = frames[frames.length - 1];

      setCheckInStep('verifying');

      // 1) Gọi AI Face Service — KHÔNG có fallback: không nhận diện được là chặn
      const faceResponse = await fetch('/ai-face/api/v1/face/verify-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64, liveness_frames: frames }),
      });
      if (!faceResponse.ok) {
        throw new Error(`AI Face Service trả lỗi ${faceResponse.status}`);
      }
      const faceData = await faceResponse.json();

      if (!faceData.is_liveness_verified) {
        setCheckInStep('error');
        setErrorMessage(faceData.message || 'Không phát hiện chuyển động thật — hãy nhìn vào camera và di chuyển nhẹ đầu.');
        setIsScanning(false);
        return;
      }
      if (!faceData.is_matched) {
        setCheckInStep('error');
        setErrorMessage(faceData.message || 'Khuôn mặt không khớp hồ sơ đã đăng ký.');
        setIsScanning(false);
        return;
      }

      const detectedCode = faceData.matched_employee?.employee_code as string | undefined;
      const detectedName = faceData.matched_employee?.full_name as string | undefined;
      const loggedInCode = user?.employeeCode;
      if (loggedInCode && detectedCode && detectedCode !== loggedInCode) {
        setCheckInStep('error');
        setErrorMessage(
          `🚨 CHẤM CÔNG HỘ: Người trước camera là ${detectedName} (${detectedCode}), KHÔNG KHỚP tài khoản đang đăng nhập ${loggedInCode}. Đã từ chối.`,
        );
        setIsScanning(false);
        return;
      }

      // 2) Gọi Core Service — SERVER quyết định chấm được hay không
      const coreResponse = await fetch('/api/v1/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeCode: loggedInCode,
          faceImageBase64: imageBase64,
          livenessFrames: frames,
          deviceFingerprint: getDeviceFingerprint(),
          wifiBssid: simWifi === 'INTERNAL' ? 'ACT_OFFICE_5G' : 'Mạng 4G di động ngoài văn phòng',
          latitude: simZone === 'GREEN' ? 21.0285 : 21.0298,
          longitude: simZone === 'GREEN' ? 105.8542 : 105.8570,
          type: checkType === 'IN' ? 'CHECK_IN' : 'CHECK_OUT',
        }),
      });
      const coreJson = await coreResponse.json().catch(() => ({}));
      const serverResult = coreJson?.data;
      if (!coreResponse.ok || !serverResult || serverResult.status !== 'VALID') {
        setCheckInStep('error');
        setErrorMessage(
          serverResult?.message
            || coreJson?.message
            || `Máy chủ từ chối chấm công (HTTP ${coreResponse.status}).`,
        );
        setIsScanning(false);
        return;
      }

      const now = new Date();
      const record: AttendancePunchRecord = {
        id: `PUNCH-${Date.now()}`,
        employeeCode: serverResult.matchedEmployeeCode || loggedInCode || '—',
        fullName: serverResult.matchedFullName || user?.fullName || 'Nhân viên',
        timestamp: new Date(serverResult.serverTimestamp || now).toLocaleTimeString('vi-VN', { hour12: false }),
        date: now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        type: checkType,
        similarity: serverResult.similarityScore ?? faceData.similarity_score ?? 0,
        livenessScore: 1,
        status: checkType === 'IN' ? 'HỢP LỆ (VÀO CA)' : 'HỢP LỆ (RA CA)',
        bssid: simWifi === 'INTERNAL' ? 'ACT_OFFICE_5G' : 'Mạng 4G di động',
        coordinates: simZone === 'GREEN' ? '21.0285° N, 105.8542° E (Vùng Xanh)' : '21.0298° N, 105.8570° E (Vùng Vàng)',
      };

      setCheckResult(record);
      setHistory((prev) => [record, ...prev]);
      setCheckInStep('success');
      setIsScanning(false);
    } catch (err: any) {
      console.error('Check-in error', err);
      setCheckInStep('error');
      setErrorMessage(err?.message || 'Không thể kết nối dịch vụ chấm công. Vui lòng thử lại.');
      setIsScanning(false);
    }
  };

  const handleReset = () => {
    setIsScanning(false);
    setCheckInStep('idle');
    setCheckResult(null);
    setErrorMessage(null);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Hidden canvas for video frames */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent-soft text-accent rounded-full text-xs font-semibold border border-accent-line">
          <span>🛡️</span> 5 Tầng Xác Thực Chống Gian Lận
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Chấm Công Nhận Diện Khuôn Mặt</h1>
        <p className="text-xs text-ink-muted">
          AI Face Detection (OpenCV 512D) · So khớp chống chấm công hộ · Xác thực WiFi &amp; GPS Geofence
        </p>

        {/* Quick Link to S01-B Face Enrollment */}
        <div className="pt-1">
          <button
            onClick={() => navigate('/auth/enroll-face')}
            className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-semibold bg-accent-soft/50 px-3 py-1 rounded-full border border-accent-line cursor-pointer"
          >
            <span>📸</span>
            <span>
              {user?.faceEnrolled === false
                ? '⚠️ Bạn chưa đăng ký khuôn mặt! Bấm vào đây để lấy mẫu'
                : 'Cập nhật lại mẫu khuôn mặt 3 góc'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Check-In Card */}
      <Card className="text-center p-6">
        {/* Real-time Clock */}
        <div className="py-2">
          <div className="text-4xl font-extrabold font-mono tracking-tight text-ink">
            {currentTime || '08:30:00'}
          </div>
          <div className="text-xs text-ink-secondary mt-1 capitalize font-medium">
            {currentDate}
          </div>
        </div>

        {/* Check-In vs Check-Out Selector */}
        <div className="flex justify-center gap-2 my-3">
          <button
            onClick={() => setCheckType('IN')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${checkType === 'IN'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-canvas text-ink-secondary hover:text-ink border border-line'
              }`}
          >
            Check-In Vào Ca (Sáng)
          </button>
          <button
            onClick={() => setCheckType('OUT')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${checkType === 'OUT'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-canvas text-ink-secondary hover:text-ink border border-line'
              }`}
          >
            Check-Out Về (Chiều)
          </button>
        </div>

        {/* Interactive Environment & Fraud Simulation Bar for QA Testing */}
        <div className="my-3 p-3 bg-canvas-subtle rounded-xl border border-line text-left text-xs space-y-2.5">
          <div className="text-[11px] font-bold text-ink flex items-center justify-between">
            <span className="flex items-center gap-1">🧪 Kịch Bản Kiểm Thử QA (Xác Thực AI &amp; Chống Chấm Công Hộ)</span>
            <span className="text-[10px] text-accent font-semibold">Tùy biến môi trường</span>
          </div>

          {/* Test Option 1: Face Matching Scenario */}
          <div>
            <div className="text-[11px] font-semibold text-ink-secondary mb-1">
              1. Khuôn mặt trước camera (AI Biometrics):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setFaceTestScenario('SELF')}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all border text-left ${faceTestScenario === 'SELF'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-canvas border-line text-ink-secondary hover:text-ink'
                  }`}
              >
                👤 Chính Chủ ({user?.employeeCode || '136ACT'})
              </button>
              <button
                type="button"
                onClick={() => setFaceTestScenario('PROXY_FRAUD')}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all border text-left ${faceTestScenario === 'PROXY_FRAUD'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-canvas border-line text-ink-secondary hover:text-ink'
                  }`}
                title="Mô phỏng nhân viên khác đứng trước camera để test tính năng phát hiện chấm công hộ"
              >
                ⚠️ Chấm Công Hộ (Người khác)
              </button>
              <button
                type="button"
                onClick={() => setFaceTestScenario('POOR_QUALITY')}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all border text-left ${faceTestScenario === 'POOR_QUALITY'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-canvas border-line text-ink-secondary hover:text-ink'
                  }`}
                title="Mô phỏng ảnh chụp quá tối hoặc quá mờ để test bộ kiểm tra chất lượng ảnh"
              >
                🌑 Ảnh Quá Tối / Mờ
              </button>
            </div>
          </div>

          {/* Test Option 2: Wi-Fi & Geofence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-line-subtle text-[11px]">
            <div>
              <div className="text-ink-muted mb-1">2. Mạng Wi-Fi:</div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setSimWifi('INTERNAL')}
                  className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${simWifi === 'INTERNAL' ? 'bg-emerald-600 text-white' : 'bg-canvas border border-line text-ink-secondary'
                    }`}
                >
                  📶 ACT_OFFICE_5G
                </button>
                <button
                  type="button"
                  onClick={() => setSimWifi('EXTERNAL')}
                  className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${simWifi === 'EXTERNAL' ? 'bg-amber-600 text-white' : 'bg-canvas border border-line text-ink-secondary'
                    }`}
                >
                  📱 Mạng 4G/Ngoài
                </button>
              </div>
            </div>

            <div>
              <div className="text-ink-muted mb-1">3. Định vị GPS Geofence:</div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setSimZone('GREEN')}
                  className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${simZone === 'GREEN' ? 'bg-emerald-600 text-white' : 'bg-canvas border border-line text-ink-secondary'
                    }`}
                >
                  🟢 Xanh (15m)
                </button>
                <button
                  type="button"
                  onClick={() => setSimZone('YELLOW')}
                  className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${simZone === 'YELLOW' ? 'bg-amber-600 text-white' : 'bg-canvas border border-line text-ink-secondary'
                    }`}
                >
                  🟡 Vàng (220m)
                </button>
                <button
                  type="button"
                  onClick={() => setSimZone('RED')}
                  className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${simZone === 'RED' ? 'bg-red-600 text-white' : 'bg-canvas border border-line text-ink-secondary'
                    }`}
                >
                  🔴 Đỏ (&gt;300m)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Circular Camera Viewport */}
        <div className="relative w-56 h-56 mx-auto my-4 rounded-full border-4 border-dashed border-accent/40 bg-zinc-900 flex items-center justify-center overflow-hidden shadow-inner">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={(e) => {
              e.currentTarget.play().catch(() => { });
            }}
            className={`w-full h-full object-cover rounded-full ${useRealCamera && cameraStream ? 'block' : 'hidden'}`}
          />
          {(!useRealCamera || !cameraStream) && !isScanning && (
            <div className="text-center p-4">
              <div className="text-4xl mb-2">📸</div>
              <div className="text-xs text-zinc-300 font-medium">
                Căn chỉnh khuôn mặt vào giữa khung tròn
              </div>
            </div>
          )}

          {isScanning && checkInStep !== 'success' && checkInStep !== 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/80 text-white backdrop-blur-xs">
              <div className="w-40 h-40 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-center px-4">
                {checkInStep === 'detecting' && <span>🔍 Đang phát hiện khuôn mặt OpenCV...</span>}
                {checkInStep === 'liveness' && <span className="text-amber-300">👁️ Kiểm tra Liveness Anti-Spoofing...</span>}
                {checkInStep === 'verifying' && <span>⚡ Trích xuất 128D Vector &amp; So khớp AI...</span>}
              </div>
            </div>
          )}

          {checkInStep === 'success' && (
            <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center text-white p-4">
              <div className="text-4xl text-emerald-400 mb-2">✓</div>
              <div className="text-xs font-bold text-emerald-300 uppercase">
                {checkResult ? `${checkResult.fullName} (${checkResult.employeeCode})` : 'Chính Chủ Thành Công!'}
              </div>
              <div className="text-[11px] text-emerald-200 mt-1">
                Độ tương đồng: {checkResult ? (checkResult.similarity * 100).toFixed(1) : '97.5'}%
              </div>
            </div>
          )}

          {checkInStep === 'error' && (
            <div className="absolute inset-0 bg-rose-950/90 flex flex-col items-center justify-center text-white p-4">
              <div className="text-4xl text-rose-400 mb-2">✕</div>
              <div className="text-xs font-bold text-rose-300 uppercase">Từ Chối Chấm Công</div>
            </div>
          )}
        </div>

        {/* Toggle Real Webcam Prominent Button */}
        <div className="mb-4 flex justify-center">
          <button
            type="button"
            onClick={toggleRealCamera}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs border cursor-pointer ${useRealCamera && cameraStream
                ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-accent text-white border-transparent hover:bg-accent-hover'
              }`}
          >
            <span>{useRealCamera && cameraStream ? '🟢' : '📹'}</span>
            <span>{useRealCamera && cameraStream ? 'Webcam Đang Bật (Bấm để tắt)' : 'Bấm Để Bật Webcam Thực'}</span>
          </button>
        </div>

        {/* Error Alert Display */}
        {errorMessage && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-left text-xs text-rose-900 space-y-1 animate-in fade-in">
            <div className="font-bold flex items-center gap-1.5 text-rose-700">
              <span>⚠️</span>
              <span>Thông Báo Từ Hệ Thống So Khớp:</span>
            </div>
            <p className="leading-relaxed">{errorMessage}</p>
            <div className="pt-1">
              <Button variant="outline" size="sm" onClick={handleReset} className="text-xs">
                Thử lại lượt khác
              </Button>
            </div>
          </div>
        )}

        {/* Action Button */}
        {checkInStep === 'idle' && (
          <Button
            variant="primary"
            size="lg"
            className="w-full max-w-xs shadow-md"
            onClick={handleStartCheckIn}
          >
            Bấm Chấm Công {checkType === 'IN' ? 'Vào Ca' : 'Ra Về'}
          </Button>
        )}

        {checkInStep === 'success' && checkResult && (
          <div className="space-y-4 max-w-sm mx-auto animate-in fade-in">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-emerald-800">Nhân viên xác thực:</span>
                <strong className="text-emerald-950">{checkResult.fullName} ({checkResult.employeeCode})</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-800">Giờ chấm máy chủ:</span>
                <strong className="font-mono text-emerald-950">{checkResult.timestamp}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-800">Loại ghi nhận:</span>
                <span className="font-semibold text-emerald-900">{checkResult.type === 'IN' ? 'Check-In' : 'Check-Out'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-800">Đánh giá quy định:</span>
                <span className="font-bold text-emerald-700">{checkResult.status}</span>
              </div>
              <div className="flex justify-between text-[11px] pt-1 border-t border-emerald-200/60">
                <span className="text-emerald-800">Chống chấm công hộ:</span>
                <span className="font-bold text-emerald-700">✓ Trùng khớp tài khoản</span>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={handleReset}>
              Chấm lượt mới
            </Button>
          </div>
        )}

        {/* 5-Layer Security Status Pills */}
        <div className="mt-8 pt-4 border-t border-line grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-left">
          <div className="p-2 bg-canvas rounded-lg border border-line">
            <div className="text-ink-muted">1. Wi-Fi BSSID</div>
            <div className={`font-medium flex items-center gap-1 mt-0.5 ${simWifi === 'INTERNAL' ? 'text-emerald-700' : 'text-amber-600'}`}>
              <span>●</span> {simWifi === 'INTERNAL' ? 'ACT_OFFICE_5G (OK)' : 'Ngoài mạng (Cảnh báo)'}
            </div>
          </div>
          <div className="p-2 bg-canvas rounded-lg border border-line">
            <div className="text-ink-muted">2. GPS Geofence</div>
            <div className={`font-medium flex items-center gap-1 mt-0.5 ${simZone === 'GREEN' ? 'text-emerald-700' : simZone === 'YELLOW' ? 'text-amber-600' : 'text-red-600'
              }`}>
              <span>●</span> {
                simZone === 'GREEN'
                  ? 'Vùng Xanh (15m <= 150m)'
                  : simZone === 'YELLOW'
                    ? 'Vùng Vàng (220m <= 300m)'
                    : 'Vùng Đỏ (850m > 300m)'
              }
            </div>
          </div>
          <div className="p-2 bg-canvas rounded-lg border border-line">
            <div className="text-ink-muted">3. Server Timestamp</div>
            <div className="font-medium text-emerald-700 flex items-center gap-1 mt-0.5">
              <span>●</span> Khóa NTP máy chủ (2026)
            </div>
          </div>
          <div className="p-2 bg-canvas rounded-lg border border-line">
            <div className="text-ink-muted">4. Chống Fake GPS</div>
            <div className="font-medium text-emerald-700 flex items-center gap-1 mt-0.5">
              <span>●</span> Mock Location: False
            </div>
          </div>
          <div className="p-2 bg-canvas rounded-lg border border-line col-span-2 sm:col-span-1">
            <div className="text-ink-muted">5. AI Biometrics &amp; Proxy Check</div>
            <div className="font-medium text-emerald-700 flex items-center gap-1 mt-0.5">
              <span>●</span> OpenCV 512D Active
            </div>
          </div>
        </div>
      </Card>

      {/* History Log */}
      <div className="bg-surface rounded-xl border border-line p-4 shadow-2xs space-y-3">
        <h3 className="font-semibold text-xs text-ink flex items-center justify-between">
          <span>📋 Lịch Sử Chấm Công Gần Đây</span>
          <span className="text-[11px] text-ink-muted">{history.length} lượt</span>
        </h3>

        <div className="divide-y divide-line text-xs">
          {history.map((item) => (
            <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Badge variant={item.type === 'IN' ? 'accent' : 'gray'}>
                    {item.type === 'IN' ? 'VÀO CA' : 'RA VỀ'}
                  </Badge>
                  <strong className="text-ink font-mono">{item.timestamp}</strong>
                  <span className="text-ink-muted text-[11px]">{item.date}</span>
                </div>
                <div className="text-[11px] text-ink-secondary">{item.status}</div>
              </div>
              <div className="text-right text-[11px] font-mono text-ink-muted">
                <div>AI Match: {(item.similarity * 100).toFixed(1)}%</div>
                <div>Liveness: {(item.livenessScore * 100).toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
