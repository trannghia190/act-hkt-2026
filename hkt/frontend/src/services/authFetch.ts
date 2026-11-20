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

    const withToken = (token?: string): RequestInit => {
      if (!token) return init || {};
      const headers = new Headers(init?.headers || {});
      headers.set('Authorization', `Bearer ${token}`);
      return { ...(init || {}), headers };
    };

    const response = await original(input as RequestInfo, init);
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
    return original(input as RequestInfo, withToken(token));
  };
}
