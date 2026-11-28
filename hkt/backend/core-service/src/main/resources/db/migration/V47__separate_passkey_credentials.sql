-- Tách Passkey (đăng nhập nhanh) ra khỏi thiết bị chấm công.
-- Passkey không còn là "thiết bị": không chiếm hạn mức max_devices, không hiện trong S27,
-- và chấm công chỉ dùng fingerprint thiết bị + khuôn mặt như trước.
CREATE TABLE IF NOT EXISTS passkey_credentials (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    credential_id VARCHAR(255) NOT NULL,
    public_key_cose BYTEA NOT NULL,
    user_handle_b64 VARCHAR(64),
    signature_count BIGINT NOT NULL DEFAULT 0,
    transports VARCHAR(255),
    backup_eligible BOOLEAN,
    backup_state BOOLEAN,
    authenticator_attachment VARCHAR(32),
    label VARCHAR(100),
    last_used_at TIMESTAMP WITHOUT TIME ZONE,
    revoked_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_passkey_credentials_credential_id
    ON passkey_credentials (credential_id);
CREATE INDEX IF NOT EXISTS ix_passkey_credentials_user
    ON passkey_credentials (user_id);

-- Chuyển các passkey cũ đang nằm lẫn trong devices sang bảng riêng.
INSERT INTO passkey_credentials (
    id, user_id, credential_id, public_key_cose, user_handle_b64, signature_count,
    transports, backup_eligible, backup_state, authenticator_attachment, label,
    last_used_at, created_at, updated_at
)
SELECT
    id, user_id, credential_id, public_key_cose, user_handle_b64, COALESCE(signature_count, 0),
    transports, backup_eligible, backup_state, authenticator_attachment,
    COALESCE(device_model, 'Passkey (WebAuthn)'),
    -- devices chỉ có created_at/last_active_at (không có updated_at).
    last_active_at, created_at, NULL
FROM devices
WHERE credential_id IS NOT NULL AND public_key_cose IS NOT NULL
ON CONFLICT (credential_id) DO NOTHING;

-- Hàng passkey giả có thể đã được ghi vào lịch sử chấm công — gỡ tham chiếu trước khi xóa.
UPDATE attendance_logs
SET device_id = NULL
WHERE device_id IN (SELECT id FROM devices WHERE credential_id IS NOT NULL);

DELETE FROM devices WHERE credential_id IS NOT NULL;

DROP INDEX IF EXISTS ux_devices_credential_id;

ALTER TABLE devices
    DROP COLUMN IF EXISTS credential_id,
    DROP COLUMN IF EXISTS public_key_cose,
    DROP COLUMN IF EXISTS user_handle_b64,
    DROP COLUMN IF EXISTS signature_count,
    DROP COLUMN IF EXISTS transports,
    DROP COLUMN IF EXISTS backup_eligible,
    DROP COLUMN IF EXISTS backup_state,
    DROP COLUMN IF EXISTS authenticator_attachment;

-- Chấm công không còn phụ thuộc passkey.
UPDATE rules
SET current_value = (current_value::jsonb - 'webauthn_required')::text
WHERE rule_key = 'attendance_security';
