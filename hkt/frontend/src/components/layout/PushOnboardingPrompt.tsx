import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import {
  PUSH_PROMPT_KEY,
  enablePushOnThisDevice,
  ensurePushSubscription,
  getVapidPublicKey,
  isPushSupported,
  syncPushSubscription,
} from '../../utils/push';

/**
 * Lời mời bật thông báo đẩy cho lần đăng nhập đầu trên thiết bị (S36).
 *
 * Trình duyệt bắt buộc `Notification.requestPermission()` phải nằm trong một
 * cú click, nên không thể bật "im lặng" — nếu quyền đã cấp từ trước (ví dụ
 * trình duyệt nhớ lựa chọn), component tự đăng ký ngầm; nếu chưa, nó hiện
 * lời mời một chạm. Người dùng bấm "Để sau" thì không bị hỏi lại trên thiết
 * bị này; vẫn có thể bật/tắt bất cứ lúc nào ở trang Tuỳ chỉnh thông báo.
 */
export const PushOnboardingPrompt: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPushSupported() || Notification.permission === 'denied') return;
    let cancelled = false;

    (async () => {
      // Quyền đã cấp từ trước → tự đăng ký ngầm, không cần người dùng chạm.
      if (Notification.permission === 'granted') {
        try {
          await syncPushSubscription(await ensurePushSubscription());
        } catch {
          // Không chặn ứng dụng nếu push lỗi.
        }
        return;
      }
      // Chưa quyết định và chưa từng thấy lời mời trên thiết bị này.
      if (localStorage.getItem(PUSH_PROMPT_KEY)) return;
      const key = await getVapidPublicKey();
      if (!cancelled && key) setVisible(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const remember = (value: 'enabled' | 'dismissed') => {
    try {
      localStorage.setItem(PUSH_PROMPT_KEY, value);
    } catch {
      // localStorage bị chặn — chỉ ảnh hưởng việc nhắc lại.
    }
  };

  const handleEnable = async () => {
    setBusy(true);
    setError(null);
    try {
      await enablePushOnThisDevice();
      remember('enabled');
      setVisible(false);
    } catch (e: any) {
      setError(e?.message || 'Không bật được thông báo đẩy.');
    } finally {
      setBusy(false);
    }
  };

  const handleLater = () => {
    remember('dismissed');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-surface border border-line rounded-2xl shadow-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-accent-soft border border-accent-line flex items-center justify-center text-accent">
            <Bell className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-ink">Bật thông báo đẩy?</div>
            <p className="text-xs text-ink-muted leading-relaxed mt-0.5">
              Nhận thông báo ngay trên thiết bị này kể cả khi không mở tab. Có thể tắt/bật lại bất cứ lúc nào trong
              Tuỳ chỉnh thông báo.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLater}
            aria-label="Đóng"
            className="text-ink-muted hover:text-ink p-1 -m-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {error && <div className="text-[11px] text-red-600">{error}</div>}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleLater}
            className="px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink rounded-lg"
          >
            Để sau
          </button>
          <button
            type="button"
            onClick={handleEnable}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-accent hover:opacity-90 rounded-lg disabled:opacity-50"
          >
            {busy ? 'Đang bật…' : 'Bật ngay'}
          </button>
        </div>
      </div>
    </div>
  );
};
