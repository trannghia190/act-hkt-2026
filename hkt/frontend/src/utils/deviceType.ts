export type ClientDeviceType = 'DESKTOP' | 'MOBILE' | 'TABLET' | 'UNKNOWN';

/**
 * Nhận diện loại thiết bị phía client. iPadOS 13+ gửi UA giống macOS nên server
 * không tự phân biệt được — `maxTouchPoints` là dấu hiệu duy nhất.
 * Server chỉ dùng giá trị này để hiển thị, luôn validate lại theo enum.
 */
export const detectClientDeviceType = (): ClientDeviceType => {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua)) return 'TABLET';
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'TABLET';
  if (/iPhone|iPod/.test(ua)) return 'MOBILE';
  if (/Windows Phone|IEMobile/.test(ua)) return 'MOBILE';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'MOBILE' : 'TABLET';
  if (/Windows|Macintosh|Linux|CrOS/.test(ua)) return 'DESKTOP';
  return 'UNKNOWN';
};
