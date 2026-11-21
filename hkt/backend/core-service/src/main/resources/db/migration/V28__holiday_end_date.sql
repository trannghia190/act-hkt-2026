-- Ngày lễ có thể kéo dài nhiều ngày (Tết, nghỉ bù…): holiday_date = ngày bắt đầu,
-- end_date = ngày kết thúc (bao gồm). NULL nghĩa là lễ 1 ngày.
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS end_date DATE;

UPDATE holidays SET end_date = holiday_date WHERE end_date IS NULL;
