import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { SegmentedControl } from '../../../components/common/SegmentedControl';
import { useAuth } from '../../../context/AuthContext';
import { getDeviceFingerprint } from '../../../utils/deviceFingerprint';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Info as InfoIcon,
  MapPin,
  RefreshCw,
  ScanFace,
  Smartphone,
  Video,
  VideoOff,
  Wifi,
  XCircle,
} from 'lucide-react';

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
  /** Trạng thái thiết bị hiện tại trên máy: đã duyệt / chờ duyệt / bị thu hồi (mockup T1). */
  const [deviceState, setDeviceState] = useState<'approved' | 'pending' | 'revoked' | 'unknown'>('unknown');

  // Parallel 5-check steps (Criterion B1 #4)
  const [parallelSteps, setParallelSteps] = useState<ParallelStep[]>([
    { name: 'device', status: 'pending', label: '1. Khóa thiết bị đã đăng ký' },
    { name: 'network', status: 'pending', label: '2. Mạng nội bộ công ty (Wi-Fi)' },
    { name: 'gps', status: 'pending', label: '3. Tọa độ GPS trong bán kính văn phòng' },
    { name: 'shift', status: 'pending', label: '4. Khung giờ ca làm việc hợp lệ' },
    { name: 'face', status: 'pending', label: '5. Nhận diện khuôn mặt AI & Liveness' },
  ]);

  // Trạng thái thiết bị hiện tại — đối chiếu fingerprint trình duyệt với danh sách
  // thiết bị đã đăng ký để biết chấm công có bị chặn lớp "khóa thiết bị" hay không.
  useEffect(() => {
    const token = (() => { try { return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken; } catch { return ''; } })();
    if (!token) return;
    fetch('/api/v1/devices', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => {
        if (!Array.isArray(j?.data)) return;
        const fp = getDeviceFingerprint();
        const mine = j.data.find((d: any) => d.deviceFingerprint === fp);
        if (!mine) { setDeviceState('unknown'); return; }
        if (mine.revokedAt) setDeviceState('revoked');
        else if (mine.isApproved) setDeviceState('approved');
        else setDeviceState('pending');
      })
      .catch(() => undefined);
  }, []);

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


  /** 5 lớp xác thực — khớp thứ tự bước backend trả về (`parallelSteps`). */
  const verifyLayers = [
    { name: 'device', title: 'Thiết bị đã đăng ký', desc: 'Khóa theo fingerprint trình duyệt', Icon: Smartphone },
    { name: 'network', title: 'Mạng nội bộ công ty', desc: 'SSID/BSSID khớp cấu hình văn phòng', Icon: Wifi },
    { name: 'gps', title: 'GPS trong bán kính văn phòng', desc: 'Kiểm tra tọa độ so với geofence', Icon: MapPin },
    { name: 'shift', title: 'Khung giờ ca làm việc', desc: `${shiftCheckInText} · ${shiftCheckOutText}`, Icon: Clock3 },
    { name: 'face', title: 'Nhận diện khuôn mặt & liveness', desc: 'Chống ảnh giả, so khớp khuôn mặt', Icon: ScanFace },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl space-y-4 pt-[env(safe-area-inset-top,0px)] pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:pb-6">
      <canvas ref={canvasRef} className="hidden" />

      {/* Đầu trang — mockup T1 `.topbar` */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] text-ink-muted">Chấm công</div>
          <h1 className="mt-0.5 font-display text-lg font-extrabold tracking-[-0.01em] text-ink sm:text-xl">
            Chấm công hôm nay
          </h1>
        </div>
        {deviceState === 'approved' && (
          <span
            className="inline-flex h-[26px] w-fit shrink-0 items-center gap-1.5 rounded-lg border border-status-ok-line bg-status-ok-soft px-2.5 text-[11px] font-semibold text-status-ok"
            title="Thiết bị này đã được HR duyệt — lớp xác thực 'khóa thiết bị' sẽ đạt"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Thiết bị đã xác thực
          </span>
        )}
        {deviceState === 'pending' && (
          <span
            className="inline-flex h-[26px] w-fit shrink-0 items-center gap-1.5 rounded-lg border border-status-warn-line bg-status-warn-soft px-2.5 text-[11px] font-semibold text-status-warn"
            title="Thiết bị này đang chờ HR duyệt — lớp xác thực 'khóa thiết bị' sẽ chặn lần chấm"
          >
            <Clock3 className="h-3.5 w-3.5" />
            Thiết bị chờ duyệt
          </span>
        )}
        {deviceState === 'revoked' && (
          <span
            className="inline-flex h-[26px] w-fit shrink-0 items-center gap-1.5 rounded-lg border border-status-danger-line bg-status-danger-soft px-2.5 text-[11px] font-semibold text-status-danger"
            title="Thiết bị này đã bị HR thu hồi — không thể chấm công bằng máy này"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Thiết bị đã bị thu hồi
          </span>
        )}
        {deviceState === 'unknown' && (
          <span
            className="inline-flex h-[26px] w-fit shrink-0 items-center gap-1.5 rounded-lg border border-status-warn-line bg-status-warn-soft px-2.5 text-[11px] font-semibold text-status-warn"
            title="Máy này chưa được đăng ký — không thể chấm công. Vào 'Thiết bị của tôi' để đăng ký máy trước."
          >
            <Smartphone className="h-3.5 w-3.5" />
            Máy này chưa đăng ký
          </span>
        )}
      </div>

      {/* Yesterday Missing Checkout Banner (Criterion B2 #2) */}
      {yesterdayMissingCheckout && (
        <div className="p-3.5 bg-status-warn-soft border border-status-warn-line rounded-xl text-xs text-status-warn flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
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
            className="inline-flex items-center gap-1.5 text-xs text-status-danger bg-status-danger-soft hover:bg-status-danger-soft font-bold px-3.5 py-1.5 rounded-full border border-status-danger-line shadow-2xs cursor-pointer"
          >
            <ScanFace className="w-3.5 h-3.5" />
            Chưa đăng ký khuôn mặt — đăng ký ngay để chấm công
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:gap-5 lg:items-start">
        {/* ── Cột trái: đồng hồ + camera + thao tác chấm ─────────────────── */}
        <section className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-xs p-4 sm:p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-36"
            style={{
              background:
                'radial-gradient(420px 140px at 18% 0%, rgb(var(--accent) / 0.10), transparent 70%)',
            }}
          />

          <div className="relative space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">
                  Chấm công hôm nay
                </div>
                <div className="mt-2 text-4xl sm:text-5xl lg:text-[52px] font-extrabold font-mono tracking-tight text-ink tabular-nums leading-none">
                  {currentTime || '08:30:00'}
                </div>
                <div className="text-xs text-ink-muted mt-2 capitalize font-medium">
                  {currentDate}
                </div>
              </div>
              <Badge variant={todayOut && !todayIn ? 'warn' : todayOut ? 'ok' : todayIn ? 'info' : 'gray'}>
                {todayOut && !todayIn ? 'Thiếu giờ vào' : todayOut ? 'Đã ra ca' : todayIn ? 'Đã vào ca' : 'Chưa vào ca'}
              </Badge>
            </div>

            {/* Camera Viewport with Oval Guideline Overlay (Criterion B1 #2) */}
            <div className="relative w-44 h-44 sm:w-52 sm:h-52 lg:w-[212px] lg:h-[212px] mx-auto rounded-full border-4 border-accent/35 bg-surface-secondary flex items-center justify-center overflow-hidden shadow-[0_0_0_8px_rgb(var(--accent)/0.06)]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover rounded-full -scale-x-100 ${useRealCamera && cameraStream ? 'block' : 'hidden'}`}
              />

              {/* Oval guideline overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-32 h-40 sm:w-36 sm:h-46 lg:w-40 lg:h-52 rounded-[50%] border-2 border-dashed border-status-ok/70 shadow-[0_0_15px_rgb(var(--ok)/0.25)] flex flex-col items-center justify-between py-2.5">
                  <div className="text-[9px] text-ink-muted font-semibold bg-surface/90 px-2 py-0.5 rounded-full">
                    Nhìn thẳng vào camera
                  </div>
                </div>
              </div>

              {/* Live pill */}
              {!isScanning && checkInStep !== 'success' && checkInStep !== 'error' && (
                <span className="absolute top-2.5 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-status-ok bg-status-ok-soft border border-status-ok-line px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-ok animate-pulse" />
                  Camera sẵn sàng
                </span>
              )}

              {/* Prompt if camera is not active */}
              {(!useRealCamera || !cameraStream) && !isScanning && (
                <div className="text-center px-4 z-10">
                  <ScanFace className="w-9 h-9 mx-auto mb-1.5 text-ink-muted/70" />
                  <div className="text-[11px] text-ink-muted font-medium">
                    Căn chỉnh khuôn mặt vào giữa khung tròn
                  </div>
                </div>
              )}

              {/* Live Scanning Spinner */}
              {isScanning && checkInStep !== 'success' && checkInStep !== 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/80 text-canvas backdrop-blur-xs z-20">
                  <div className="w-32 h-32 rounded-full border-[3px] border-accent border-t-transparent animate-spin" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-[11px] text-center px-5 font-semibold text-status-ok-line">
                    Đang xác thực 5 tầng song song...
                  </div>
                </div>
              )}

              {/* Success Overlay with Match Percentage (Criterion B1 #5) */}
              {checkInStep === 'success' && checkResult && (
                <div className={`absolute inset-0 flex flex-col items-center justify-center p-4 z-20 animate-in fade-in ${
                  checkResult.status.startsWith('GHI NHẬN') ? 'bg-status-warn text-on-warn' : 'bg-status-ok text-on-ok'
                }`}>
                  <CheckCircle2 className="w-9 h-9 mb-1" />
                  <div className="text-xs font-extrabold text-center">
                    {checkResult.status.startsWith('GHI NHẬN')
                      ? 'Đã ghi nhận RA — thiếu giờ vào'
                      : `Khớp ${(checkResult.similarity * 100).toFixed(0)}%`}
                  </div>
                  <div className="text-[10px] font-semibold opacity-90 mt-0.5 text-center">
                    {checkResult.fullName} ({checkResult.employeeCode})
                  </div>
                </div>
              )}

              {/* Error Overlay */}
              {checkInStep === 'error' && (
                <div className="absolute inset-0 bg-status-danger/90 flex flex-col items-center justify-center text-on-danger p-4 z-20 animate-in fade-in">
                  <XCircle className="w-9 h-9 mb-1" />
                  <div className="text-[10px] font-bold uppercase text-center opacity-90">Bị chặn xác thực</div>
                </div>
              )}
            </div>

            {/* Toggle Real Webcam Button */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={toggleRealCamera}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
                  useRealCamera && cameraStream
                    ? 'bg-status-ok-soft text-status-ok border-status-ok-line'
                    : 'bg-btn-secondary text-btn-secondary-ink border-line hover:bg-btn-secondary-hover'
                }`}
              >
                {useRealCamera && cameraStream ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                <span>{useRealCamera && cameraStream ? 'Webcam đang hoạt động' : 'Bật webcam thực'}</span>
              </button>
            </div>

            {/* Giờ vào/ra hôm nay */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-canvas px-3 py-2">
                <span className="text-[10.5px] font-semibold text-ink-muted">Giờ vào</span>
                <span className={`text-sm font-mono font-bold ${todayIn ? 'text-status-ok' : 'text-ink-muted'}`}>
                  {todayIn || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-canvas px-3 py-2">
                <span className="text-[10.5px] font-semibold text-ink-muted">Giờ ra</span>
                <span className={`text-sm font-mono font-bold ${todayOut ? 'text-ink' : 'text-ink-muted'}`}>
                  {todayOut || '—'}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-ink-muted text-center -mt-1">{todayStatusText}</p>

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
                <SegmentedControl<'IN' | 'OUT'>
                  ariaLabel="Chọn loại chấm công"
                  className="max-w-xs"
                  value={checkType}
                  onChange={setCheckType}
                  options={[
                    {
                      value: 'IN',
                      label: hasCheckInToday ? 'Đã vào ca' : todayMissingCheckIn ? 'Thiếu giờ vào' : 'Vào ca',
                      disabled: isScanning || hasCheckInToday || todayMissingCheckIn,
                      tone: 'ok',
                    },
                    {
                      value: 'OUT',
                      label: alreadyCheckedOut ? 'Cập nhật giờ ra' : 'Ra ca',
                      tone: 'ink',
                      disabled: isScanning,
                    },
                  ]}
                />
                {lateCheckIn && checkType === 'IN' && (
                  <p className="text-[10px] text-status-warn">
                    Đã qua khung vào {shiftCheckInText} — lần chấm VÀO này có thể bị tính đi muộn.
                  </p>
                )}
              </div>
            )}

            {/* 1 Big Punch Button — Debounced and Disabled when scanning (Criterion B1 #3, #12, #13) */}
            {checkInStep !== 'success' && (
              <div className="pt-1 flex flex-col items-center">
                <button
                  type="button"
                  disabled={isScanning || isLockedByAttempts || !faceEnrolled}
                  onClick={handleStartCheckIn}
                  className={`w-36 h-36 sm:w-40 sm:h-40 rounded-full font-black tracking-wider flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    isLockedByAttempts
                      ? 'bg-status-danger text-on-danger opacity-60 cursor-not-allowed'
                      : isScanning
                      ? 'bg-accent/80 text-on-accent opacity-60 cursor-wait'
                      : 'bg-accent text-on-accent hover:bg-accent-hover active:scale-95 shadow-[0_0_0_8px_rgb(var(--accent)/0.10),0_14px_30px_rgb(var(--accent)/0.22)]'
                  }`}
                >
                  <ScanFace className="w-6 h-6 opacity-80" />
                  <span className="text-2xl">{isScanning ? '...' : checkType === 'IN' ? 'VÀO' : 'RA'}</span>
                  <span className="text-[10px] font-normal tracking-normal opacity-85">
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
                <div className={`flex items-center justify-between gap-2 pb-2 border-b ${
                  checkResult.status.startsWith('GHI NHẬN') ? 'border-status-warn-line' : 'border-status-ok-line'
                }`}>
                  <span className={`font-bold ${checkResult.status.startsWith('GHI NHẬN') ? 'text-status-warn' : 'text-status-ok'}`}>
                    {checkResult.status.startsWith('GHI NHẬN') ? 'Đã ghi nhận giờ ra — thiếu giờ vào' : 'Ghi nhận chấm công thành công'}
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
                    <span className="text-ink-muted">Nhân viên:</span>{' '}
                    <strong className="text-ink">{checkResult.fullName} ({checkResult.employeeCode})</strong>
                  </div>
                  <div>
                    <span className="text-ink-muted">Giờ ghi nhận:</span>{' '}
                    <strong className="font-mono text-ink">{checkResult.timestamp}</strong>
                  </div>
                  <div>
                    <span className="text-ink-muted">Loại:</span>{' '}
                    <strong className="text-ink">{checkResult.type === 'IN' ? 'Check-In vào' : 'Check-Out ra'}</strong>
                  </div>
                  <div>
                    <span className="text-ink-muted">Độ khớp khuôn mặt:</span>{' '}
                    <strong className="text-ink">{(checkResult.similarity * 100).toFixed(1)}% (khớp)</strong>
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
        </section>

        {/* ── Cột phải: ca làm việc + 5 lớp xác thực + cảnh báo ─────────── */}
        <div className="flex flex-col gap-3 text-left">
          {/* Ca làm việc */}
          <div className="rounded-2xl border border-line bg-surface p-4 space-y-2.5 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-ink">Ca làm việc hôm nay</div>
                <div className="text-[11px] text-ink-muted mt-0.5">
                  {shiftLoading ? 'Đang tải cấu hình ca…' : myShift ? `Ca áp dụng cho bạn hôm nay${myShift.requiredWorkHours ? ` · ${myShift.requiredWorkHours}h/ngày` : ''}` : 'Chưa xác định được ca làm việc'}
                </div>
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
                <div className="grid grid-cols-3 gap-1.5 text-center">
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
                  {' · khung vào/ra là khoảng hợp lệ'}
                  {myShift.isFlexible ? ', ca linh hoạt' : ''}.
                </p>
              </>
            )}
          </div>

          {/* 5 lớp xác thực — luôn hiển thị, đổi trạng thái khi đang chấm */}
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[13px] font-bold text-ink">5 lớp xác thực</div>
                <div className="text-[11px] text-ink-muted mt-0.5">Chạy song song mỗi lần chấm · tất cả phải đạt</div>
              </div>
              {isScanning && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-accent">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Đang xử lý
                </span>
              )}
            </div>

            <div className="mt-2 divide-y divide-line-soft">
              {verifyLayers.map((layer) => {
                const step = parallelSteps.find((s) => s.name === layer.name);
                const status = isScanning ? step?.status ?? 'pending' : 'idle';
                return (
                  <div key={layer.name} className="flex items-center gap-2.5 py-2">
                    <div className="w-7 h-7 rounded-lg bg-surface-secondary text-ink-secondary flex items-center justify-center shrink-0">
                      <layer.Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11.5px] font-semibold text-ink truncate">{layer.title}</div>
                      <div className="text-[10px] text-ink-muted truncate">{layer.desc}</div>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold ${
                      status === 'passed'
                        ? 'text-status-ok'
                        : status === 'failed'
                        ? 'text-status-danger'
                        : status === 'checking'
                        ? 'text-accent'
                        : 'text-ink-muted'
                    }`}>
                      {status === 'passed'
                        ? 'Đạt'
                        : status === 'failed'
                        ? 'Chặn'
                        : status === 'checking'
                        ? 'Đang kiểm tra'
                        : 'Sẵn sàng'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2.5 rounded-xl bg-status-info-soft border border-status-info-line p-3 text-status-info">
            <InfoIcon className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="text-[11.5px] font-bold">Chấm công cần đủ 5 lớp</div>
              <p className="text-[10.5px] leading-relaxed mt-0.5">
                Thiếu giờ vào/ra vẫn ghi nhận phần có thật — bổ sung công qua đơn từ để HR duyệt.
              </p>
            </div>
          </div>

          {/* Error Alert Display with Specific Remedies (Criteria B1 #6, #8, #9, #10) */}
          {errorMessage && (
            <div className="p-3.5 bg-status-danger-soft border border-status-danger-line rounded-xl text-left text-xs text-status-danger space-y-2 animate-in fade-in">
              <div className="font-bold flex items-center gap-1.5 text-status-danger">
                <AlertTriangle className="w-4 h-4" />
                <span>Lý do bị chặn</span>
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
        </div>
      </div>
    </div>
  );
};
