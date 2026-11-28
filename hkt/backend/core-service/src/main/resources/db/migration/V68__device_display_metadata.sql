-- =========================================================================
-- ACT PULSE 2026 - Flyway V68: Thông tin hiển thị thiết bị cho HR
-- =========================================================================
-- HR cần biết thiết bị thuộc nhân viên nào và là máy tính / điện thoại /
-- máy tính bảng. Lưu loại thiết bị + User-Agent gốc + lý do yêu cầu ngay trên
-- hàng devices (trước đây lý do chỉ nằm trong audit_logs).

ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_type VARCHAR(16);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS user_agent VARCHAR(255);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS request_reason VARCHAR(500);

-- Backfill loại thiết bị cho dữ liệu cũ (chưa có user_agent) dựa trên tên/model
-- đã lưu. Thứ tự ưu tiên khớp với DeviceUserAgentParser.effectiveType:
-- tablet -> mobile -> desktop -> unknown.
UPDATE devices SET device_type = CASE
    WHEN device_model ~* '(ipad|tablet|máy tính bảng|may tinh bang)' THEN 'TABLET'
    WHEN device_model ~* '(iphone|android|mobile|phone|điện thoại|dien thoai)' THEN 'MOBILE'
    WHEN device_model ~* '(pc|windows|mac|linux|browser|máy tính|may tinh)' THEN 'DESKTOP'
    ELSE 'UNKNOWN'
END
WHERE device_type IS NULL;
