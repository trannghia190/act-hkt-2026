/** Hồ sơ cá nhân — đọc/cập nhật tên hiển thị, SĐT, avatar (data URL). */

export interface MyProfile {
  employeeCode: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: string;
  teamName?: string | null;
  departmentName?: string | null;
  positionName?: string | null;
  managerCode?: string | null;
  managerName?: string | null;
  hireDate?: string | null;
  status?: string | null;
  faceEnrolled?: boolean;
  mustChangePassword?: boolean;
  hasPasskey?: boolean;
}

export interface UpdateProfilePayload {
  fullName?: string;
  phone?: string;
  avatarUrl?: string | null;
}

const authToken = (): string => {
  try {
    const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
    return u?.accessToken || '';
  } catch {
    return '';
  }
};

const request = async (method: string, body?: unknown): Promise<MyProfile> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = authToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch('/api/v1/auth/profile', {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || 'Không tải được hồ sơ cá nhân.');
  return json?.data;
};

export const getMyProfile = (): Promise<MyProfile> => request('GET');

export const updateMyProfile = (payload: UpdateProfilePayload): Promise<MyProfile> =>
  request('PUT', payload);

/**
 * Đọc ảnh, cắt vuông giữa ảnh và resize về 256×256 JPEG để lưu data URL gọn nhẹ.
 */
export const resizeAvatar = (file: File, size = 256): Promise<string> => new Promise((resolve, reject) => {
  if (!file.type.startsWith('image/')) {
    reject(new Error('Vui lòng chọn file ảnh (PNG/JPEG).'));
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    reject(new Error('Ảnh quá lớn — vui lòng chọn ảnh nhỏ hơn 8MB.'));
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('Ảnh không hợp lệ.'));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Trình duyệt không xử lý được ảnh.'));
        return;
      }
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = String(reader.result);
  };
  reader.readAsDataURL(file);
});
