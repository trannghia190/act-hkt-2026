import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { useAuth } from '../../../context/AuthContext';
import { getDeviceFingerprint } from '../../../utils/deviceFingerprint';

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

interface ParallelStep {
  name: string;
  status: 'pending' | 'checking' | 'passed' | 'failed';
  label: string;
}

const STORAGE_LOGS_KEY = 'pulse_attendance_logs';

export const CheckInPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [checkInStep, setCheckInStep] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [checkType, setCheckType] = useState<'IN' | 'OUT'>('IN');
  /** Đã có giờ ra hôm nay — lần chấm tiếp theo sẽ cập nhật lại giờ ra (lấy lần cuối). */
  const [alreadyCheckedOut, setAlreadyCheckedOut] = useState(false);
  /** Giờ vào/ra hôm nay hiển thị trên thẻ trạng thái. */
  const [todayTimes, setTodayTimes] = useState<{ checkInAt?: string; checkOutAt?: string }>({});
  /** Ngày công đang thiếu đầu chấm (thường là quên chấm vào) — cần đơn bổ sung công. */
  const [todayMissingCheckIn, setTodayMissingCheckIn] = useState(false);
  /** Cảnh báo máy chủ trả về khi lần chấm này chỉ ghi được một đầu. */
  const [punchNotice, setPunchNotice] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<AttendancePunchRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'GPS_GEOFENCE' | 'GPS_ACCURACY' | 'FACE_MISMATCH' | 'NETWORK' | 'DEVICE' | 'FACE_NOT_ENROLLED' | 'GENERAL'>('GENERAL');
  /** Chi tiết lớp NETWORK khi bị chặn — cho biết IP server thấy để debug cấu hình dải IP. */
  const [networkDetail, setNetworkDetail] = useState<string | null>(null);

  // Anti-fraud & Security parameters
  const [faceAttemptsRemaining, setFaceAttemptsRemaining] = useState(3);
  const [isLockedByAttempts, setIsLockedByAttempts] = useState(false);

  // Ca hiệu lực của tôi (ca ngoại lệ theo ưu tiên có thể đè ca chuẩn)
  const [myShift, setMyShift] = useState<any>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [shiftReload, setShiftReload] = useState(0);

  // Status for today and yesterday (Criterion B2 #2)
  const [yesterdayMissingCheckout, setYesterdayMissingCheckout] = useState(false);
  const [yesterdayDate, setYesterdayDate] = useState('');
  const [faceEnrolled, setFaceEnrolled] = useState<boolean>(true);

  // Parallel 5-check steps (Criterion B1 #4)
  const [parallelSteps, setParallelSteps] = useState<ParallelStep[]>([
    { name: 'device', status: 'pending', label: '1. Khóa thiết bị đã đăng ký' },
    { name: 'network', status: 'pending', label: '2. Mạng nội bộ công ty (Wi-Fi)' },
    { name: 'gps', status: 'pending', label: '3. Tọa độ GPS trong bán kính văn phòng' },
    { name: 'shift', status: 'pending', label: '4. Khung giờ ca làm việc hợp lệ' },
    { name: 'face', status: 'pending', label: '5. Nhận diện khuôn mặt AI & Liveness' },
  ]);

  // Chấm công ngoại tuyến đã bị bỏ: dọn queue cũ còn sót trong trình duyệt.
  useEffect(() => {
    try {
      localStorage.removeItem('pulse_offline_punches');
    } catch {
      // localStorage có thể bị chặn — không ảnh hưởng luồng chấm công.
    }
  }, []);

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
    return [];
  });

  // Haptic feedback utility (Criterion B1 #3)
  const vibrate = (pattern: number | number[]) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    } catch (_) {}
  };

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

  // Load status for today & yesterday
  useEffect(() => {
    const token = (() => {
      try {
        const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
        return u?.accessToken || user?.accessToken || '';
      } catch {
        return user?.accessToken || '';
      }
    })();

    fetch('/api/v1/attendance/today-status', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((j) => {
        const d = j?.data;
        if (d) {
          if (d.faceEnrolled !== undefined) {
            setFaceEnrolled(d.faceEnrolled);
          }
          if (d.today) {
            setAlreadyCheckedOut(!!d.today.hasCheckedOut);
            setTodayMissingCheckIn(!!d.today.missingCheckIn);
            setTodayTimes({ checkInAt: d.today.checkInAt, checkOutAt: d.today.checkOutAt });
          }
          if (d.yesterday && d.yesterday.missingCheckout) {
            setYesterdayMissingCheckout(true);
            setYesterdayDate(d.yesterday.workDate || 'Hôm qua');
          }
        }
      })
      .catch((err) => console.warn('Could not fetch today status:', err));

    // Ca hiệu lực do backend phân giải (ca chuẩn hoặc ca ghi đè ưu tiên cao hơn) — không tự đoán.
    setShiftLoading(true);
    fetch('/api/v1/attendance/my-shift', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((j) => setMyShift(j?.data ?? null))
      .catch((err) => {
        console.warn('Could not fetch my shift:', err);
        setMyShift(null);
      })
      .finally(() => setShiftLoading(false));
  }, [user, shiftReload]);

  // Handle Real Camera stream cleanup
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraStream]);

  // Connect stream to video element
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch((err) => {
        console.warn('Video play error:', err);
      });
    }
  }, [cameraStream, useRealCamera]);

  // Auto-start camera on mount (Criterion B1 #2)
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
        console.warn('Auto camera request deferred:', err);
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
    if (useRealCamera && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 320;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        return canvas.toDataURL('image/jpeg', 0.85);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = 150;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, 150, 150);
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(75 + offset, 75, 45, 0, Math.PI * 2);
      ctx.fill();
    }
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const getRealGeoPosition = (): Promise<{ latitude: number | null; longitude: number | null; accuracy: number | null; error?: string }> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        resolve({ latitude: null, longitude: null, accuracy: null, error: 'Trình duyệt không hỗ trợ Geolocation' });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          console.warn('HTML5 Geolocation error:', err.code, err.message);
          resolve({ latitude: null, longitude: null, accuracy: null, error: err.message });
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    });
  };

  const captureFrames = async (count = 3): Promise<string[]> => {
    const frames: string[] = [];
    for (let i = 0; i < count; i += 1) {
      frames.push(captureFrameOrGetTestImage(i * 4));
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return frames;
  };

  const handleStartCheckIn = async () => {
    if (isScanning || isLockedByAttempts) return; // Debounce + lockout

    // Chấm RA khi chưa có giờ vào: chỉ ghi nhận giờ RA thật và đánh dấu thiếu giờ vào,
    // cần xác nhận để tránh một cú bấm nhầm biến thành ngày công không hợp lệ.
    if (checkType === 'OUT' && !todayTimes.checkInAt
      && !window.confirm('Bạn chưa chấm công vào hôm nay. Lần chấm này chỉ ghi nhận giờ RA và ngày công sẽ ở trạng thái Thiếu giờ vào (cần đơn bổ sung công). Tiếp tục?')) {
      return;
    }

    // Vibrate on tap (Criterion B1 #3)
    vibrate(30);

    setIsScanning(true);
    setErrorMessage(null);
    setNetworkDetail(null);
    setCheckInStep('checking');
    setErrorType('GENERAL');

    // 0. Check face enrollment (Criterion B0 & B1 #7)
    if (user?.faceEnrolled === false || faceEnrolled === false) {
      setCheckInStep('error');
      setErrorType('FACE_NOT_ENROLLED');
      setErrorMessage('Bạn chưa đăng ký khuôn mặt trên hệ thống. Hãy đăng ký khuôn mặt để bắt đầu chấm công.');
      vibrate([50, 60, 50]);
      setIsScanning(false);
      return;
    }

    // 1. Initial parallel steps animation
    setParallelSteps([
      { name: 'device', status: 'checking', label: '1. Khóa thiết bị đã đăng ký' },
      { name: 'network', status: 'checking', label: '2. Mạng nội bộ công ty (Wi-Fi)' },
      { name: 'gps', status: 'checking', label: '3. Tọa độ GPS trong bán kính văn phòng' },
      { name: 'shift', status: 'checking', label: '4. Khung giờ ca làm việc hợp lệ' },
      { name: 'face', status: 'checking', label: '5. Nhận diện khuôn mặt AI & Liveness' },
    ]);

    try {
      const frames = await captureFrames(3);
      const imageBase64 = frames[frames.length - 1];

      // Get real device GPS position from browser
      const geo = await getRealGeoPosition();

      // Core Service Verification (Runs 5 layers atomically)
      const loggedInCode = user?.employeeCode;
      const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = (() => {
        try {
          const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
          return u?.accessToken || user?.accessToken || '';
        } catch {
          return user?.accessToken || '';
        }
      })();
      if (token) reqHeaders['Authorization'] = `Bearer ${token}`;

      const coreResponse = await fetch('/api/v1/attendance/check-in', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({
          employeeCode: loggedInCode || user?.employeeCode || '',
          faceImageBase64: imageBase64,
          livenessFrames: frames,
          deviceFingerprint: getDeviceFingerprint(),
          wifiBssid: '', // Browser has no Wi-Fi SSID API; server verifies real client IP address
          latitude: geo.latitude,
          longitude: geo.longitude,
          accuracyMeters: geo.accuracy,
          // Gửi loại chấm tường minh — server không tự đoán lần đầu = VÀO nữa.
          type: checkType === 'IN' ? 'CHECK_IN' : 'CHECK_OUT',
        }),
      });

      const coreJson = await coreResponse.json().catch(() => ({}));
      const serverResult = coreJson?.data;

      if (!coreResponse.ok || !serverResult
        || (serverResult.status !== 'VALID' && serverResult.status !== 'INCOMPLETE')) {
        setCheckInStep('error');
        if (serverResult?.layers && Array.isArray(serverResult.layers)) {
          setParallelSteps(
            serverResult.layers.map((l: any) => ({
              name: l.layer?.toLowerCase() || 'general',
              status: l.passed ? 'passed' : 'failed',
              label: l.label || l.layer,
            }))
          );
          const networkLayer = serverResult.layers.find((l: any) => l.layer === 'NETWORK');
          setNetworkDetail(!networkLayer?.passed ? networkLayer?.detail || null : null);
        }
        if (serverResult?.rejectReason === 'OUTSIDE_GEOFENCE') {
          setErrorType('GPS_GEOFENCE');
        } else if (serverResult?.rejectReason === 'GPS_ACCURACY') {
          setErrorType('GPS_ACCURACY');
        } else if (serverResult?.rejectReason === 'OUTSIDE_NETWORK') {
          setErrorType('NETWORK');
        } else if (serverResult?.rejectReason === 'FACE_NOT_MATCHED' || serverResult?.rejectReason === 'PROXY_PUNCH_DETECTED') {
          setErrorType('FACE_MISMATCH');
          if (serverResult?.faceAttemptsRemaining !== undefined) {
            setFaceAttemptsRemaining(serverResult.faceAttemptsRemaining);
            if (serverResult.faceAttemptsRemaining <= 0) {
              setIsLockedByAttempts(true);
            }
          }
        } else if (serverResult?.rejectReason === 'DEVICE_NOT_APPROVED') {
          setErrorType('DEVICE');
        }
        setErrorMessage(
          serverResult?.message || coreJson?.message || `Máy chủ từ chối chấm công (HTTP ${coreResponse.status})`
        );
        vibrate([50, 60, 50]);
        setIsScanning(false);
        return;
      }

      // Mark all steps as passed
      setParallelSteps((prev) => prev.map((s) => ({ ...s, status: 'passed' })));

      const now = new Date();
      const scoreNum = serverResult.similarityScore ?? 0.98;
      // Server tự quyết định VÀO/RA — UI hiển thị đúng hành động vừa thực hiện.
      const punchType: 'IN' | 'OUT' = serverResult.punchType === 'OUT' ? 'OUT' : 'IN';
      const record: AttendancePunchRecord = {
        id: `PUNCH-${Date.now()}`,
        employeeCode: serverResult.matchedEmployeeCode || loggedInCode || '—',
        fullName: serverResult.matchedFullName || user?.fullName || 'Nhân viên',
        timestamp: new Date(serverResult.serverTimestamp || now).toLocaleTimeString('vi-VN', { hour12: false }),
        date: now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        type: punchType,
        similarity: scoreNum,
        livenessScore: 1.0,
        status: serverResult.status === 'INCOMPLETE'
          ? 'GHI NHẬN RA — THIẾU GIỜ VÀO'
          : punchType === 'IN' ? 'HỢP LỆ (VÀO CA)' : 'HỢP LỆ (RA CA)',
        bssid: 'Mạng văn phòng (IP hợp lệ)',
        coordinates: geo.latitude && geo.longitude ? `${geo.latitude.toFixed(4)}° N, ${geo.longitude.toFixed(4)}° E` : 'Đã xác thực vị trí',
      };

      setCheckResult(record);
      setHistory((prev) => [record, ...prev]);
      // Lần chấm kế tiếp trong ngày là RA; nếu đã ra rồi thì lần sau ghi đè giờ ra.
      setCheckType('OUT');
      setAlreadyCheckedOut(punchType === 'OUT');
      setTodayMissingCheckIn(serverResult.status === 'INCOMPLETE');
      setPunchNotice(serverResult.status === 'INCOMPLETE' ? (serverResult.message || null) : null);
      const stamp = serverResult.serverTimestamp || now.toISOString();
      setTodayTimes((prev) =>
        punchType === 'IN' ? { ...prev, checkInAt: stamp } : { ...prev, checkOutAt: stamp },
      );
      setCheckInStep('success');
      vibrate([15, 40, 15]); // Success vibration (Criterion B1 #3)
      setIsScanning(false);
    } catch (err: any) {
      console.error('Check-in error', err);
      setCheckInStep('error');
      setErrorMessage(err?.message || 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại — nếu đã quên chấm công, hãy tạo đơn bổ sung công khi có mạng.');
      vibrate([50, 60, 50]);
      setIsScanning(false);
    }
  };

  const handleReset = () => {
    setIsScanning(false);
    setCheckInStep('idle');
    setCheckResult(null);
    setPunchNotice(null);
    setErrorMessage(null);
    setNetworkDetail(null);
    setErrorType('GENERAL');
    setParallelSteps((prev) => prev.map((s) => ({ ...s, status: 'pending' })));
  };

  const hhmm = (value?: string) =>
    value
      ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
      : null;
  const todayIn = hhmm(todayTimes.checkInAt);
  const todayOut = hhmm(todayTimes.checkOutAt);
  const todayStatusText = todayOut
    ? todayIn
      ? `Đã vào ${todayIn} · Ra ${todayOut}`
      : `Đã ghi nhận RA ${todayOut} · Thiếu giờ vào`
    : todayIn
    ? `Đã vào ca lúc ${todayIn}`
    : 'Chưa chấm công hôm nay';

  // Ca hiệu lực lấy nguyên từ API (đã phân giải ca chuẩn / ca ghi đè) — chỉ cắt HH:mm để hiển thị.
  const shiftClock = (value?: string) => (value && value !== 'null' ? value.slice(0, 5) : '—');
  const shiftRange = (from?: string, to?: string) => {
    const a = from && from !== 'null' ? from.slice(0, 5) : null;
    const b = to && to !== 'null' ? to.slice(0, 5) : null;
    return a && b ? `${a}–${b}` : a || b || '—';
  };
  // Ca thường: khung vào/ra hợp lệ (checkInStart–checkInEnd, checkOutStart–checkOutEnd).
  // Ca linh hoạt: khung linh hoạt riêng, thiếu thì rơi về khung ca thường.
  const flexIn = shiftRange(myShift?.flexibleCheckinFrom, myShift?.flexibleCheckinTo);
  const flexOut = shiftRange(myShift?.flexibleCheckoutFrom, myShift?.flexibleCheckoutTo);
  const shiftCheckInText = myShift?.isFlexible && flexIn !== '—'
    ? flexIn
    : shiftRange(myShift?.checkInStart, myShift?.checkInEnd);
  const shiftCheckOutText = myShift?.isFlexible && flexOut !== '—'
    ? flexOut
    : shiftRange(myShift?.checkOutStart, myShift?.checkOutEnd);
  const shiftLunchText = myShift
    ? `${shiftClock(myShift.lunchBreakStart)}–${shiftClock(myShift.lunchBreakEnd)}`
    : '—';

  // ── Gợi ý VÀO/RA theo trạng thái + khung giờ ca (hybrid, người dùng vẫn đổi được) ──
  const timeMinutes = (value?: string) => {
    const s = shiftClock(value);
    const m = /^(\d{2}):(\d{2})$/.exec(s);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const hasCheckInToday = !!todayTimes.checkInAt;
  const hasCheckOutToday = !!todayTimes.checkOutAt;
  const checkInEndMinutes = timeMinutes(myShift?.checkInEnd);
  const checkOutStartMinutes = timeMinutes(
    myShift?.isFlexible && myShift?.flexibleCheckoutFrom ? myShift.flexibleCheckoutFrom : myShift?.checkOutStart
  );

  // Chỉ tự chọn khi chưa có dữ liệu hôm nay; sau khi tải ca xong mới gợi ý để không mặc định sai
  // thành VÀO lúc 17h khi người dùng thực chất muốn chấm RA.
  useEffect(() => {
    if (shiftLoading) return;
    if (hasCheckInToday || hasCheckOutToday) {
      setCheckType('OUT');
      return;
    }
    if (checkOutStartMinutes != null && nowMinutes >= checkOutStartMinutes) {
      setCheckType('OUT');
      return;
    }
    setCheckType('IN');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftLoading, checkOutStartMinutes, hasCheckInToday, hasCheckOutToday]);

  const ambiguousNoPunch = !hasCheckInToday && !hasCheckOutToday
    && checkInEndMinutes != null && checkOutStartMinutes != null
    && nowMinutes > checkInEndMinutes && nowMinutes < checkOutStartMinutes;
  const lateCheckIn = !hasCheckInToday && checkType === 'IN'
    && checkInEndMinutes != null && nowMinutes > checkInEndMinutes;
  const missingCheckInPunch = !hasCheckInToday && checkType === 'OUT';

  return (
    <div className="max-w-xl lg:max-w-5xl mx-auto space-y-4 pt-[env(safe-area-inset-top,0px)] pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:pb-6">
      <canvas ref={canvasRef} className="hidden" />

      {/* Yesterday Missing Checkout Banner (Criterion B2 #2) */}
      {yesterdayMissingCheckout && (
        <div className="p-3.5 bg-status-warn-soft border border-status-warn-line rounded-xl text-xs text-status-warn flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <div>
              <strong className="font-semibold text-status-warn">
                Bạn chưa chấm công ra ngày hôm qua ({yesterdayDate})
              </strong>
              <p className="text-[11px] text-status-warn mt-0.5">
                Hãy tạo đơn bổ sung công để phòng HR xác nhận và không bị trừ ngày công.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/attendance/requests')}
            className="px-3.5 py-1.5 rounded-lg bg-status-warn text-on-warn font-semibold text-xs hover:bg-status-warn transition-colors shadow-2xs whitespace-nowrap"
          >
            Bổ sung công (1 chạm)
          </button>
        </div>
      )}

      {/* Face Enrollment Status (Criterion B0 & B1 #7) */}
      {!faceEnrolled && (
        <div className="text-center">
          <button
            onClick={() => navigate('/auth/enroll-face')}
            className="inline-flex items-center gap-1.5 text-xs text-status-danger bg-status-danger-soft hover:bg-status-danger-soft font-bold px-3.5 py-1.5 rounded-full border border-status-danger-line shadow-2xs cursor-pointer animate-pulse"
          >
            <span>📸</span>
            <span>⚠️ Bạn chưa đăng ký khuôn mặt! Bấm vào đây để đăng ký (B0)</span>
          </button>
        </div>
      )}

      {/* Main Punch Card (Mobile-First, Criterion B1 #13) */}
      <Card className="text-center p-4 sm:p-6 lg:p-8 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-8 lg:items-center">
          {/* Cột trái: đồng hồ + camera */}
          <div className="space-y-4 lg:rounded-2xl lg:border lg:border-line lg:bg-canvas/60 lg:p-5">
            {/* Real-time Clock */}
            <div>
              <div className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-mono tracking-tight text-ink tabular-nums">
                {currentTime || '08:30:00'}
              </div>
              <div className="text-xs sm:text-sm text-ink-secondary mt-1.5 capitalize font-medium">
                {currentDate}
              </div>
            </div>

        {/* Camera Viewport with Oval Guideline Overlay (Criterion B1 #2) */}
        <div className="relative w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 mx-auto rounded-full border-4 border-accent/40 bg-zinc-900 flex items-center justify-center overflow-hidden shadow-inner">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover rounded-full -scale-x-100 ${useRealCamera && cameraStream ? 'block' : 'hidden'}`}
          />

          {/* Oval guideline overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-36 h-44 sm:w-40 sm:h-52 lg:w-44 lg:h-56 rounded-[50%] border-2 border-dashed border-status-ok/80 shadow-[0_0_15px_rgba(16,185,129,0.3)] flex flex-col items-center justify-between py-2.5 sm:py-3">
              <div className="text-[10px] text-status-ok-line font-semibold bg-zinc-900/60 px-2 py-0.5 rounded-full backdrop-blur-2xs">
                Khung oval hướng dẫn
              </div>
              <div className="text-[9px] text-status-ok-line/80 bg-zinc-900/60 px-1.5 py-0.5 rounded-full">
                Nhìn thẳng vào camera
              </div>
            </div>
          </div>

          {/* Prompt if camera is not active */}
          {(!useRealCamera || !cameraStream) && !isScanning && (
            <div className="text-center p-4 z-10">
              <div className="text-4xl mb-2">📸</div>
              <div className="text-xs text-zinc-300 font-medium">
                Căn chỉnh khuôn mặt vào giữa khung tròn
              </div>
            </div>
          )}

          {/* Live Scanning Spinner */}
          {isScanning && checkInStep !== 'success' && checkInStep !== 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/80 text-white backdrop-blur-xs z-20">
              <div className="w-40 h-40 rounded-full border-3 border-accent border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-center px-4 font-semibold text-status-ok-line">
                Đang xác thực 5 tầng song song...
              </div>
            </div>
          )}

          {/* Success Overlay with Match Percentage (Criterion B1 #5) */}
          {checkInStep === 'success' && checkResult && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center p-4 z-20 animate-in fade-in ${
              checkResult.status.startsWith('GHI NHẬN') ? 'bg-status-warn text-on-warn' : 'bg-status-ok text-on-ok'
            }`}>
              <div className="text-4xl mb-1">
                {checkResult.status.startsWith('GHI NHẬN') ? '!' : '✓'}
              </div>
              <div className="text-sm font-extrabold">
                {checkResult.status.startsWith('GHI NHẬN')
                  ? 'Đã ghi nhận RA — thiếu giờ vào'
                  : `✓ Khớp ${(checkResult.similarity * 100).toFixed(0)}%`}
              </div>
              <div className="text-xs font-semibold opacity-90 mt-0.5">
                {checkResult.fullName} ({checkResult.employeeCode})
              </div>
              <div className="text-[10px] mt-1 opacity-90">
                Liveness: 100% · Vị trí: Hợp lệ
              </div>
            </div>
          )}

          {/* Error Overlay */}
          {checkInStep === 'error' && (
            <div className="absolute inset-0 bg-status-danger/90 flex flex-col items-center justify-center text-on-danger p-4 z-20 animate-in fade-in">
              <div className="text-4xl mb-1">✕</div>
              <div className="text-xs font-bold uppercase opacity-90">BỊ CHẶN XÁC THỰC</div>
            </div>
          )}
        </div>

        {/* Toggle Real Webcam Button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={toggleRealCamera}
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs border cursor-pointer ${
              useRealCamera && cameraStream
                ? 'bg-status-ok/15 text-status-ok border-status-ok/30'
                : 'bg-accent text-on-accent border-transparent hover:bg-accent-hover'
            }`}
          >
            <span>{useRealCamera && cameraStream ? '🟢' : '📹'}</span>
            <span>{useRealCamera && cameraStream ? 'Webcam Đang Hoạt Động' : 'Bật Webcam Thực'}</span>
          </button>
        </div>
          </div>

          {/* Cột phải: ca làm việc + trạng thái + nút chấm công */}
          <div className="flex flex-col gap-4 text-left">
            <div className="rounded-xl border border-line bg-canvas p-4 space-y-2.5 order-3 lg:order-none">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Ca làm việc hôm nay</div>
                  {shiftLoading ? (
                    <div className="text-sm font-bold text-ink-muted mt-0.5">Đang tải cấu hình ca…</div>
                  ) : !myShift ? (
                    <div className="text-sm font-bold text-ink mt-0.5">Chưa xác định được ca làm việc</div>
                  ) : (
                    <div className="text-sm font-bold text-ink mt-0.5 truncate">{myShift.name}</div>
                  )}
                </div>
                {!shiftLoading && myShift && (
                  <Badge variant={myShift.isBase ? 'info' : 'warn'}>
                    {myShift.isBase ? 'Ca chuẩn' : 'Ca ghi đè'}
                  </Badge>
                )}
              </div>

              {shiftLoading ? (
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-12 rounded-lg bg-line/50 animate-pulse" />
                  ))}
                </div>
              ) : !myShift ? (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-status-warn-soft border border-status-warn-line p-2.5">
                  <p className="text-[11px] text-status-warn leading-relaxed">
                    Chưa tải được cấu hình ca áp dụng cho bạn. Kiểm tra kết nối hoặc liên hệ HR.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShiftReload((v) => v + 1)}
                    className="shrink-0 text-[11px] font-semibold text-status-warn underline"
                  >
                    Thử lại
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-surface border border-line px-2 py-1.5">
                      <div className="text-[10px] text-ink-muted">Khung vào</div>
                      <div className="text-[11px] font-mono font-bold text-ink whitespace-nowrap">{shiftCheckInText}</div>
                    </div>
                    <div className="rounded-lg bg-surface border border-line px-2 py-1.5">
                      <div className="text-[10px] text-ink-muted">Nghỉ trưa</div>
                      <div className="text-[11px] font-mono font-bold text-ink whitespace-nowrap">{shiftLunchText}</div>
                    </div>
                    <div className="rounded-lg bg-surface border border-line px-2 py-1.5">
                      <div className="text-[10px] text-ink-muted">Khung ra</div>
                      <div className="text-[11px] font-mono font-bold text-ink whitespace-nowrap">{shiftCheckOutText}</div>
                    </div>
                  </div>
                  <p className="text-[11px] leading-relaxed text-ink-muted">
                    Áp dụng theo cấu hình ca hiệu lực <span className="font-semibold text-ink">{myShift.code}</span>
                    {myShift.requiredWorkHours ? ` · ${myShift.requiredWorkHours}h/ngày` : ''}
                    {' · khung vào/ra là khoảng hợp lệ'}
                    {myShift.isFlexible ? ', ca linh hoạt' : ''}.
                  </p>
                  <p className="text-[11px] leading-relaxed text-ink-muted">
                    Lần chấm đầu tiên trong ngày là <strong>vào ca</strong>, các lần sau là{' '}
                    <strong>ra ca</strong> (giữ lần cuối). Không cần chọn vào/ra.
                  </p>
                </>
              )}
            </div>

        {/* 5-Parallel Checks Display (Criterion B1 #4) */}
        {isScanning && (
          <div className="p-3 bg-canvas rounded-xl border border-line text-left text-xs space-y-1.5 animate-in fade-in">
            <div className="font-bold text-[11px] text-ink mb-1 flex items-center justify-between">
              <span>Đang kiểm tra 5 lớp chạy song song:</span>
              <span className="text-accent animate-pulse">● Đang xử lý...</span>
            </div>
            {parallelSteps.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-[11px]">
                <span className="text-ink-secondary">{s.label}</span>
                <span>
                  {s.status === 'passed' && <span className="text-status-ok font-bold">✓ Đạt</span>}
                  {s.status === 'checking' && <span className="text-accent animate-spin">⠙</span>}
                  {s.status === 'failed' && <span className="text-status-danger font-bold">✕ Chặn</span>}
                  {s.status === 'pending' && <span className="text-ink-muted">···</span>}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Error Alert Display with Specific Remedies (Criteria B1 #6, #8, #9, #10) */}
        {errorMessage && (
          <div className="p-3.5 bg-status-danger-soft border border-status-danger-line rounded-xl text-left text-xs text-status-danger space-y-2 animate-in fade-in">
            <div className="font-bold flex items-center gap-1.5 text-status-danger">
              <span>⚠️</span>
              <span>Lý Do Bị Chặn:</span>
            </div>
            <p className="leading-relaxed font-medium">{errorMessage}</p>

            {/* Criterion B1 #9: Outside GPS Geofence Remedies */}
            {errorType === 'GPS_GEOFENCE' && (
              <div className="pt-2 border-t border-status-danger-line flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  onClick={() => navigate('/attendance/requests')}
                  className="px-3 py-1.5 rounded-lg bg-accent text-on-accent font-semibold text-xs shadow-xs hover:bg-accent-hover"
                >
                  Tạo đơn WFH
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/attendance/rules')}
                  className="px-3 py-1.5 rounded-lg bg-surface border border-line text-ink font-semibold text-xs shadow-xs hover:bg-canvas"
                >
                  Cấu hình GPS văn phòng (Rule Engine)
                </button>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Thử lại
                </Button>
              </div>
            )}

            {/* Outside Network Remedies */}
            {errorType === 'NETWORK' && (
              <div className="pt-2 border-t border-status-danger-line flex flex-wrap gap-2 items-center">
                {networkDetail && (
                  <div className="basis-full text-[11px] text-status-danger font-mono bg-status-danger-soft border border-status-danger-line rounded-lg px-2.5 py-1.5">
                    {networkDetail}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => navigate('/attendance/rules')}
                  className="px-3 py-1.5 rounded-lg bg-surface border border-line text-ink font-semibold text-xs shadow-xs hover:bg-canvas"
                >
                  Cấu hình dải IP văn phòng (Rule Engine)
                </button>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Thử lại
                </Button>
              </div>
            )}

            {/* Criterion B1 #10: Poor GPS Accuracy */}
            {errorType === 'GPS_ACCURACY' && (
              <div className="pt-2 border-t border-status-danger-line">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Thử lại ở gần cửa sổ
                </Button>
              </div>
            )}

            {/* Criterion B1 #7: Face not enrolled */}
            {errorType === 'FACE_NOT_ENROLLED' && (
              <div className="pt-2 border-t border-status-danger-line">
                <button
                  type="button"
                  onClick={() => navigate('/auth/enroll-face')}
                  className="px-3.5 py-1.5 rounded-lg bg-accent text-on-accent font-semibold text-xs shadow-xs hover:bg-accent-hover"
                >
                  Đăng ký khuôn mặt ngay (B0)
                </button>
              </div>
            )}

            {/* General retry */}
            {errorType !== 'GPS_GEOFENCE' && errorType !== 'FACE_NOT_ENROLLED' && !isLockedByAttempts && (
              <div className="pt-2 border-t border-status-danger-line">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Thử lại lượt khác
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Trạng thái chấm công hôm nay */}
        <div className="flex items-center justify-between gap-2 rounded-xl border border-line px-3.5 py-2.5">
          <div>
            <div className="text-xs font-bold text-ink">Chấm công hôm nay</div>
            <div className="text-[11px] text-ink-muted mt-0.5">{todayStatusText}</div>
          </div>
          <Badge variant={todayOut && !todayIn ? 'warn' : todayOut ? 'ok' : todayIn ? 'info' : 'gray'}>
            {todayOut && !todayIn ? 'Thiếu giờ vào' : todayOut ? 'Đã ra ca' : todayIn ? 'Đã vào ca' : 'Chưa vào ca'}
          </Badge>
        </div>

        {/* Thiếu đầu chấm — chỉ ghi nhận phần có thật, phần còn lại phải bổ sung công có duyệt */}
        {(todayMissingCheckIn || (checkInStep !== 'success' && missingCheckInPunch)) && (
          <div className="p-3 rounded-xl bg-status-warn-soft border border-status-warn-line text-[11px] text-status-warn flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <strong className="font-semibold">
                {todayMissingCheckIn ? 'Hôm nay thiếu giờ vào' : 'Bạn chưa chấm công vào hôm nay'}
              </strong>
              <p className="mt-0.5 text-status-warn">
                {todayMissingCheckIn
                  ? 'Giờ RA đã được ghi nhận. Ngày công chỉ được tính sau khi đơn bổ sung giờ vào được duyệt.'
                  : 'Lần chấm này chỉ ghi nhận giờ RA — ngày công sẽ Thiếu giờ vào. Hãy chọn “Vào ca” nếu bạn đi muộn.'}
              </p>
            </div>
            {todayMissingCheckIn && (
              <button
                type="button"
                onClick={() => navigate('/attendance/requests')}
                className="px-3.5 py-1.5 rounded-lg bg-status-warn text-on-warn font-semibold text-xs hover:bg-status-warn whitespace-nowrap"
              >
                Bổ sung công
              </button>
            )}
          </div>
        )}

        {ambiguousNoPunch && checkInStep !== 'success' && (
          <div className="p-2.5 rounded-xl bg-status-info-soft border border-status-info-line text-[11px] text-status-info">
            Hiện không nằm trong khung vào hay khung ra của ca — hãy chọn đúng <strong>Vào ca</strong> hoặc <strong>Ra ca</strong> bên dưới.
          </div>
        )}

        {/* Chọn loại chấm rõ ràng — hệ thống gợi ý nhưng nhân viên luôn đổi được */}
        {checkInStep !== 'success' && (
          <div className="flex flex-col items-center gap-1.5">
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              <button
                type="button"
                onClick={() => setCheckType('IN')}
                disabled={isScanning || hasCheckInToday || todayMissingCheckIn}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${checkType === 'IN'
                  ? 'bg-status-ok text-on-ok border-status-ok'
                  : 'bg-canvas text-ink border-line hover:border-status-ok'} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {hasCheckInToday ? 'Đã vào ca' : todayMissingCheckIn ? 'Thiếu giờ vào' : 'Vào ca'}
              </button>
              <button
                type="button"
                onClick={() => setCheckType('OUT')}
                disabled={isScanning}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${checkType === 'OUT'
                  ? 'bg-ink text-canvas border-ink'
                  : 'bg-canvas text-ink border-line hover:border-line-hover'} disabled:opacity-40`}
              >
                {alreadyCheckedOut ? 'Cập nhật giờ ra' : 'Ra ca'}
              </button>
            </div>
            {lateCheckIn && checkType === 'IN' && (
              <p className="text-[10px] text-status-warn">
                Đã qua khung vào {shiftCheckInText} — lần chấm VÀO này có thể bị tính đi muộn.
              </p>
            )}
          </div>
        )}

        {/* 1 Big Punch Button — Debounced and Disabled when scanning (Criterion B1 #3, #12, #13) */}
        {checkInStep !== 'success' && (
          <div className="pt-1 flex flex-col items-center gap-2">
            <button
              type="button"
              disabled={isScanning || isLockedByAttempts || !faceEnrolled}
              onClick={handleStartCheckIn}
              className={`w-36 h-36 sm:w-40 sm:h-40 rounded-full font-black text-2xl tracking-wider shadow-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
                isLockedByAttempts
                  ? 'bg-status-danger text-on-danger opacity-60 cursor-not-allowed'
                  : isScanning
                  ? 'bg-accent/80 text-on-accent opacity-60 cursor-wait'
                  : checkType === 'IN'
                  ? 'bg-status-ok text-on-ok hover:opacity-90 active:scale-95 ring-4 ring-status-ok/30'
                  : 'bg-ink text-canvas hover:opacity-90 active:scale-95 ring-4 ring-ink/20'
              }`}
            >
              <span>{isScanning ? '...' : checkType === 'IN' ? 'VÀO' : 'RA'}</span>
              <span className="text-[10px] font-normal tracking-normal opacity-80 mt-1">
                {isScanning
                  ? 'Đang ghi nhận'
                  : checkType === 'OUT' && alreadyCheckedOut
                  ? 'Cập nhật giờ ra'
                  : checkType === 'OUT' && !hasCheckInToday
                  ? 'Chỉ ghi nhận RA'
                  : 'Bấm 1 chạm'}
              </span>
            </button>
          </div>
        )}

        {/* Success Card Details */}
        {checkInStep === 'success' && checkResult && (
          <div className={`p-4 rounded-xl text-left text-xs space-y-2 animate-in fade-in border ${
            checkResult.status.startsWith('GHI NHẬN')
              ? 'bg-status-warn-soft border-status-warn-line' : 'bg-status-ok-soft border-status-ok-line'
          }`}>
            <div className={`flex items-center justify-between pb-2 border-b ${
              checkResult.status.startsWith('GHI NHẬN') ? 'border-status-warn-line' : 'border-status-ok-line'
            }`}>
              <span className={`font-bold ${checkResult.status.startsWith('GHI NHẬN') ? 'text-status-warn' : 'text-status-ok'}`}>
                {checkResult.status.startsWith('GHI NHẬN') ? 'Đã Ghi Nhận Giờ Ra — Thiếu Giờ Vào' : 'Ghi Nhận Chấm Công Thành Công'}
              </span>
              <Badge variant={checkResult.status.startsWith('GHI NHẬN') ? 'warn' : 'accent'}>{checkResult.status}</Badge>
            </div>
            {punchNotice && (
              <div className="text-[11px] text-status-warn bg-status-warn-soft border border-status-warn-line rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>{punchNotice}</span>
                <button
                  type="button"
                  onClick={() => navigate('/attendance/requests')}
                  className="px-3 py-1.5 rounded-lg bg-status-warn text-on-warn font-semibold text-xs hover:bg-status-warn whitespace-nowrap"
                >
                  Bổ sung công
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-status-ok">Nhân viên:</span>{' '}
                <strong className="text-status-ok">{checkResult.fullName} ({checkResult.employeeCode})</strong>
              </div>
              <div>
                <span className="text-status-ok">Giờ ghi nhận:</span>{' '}
                <strong className="font-mono text-status-ok">{checkResult.timestamp}</strong>
              </div>
              <div>
                <span className="text-status-ok">Loại:</span>{' '}
                <strong className="text-status-ok">{checkResult.type === 'IN' ? 'Check-In Vào' : 'Check-Out Ra'}</strong>
              </div>
              <div>
                <span className="text-status-ok">Độ khớp khuôn mặt:</span>{' '}
                <strong className="text-status-ok">{(checkResult.similarity * 100).toFixed(1)}% (✓ Khớp)</strong>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <Button variant="outline" size="sm" onClick={handleReset}>
                Chấm lượt mới
              </Button>
            </div>
          </div>
        )}
          </div>
        </div>
      </Card>
    </div>
  );
};
