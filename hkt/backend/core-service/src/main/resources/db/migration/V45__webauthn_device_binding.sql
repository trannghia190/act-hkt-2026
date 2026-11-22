-- Lớp khóa thiết bị bằng WebAuthn/Passkey: lưu public key thay vì tin fingerprint client.
ALTER TABLE devices ADD COLUMN IF NOT EXISTS credential_id VARCHAR(255);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS public_key_cose BYTEA;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS user_handle_b64 VARCHAR(64);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS signature_count BIGINT NOT NULL DEFAULT 0;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS transports VARCHAR(255);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS backup_eligible BOOLEAN;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS backup_state BOOLEAN;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS authenticator_attachment VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS ux_devices_credential_id
    ON devices (credential_id) WHERE credential_id IS NOT NULL;

-- Challenge dùng một lần, hết hạn 2 phút, gắn user + ceremony + origin.
CREATE TABLE IF NOT EXISTS webauthn_challenges (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    ceremony_type VARCHAR(16) NOT NULL,
    request_json TEXT NOT NULL,
    origin VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    consumed_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE
);
CREATE INDEX IF NOT EXISTS ix_webauthn_challenges_user ON webauthn_challenges (user_id, ceremony_type);
CREATE INDEX IF NOT EXISTS ix_webauthn_challenges_expires ON webauthn_challenges (expires_at);

-- Bật WebAuthn mặc định; rule text chứa JSON nên ép qua jsonb rồi trả lại text.
UPDATE rules
SET current_value = (current_value::jsonb || '{"webauthn_required": true}'::jsonb)::text
WHERE rule_key = 'attendance_security';
