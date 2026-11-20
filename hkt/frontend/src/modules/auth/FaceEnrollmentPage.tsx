import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

type Angle = 'FRONTAL' | 'LEFT' | 'RIGHT';

const ANGLES: { key: Angle; label: string; hint: string }[] = [
  { key: 'FRONTAL', label: 'Chính diện (0°)', hint: 'Nhìn thẳng vào camera, mặt thư giãn' },
  { key: 'LEFT', label: 'Nghiêng trái (-30°)', hint: 'Quay nhẹ mặt sang trái' },
  { key: 'RIGHT', label: 'Nghiêng phải (+30°)', hint: 'Quay nhẹ mặt sang phải' },
];

/**
 * Đăng ký khuôn mặt 3 góc — chỉ đăng ký cho CHÍNH tài khoản đang đăng nhập.
 * Business: docs/01 "Hồ sơ khuôn mặt" + docs/08 B0.
 * Không cho nhập tay mã nhân viên (tránh đăng ký khuôn mặt thay người khác).
 */
export const FaceEnrollmentPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [activeAngle, setActiveAngle] = useState<Angle>('FRONTAL');
  const [captures, setCaptures] = useState<Record<Angle, string | null>>({
    FRONTAL: null,
    LEFT: null,
    RIGHT: null,
  });
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }, audio: false })
      .then((s) => {
        activeStream = s;
        setStream(s);
      })
      .catch((err) => {
        setMessage(`Không mở được camera: ${err?.message || 'quyền bị từ chối'}`);
        setStatus('error');
      });
    return () => {
      if (activeStream) activeStream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => undefined);
    }
  }, [stream]);

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) {
      setMessage('Camera chưa sẵn sàng — vui lòng thử lại');
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCaptures((prev) => ({ ...prev, [activeAngle]: dataUrl }));
    const next = ANGLES.find((a) => a.key !== activeAngle && !captures[a.key]);
    if (next) setActiveAngle(next.key);
  };

  const retake = (angle: Angle) => {
    setCaptures((prev) => ({ ...prev, [angle]: null }));
    setActiveAngle(angle);
    setStatus('idle');
  };

  const enroll = async () => {
    if (!user?.employeeCode) {
      setMessage('Không xác định được tài khoản đang đăng nhập');
      setStatus('error');
      return;
    }
    if (!captures.FRONTAL || !captures.LEFT || !captures.RIGHT) {
      setMessage('Cần chụp đủ 3 góc trước khi đăng ký');
      setStatus('error');
      return;
    }
    setStatus('processing');
    setMessage(null);
    try {
      const aiRes = await fetch('/ai-face/api/v1/face/enroll-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_code: user.employeeCode,
          full_name: user.fullName || user.employeeCode,
          department: user.department || '',
          frontal_image: captures.FRONTAL,
          left_image: captures.LEFT,
          right_image: captures.RIGHT,
        }),
      });
      const aiJson = await aiRes.json().catch(() => ({}));
      if (!aiRes.ok) {
        throw new Error(aiJson.detail || aiJson.message || 'Không trích xuất được vector khuôn mặt');
      }

      // Đánh dấu đã đăng ký ở Core Service — chỉ cho chính tài khoản đang đăng nhập
      const coreHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user?.accessToken) {
        coreHeaders['Authorization'] = `Bearer ${user.accessToken}`;
      }
      const coreRes = await fetch('/api/v1/auth/enroll-face', {
        method: 'POST',
        headers: coreHeaders,
        body: JSON.stringify({
          employeeCode: user.employeeCode,
          faceDataUrl: captures.FRONTAL,
          confidenceScore: 0.95,
        }),
      });
      if (!coreRes.ok) {
        const coreJson = await coreRes.json().catch(() => ({}));
        throw new Error(coreJson.message || 'Core Service không ghi nhận được đăng ký khuôn mặt');
      }

      updateUser({ faceEnrolled: true });
      setStatus('success');
      setMessage(aiJson.message || 'Đăng ký khuôn mặt 3 góc thành công');
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Đăng ký khuôn mặt thất bại — vui lòng thử lại');
    }
  };

  const allCaptured = Boolean(captures.FRONTAL && captures.LEFT && captures.RIGHT);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="bg-canvas border border-line rounded-xl p-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent-soft text-accent rounded-full text-xs font-semibold border border-accent-line mb-2">
          <span>📸</span> Đăng ký khuôn mặt (S01-B · task B0)
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Đăng ký khuôn mặt — 3 góc</h1>
        <p className="text-xs text-ink-muted mt-1">
          Tài khoản: <b>{user?.employeeCode || '—'}</b> · {user?.fullName || '—'} — chỉ đăng ký cho chính tài khoản đang đăng nhập.
          Hệ thống chỉ lưu vector đặc trưng, không lưu ảnh thô.
        </p>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-canvas border border-line rounded-xl overflow-hidden">
          <video ref={videoRef} className="w-full aspect-square object-cover bg-black" muted playsInline />
          <div className="p-3 text-center text-xs text-ink-muted">
            {ANGLES.find((a) => a.key === activeAngle)?.hint}
          </div>
        </div>

        <div className="space-y-2">
          {ANGLES.map((angle) => {
            const done = Boolean(captures[angle.key]);
            const active = activeAngle === angle.key;
            return (
              <div
                key={angle.key}
                className={`p-3 rounded-lg border flex items-center gap-3 ${
                  active ? 'border-accent bg-accent-soft/40' : 'border-line bg-canvas'
                }`}
              >
                {captures[angle.key] ? (
                  <img src={captures[angle.key]!} alt={angle.label} className="w-12 h-12 rounded object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded bg-line/40 grid place-items-center text-xs">{done ? '✓' : '—'}</div>
                )}
                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink">{angle.label}</div>
                  <div className="text-xs text-ink-muted">{done ? 'Đã chụp' : 'Chưa chụp'}</div>
                </div>
                {done ? (
                  <button type="button" className="text-xs px-2 py-1 rounded border border-line" onClick={() => retake(angle.key)}>
                    Chụp lại
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded bg-accent text-white disabled:opacity-50"
                    disabled={activeAngle !== angle.key || !stream}
                    onClick={capture}
                  >
                    Chụp
                  </button>
                )}
              </div>
            );
          })}

          <button
            type="button"
            className="w-full mt-2 px-3 py-2 rounded-lg bg-accent text-white font-semibold disabled:opacity-50"
            disabled={!allCaptured || status === 'processing'}
            onClick={enroll}
          >
            {status === 'processing' ? 'Đang đăng ký…' : 'Hoàn tất đăng ký'}
          </button>
          <button type="button" className="w-full px-3 py-2 rounded-lg border border-line text-sm" onClick={() => navigate('/attendance/checkin')}>
            Đến màn hình chấm công
          </button>
        </div>
      </div>

      {message && (
        <div className={`text-sm rounded-lg p-3 border ${
          status === 'error' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'
        }`}>
          {message}
        </div>
      )}
    </div>
  );
};
