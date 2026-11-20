/**
 * Tự động làm mới access token (15′) bằng refresh token (7 ngày).
 * Mọi fetch trả 401/403 sẽ thử refresh 1 lần rồi gọi lại — tránh đăng xuất giữa phiên.
 */
const STORAGE_KEY = 'pulse_auth_user';

type StoredUser = { accessToken?: string; refreshToken?: string; [k: string]: unknown };

const read = (): StoredUser => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
};
const write = (u: StoredUser) => localStorage.setItem(STORAGE_KEY, JSON.stringify(u));

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const user = read();
    if (!user.refreshToken) return null;
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: user.refreshToken }),
      });
      if (!res.ok) return null;
      const json = await res.json().catch(() => ({}));
      const data = json?.data;
      if (!data?.accessToken) return null;
      write({ ...user, ...data });
      return data.accessToken as string;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

let installed = false;

export function installAuthFetch(): void {
  if (installed) return;
  installed = true;
  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const isApi = url.startsWith('/api/') || url.includes('/api/v1/');
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/refresh');

    /**
     * Gửi JWT qua X-Auth-Token, KHÔNG dùng Authorization.
     * Nhờ vậy có thể chạy sau tunnel dùng Authorization cho basic auth
     * (ngrok --basic-auth) mà không bị ghi đè header.
     */
    const withToken = (token?: string, base?: RequestInit): RequestInit => {
      const headers = new Headers(base?.headers || {});
      const auth = headers.get('Authorization');
      let t = token;
      if (!t && auth && auth.startsWith('Bearer ')) t = auth.substring(7);
      if (t) {
        headers.set('X-Auth-Token', t);
        // KHÔNG set Authorization: header này thuộc về tunnel (ngrok Basic Auth).
        // Nếu set Bearer ở đây, ngrok sẽ không thấy Basic và trả 401 → trình duyệt
        // hỏi lại user/pass liên tục. Backend đọc JWT từ X-Auth-Token.
        headers.delete('Authorization');
      }
      return { ...(base || {}), headers };
    };

    // API thường: luôn chuyển Bearer (nếu có) sang X-Auth-Token trước khi gửi.
    const prepared = isApi && !isAuthCall ? withToken(read().accessToken, init) : init;
    const response = await original(input as RequestInfo, prepared);
    if (!isApi || isAuthCall || (response.status !== 401 && response.status !== 403)) {
      return response;
    }

    const token = await refreshAccessToken();
    if (!token) {
      // Refresh token hết hạn/không thuộc backend hiện tại → buộc đăng nhập lại
      // thay vì để UI hiển thị lỗi 403 khó hiểu.
      localStorage.removeItem(STORAGE_KEY);
      if (!location.pathname.startsWith('/login')) {
        location.assign('/login?expired=1');
      }
      return response;
    }
    return original(input as RequestInfo, withToken(token, init));
  };
}
