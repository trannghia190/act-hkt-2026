-- Passkey login (usernameless): challenge đăng nhập chưa biết trước người dùng —
-- server chỉ còn biết user sau khi verify assertion (map credential_id → devices.user_id).
ALTER TABLE webauthn_challenges ALTER COLUMN user_id DROP NOT NULL;
