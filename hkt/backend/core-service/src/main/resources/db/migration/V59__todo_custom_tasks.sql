-- Todo Inbox S02: việc tự tạo phải sống qua restart + dùng chung nguồn đếm với badge/digest.
CREATE TABLE IF NOT EXISTS todo_custom_tasks (
    id           VARCHAR(64) PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    urgency      VARCHAR(20) NOT NULL DEFAULT 'today',
    module       VARCHAR(20) NOT NULL DEFAULT 'system',
    action_url   VARCHAR(255),
    action_label VARCHAR(100),
    due_date     VARCHAR(50),
    created_at   TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_todo_custom_tasks_user
    ON todo_custom_tasks (user_id, created_at DESC);
