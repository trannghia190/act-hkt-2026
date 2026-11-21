-- V18_1: V19__seed_team_lead_account chèn dữ liệu vào cột attendance_logs.type nhưng chưa migration/entity nào
-- tạo cột này → V19 lỗi "column type does not exist" trên mọi DB. Bổ sung cột (nullable) trước khi V19 chạy.
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS type VARCHAR(20);
