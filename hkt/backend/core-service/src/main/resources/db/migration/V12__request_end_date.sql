ALTER TABLE requests ADD COLUMN IF NOT EXISTS end_date DATE; UPDATE requests SET end_date = work_date WHERE end_date IS NULL;
