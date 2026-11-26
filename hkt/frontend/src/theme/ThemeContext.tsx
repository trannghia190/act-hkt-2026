import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Theme 3 template màu cho ACT HR.
 *
 * - Nguồn sự thật: DB (`users.theme`) — đồng bộ qua máy.
 * - Cache: localStorage — áp NGAY lúc boot (index.html đọc trước React render)
 *   để không nháy màn hình trắng.
 * - Áp dụng: đặt `data-theme` trên <html>; mọi màu lấy từ CSS custom property
 *   (xem src/index.css + tailwind.config.js).
 */

export type ThemeId = 'ascend-clean' | 'midnight-rail' | 'bento-studio';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  description: string;
  /** Màu preview — hex để vẽ swatch (không phải token Tailwind). */
  preview: {
    brand: string;
    surface: string;
    rail: string;
    ink: string;
    ok: string;
    warn: string;
    danger: string;
  };
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'ascend-clean',
    name: 'Ascend Clean',
    description: 'Nền sáng, sidebar trắng, viền hairline. Gọn và đọc dễ.',
    preview: {
      brand: '#E31D1A',
      surface: '#FFFFFF',
      rail: '#FFFFFF',
      ink: '#17171A',
      ok: '#116A3A',
      warn: '#9A5B00',
      danger: '#B42318',
    },
  },
  {
    id: 'midnight-rail',
    name: 'Midnight Rail',
    description: 'Sidebar tối, nội dung sáng. Tách vùng điều hướng rõ ràng.',
    preview: {
      brand: '#E31D1A',
      surface: '#FFFFFF',
      rail: '#101114',
      ink: '#17171A',
      ok: '#116A3A',
      warn: '#9A5B00',
      danger: '#B42318',
    },
  },
  {
    id: 'bento-studio',
    name: 'Bento Studio',
    description: 'Nền tối toàn bộ, đỏ sáng nổi bật. Dành cho màn hình nhiều dữ liệu.',
    preview: {
      brand: '#FF5147',
      surface: '#141519',
      rail: '#0A0B0E',
      ink: '#F2F3F5',
      ok: '#3DD68C',
      warn: '#F5A524',
      danger: '#FF8078',
    },
  },
];

/** Template mặc định — Midnight Rail. */
export const DEFAULT_THEME: ThemeId = 'midnight-rail';

export const THEME_STORAGE_KEY = 'act_theme';

const isThemeId = (v: unknown): v is ThemeId =>
  typeof v === 'string' && THEMES.some((t) => t.id === v);

interface ThemeContextValue {
  theme: ThemeId;
  themes: ThemeMeta[];
  /** Đổi theme: áp ngay (localStorage + DOM) rồi sync DB. */
  setTheme: (id: ThemeId) => void;
  /** True khi đã thử đồng bộ theme từ server. */
  synced: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  themes: THEMES,
  setTheme: () => {},
  synced: false,
});

/** Đọc theme đã cache (index.html cũng đọc để chống nháy trắng). */
export function readCachedTheme(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Ghi theme vào DOM + cache. Không đụng server. */
export function applyTheme(id: ThemeId) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = id;
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* private mode / hết quota — bỏ qua, theme vẫn áp trong phiên này */
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeId>(() => readCachedTheme());
  const [synced, setSynced] = useState(false);

  // Áp theme hiện tại khi mount (đồng bộ với index.html đã set sẵn)
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Đọc theme từ server (DB là nguồn sự thật) — chỉ lần đầu.
  useEffect(() => {
    let cancelled = false;
    const token = (() => {
      try {
        return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken || '';
      } catch {
        return '';
      }
    })();
    if (!token) {
      setSynced(true);
      return;
    }
    fetch('/api/v1/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return;
        const fromServer = json?.data?.theme;
        if (isThemeId(fromServer)) {
          setThemeState(fromServer);
        }
      })
      .catch(() => {
        /* offline / lỗi mạng — giữ theme trong cache */
      })
      .finally(() => {
        if (!cancelled) setSynced(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    if (!isThemeId(id)) return;
    // Áp ngay để cảm giác tức thì, rồi mới sync DB.
    setThemeState(id);
    applyTheme(id);

    const token = (() => {
      try {
        return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.accessToken || '';
      } catch {
        return '';
      }
    })();
    if (!token) return;
    fetch('/api/v1/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ theme: id }),
    }).catch(() => {
      /* Không chặn thao tác của người dùng nếu sync lỗi */
    });
  }, []);

  const value = useMemo(
    () => ({ theme, themes: THEMES, setTheme, synced }),
    [theme, setTheme, synced],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
