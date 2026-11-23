/**
 * Web Push phía trình duyệt (S36).
 *
 * Lưu ý: trình duyệt chỉ cho `Notification.requestPermission()` chạy trong một
 * thao tác người dùng thật (click). Vì vậy không thể "tự bật" hoàn toàn khi
 * đăng nhập lần đầu — ta chỉ có thể:
 *   1. Nếu quyền đã được cấp từ trước → tự đăng ký ngầm (không cần chạm).
 *   2. Nếu chưa quyết định → hiện lời mời một chạm (PushOnboardingPrompt),
 *      người dùng bấm "Bật ngay" là đủ thao tác để trình duyệt cho phép.
 */

export const PUSH_PROMPT_KEY = 'pulse:pushPromptDecided';

export const isPushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window;

const urlBase64ToUint8Array = (base64: string): Uint8Array<ArrayBuffer> => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
};

/** VAPID public key từ server; null nếu backend chưa bật push. */
export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/v1/notifications/push/public-key');
    const data = (await res.json())?.data;
    return data?.enabled && data.publicKey ? data.publicKey : null;
  } catch {
    return null;
  }
}

/**
 * Đăng ký (hoặc lấy lại) subscription cho thiết bị này.
 * KHÔNG gọi `requestPermission` — caller tự lo phần quyền.
 */
export async function ensurePushSubscription(): Promise<PushSubscription> {
  const publicKey = await getVapidPublicKey();
  if (!publicKey) throw new Error('Máy chủ chưa cấu hình VAPID cho Web Push.');
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return (
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }))
  );
}

/** Gửi subscription hiện tại lên server (server cũng bật `pushEnabled` cho user). */
export async function syncPushSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  const res = await fetch('/api/v1/notifications/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      userAgent: navigator.userAgent,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.success === false) {
    throw new Error(body?.message || 'Máy chủ từ chối đăng ký push (' + res.status + ')');
  }
}

/** Bật push trên thiết bị này — phải gọi từ một sự kiện click của người dùng. */
export async function enablePushOnThisDevice(): Promise<PushSubscription> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Bạn đã từ chối quyền thông báo — hãy bật lại trong cài đặt trình duyệt.');
  }
  const sub = await ensurePushSubscription();
  await syncPushSubscription(sub);
  return sub;
}

/** Tắt push trên thiết bị này (huỷ subscription + xoá trên server). */
export async function disablePushOnThisDevice(): Promise<boolean> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return false;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  const res = await fetch('/api/v1/notifications/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });
  return res.ok;
}
