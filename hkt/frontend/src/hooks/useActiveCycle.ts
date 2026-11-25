import { useEffect, useState } from 'react';

/**
 * Chu kỳ OKR đang hoạt động (chỉ 1 chu kỳ active toàn hệ thống).
 * hasActiveCycle = false → các màn nhân viên/quản lý hiển thị empty state
 * "Hiện tại không có kỳ OKR nào được thiết lập".
 */
export function useActiveCycle() {
  const [hasActiveCycle, setHasActiveCycle] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/v1/okr/cycles/current')
      .then((r) => r.json())
      .then((j) => {
        if (mounted) setHasActiveCycle(Boolean(j?.data));
      })
      .catch(() => {
        // Lỗi mạng → không chặn UI, coi như có chu kỳ để người dùng vẫn thao tác được.
        if (mounted) setHasActiveCycle(true);
      });
    return () => { mounted = false; };
  }, []);

  return { hasActiveCycle };
}
