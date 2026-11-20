-- Lưu trạng thái hoàn tất việc cần làm theo người dùng (thay vì giữ trong RAM).
CREATE TABLE IF NOT EXISTS todo_completions (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    todo_id VARCHAR(50) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, todo_id)
);
