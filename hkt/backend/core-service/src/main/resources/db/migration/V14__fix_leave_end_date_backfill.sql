-- Sửa backfill V13: LATERAL trả nhiều dòng làm UPDATE chọn sai; chọn ngày cuối cùng.
WITH candidates AS (
    SELECT id,
           work_date,
           ((regexp_match(payload->>'duration', '([0-9]+)\s*ngày'))[1])::int AS days
    FROM requests
    WHERE request_type = 'LEAVE'
      AND COALESCE(payload->>'unit', 'DAY') = 'DAY'
      AND end_date IS NOT DISTINCT FROM work_date
      AND payload->>'duration' ~ '([0-9]+)\s*ngày'
      AND ((regexp_match(payload->>'duration', '([0-9]+)\s*ngày'))[1])::int > 1
)
UPDATE requests r
SET end_date = calc.end_date
FROM candidates c,
LATERAL (
    SELECT MAX(x.d)::date AS end_date
    FROM (
        SELECT d::date AS d
        FROM generate_series(c.work_date, c.work_date + (c.days * 2 + 10), interval '1 day') d
        WHERE EXTRACT(ISODOW FROM d) < 6
          AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.holiday_date = d::date)
        ORDER BY d
        LIMIT c.days
    ) x
) calc
WHERE r.id = c.id;
