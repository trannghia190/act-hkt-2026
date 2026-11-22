/**
 * Fingerprint ổn định của trình duyệt hiện tại — dùng chung cho trang chấm công,
 * trang thêm thiết bị và trang "Thiết bị của tôi" để nhận ra "thiết bị hiện tại"
 * trùng khớp với mã đã gửi lên server.
 */
export const getDeviceFingerprint = (): string => {
  const raw = [
    navigator.userAgent,
    screen.width,
    screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|');
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `web-${Math.abs(hash).toString(16)}`;
};
