import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';

export const MidYearReviewPage: React.FC = () => {
  const [selectedQuarter] = useState('Giữa Năm (H1 2026)');
  const [employeeFeedback, setEmployeeFeedback] = useState(
    'Trong 6 tháng đầu năm, nhóm Sirius đã hoàn thành việc tách module và ổn định kiến trúc. Tuy nhiên phần tích hợp AI nhận diện khuôn mặt cần hỗ trợ thêm tài nguyên hạ tầng GPU.'
  );
  const [managerCoachingNotes, setManagerCoachingNotes] = useState(
    'Minh cần chủ động hơn trong việc phối hợp với team Optimus AI. Trong H2 sẽ cần tăng tốc hoàn thành các module chốt công 45 cột và rule engine.'
  );
  const [h2Commitment, setH2Commitment] = useState(
    'Cam kết đạt 100% các KR trong Quý 3 và Quý 4, sẵn sàng kèm cặp 1 Junior Dev mới gia nhập.'
  );
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Review &amp; Coaching Giữa Năm (Mid-Year Review)</h1>
            <Badge variant="accent">S43</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Đánh giá tiến độ 6 tháng đầu năm (H1), điều chỉnh mục tiêu nửa cuối năm (H2) và ghi nhận biên bản 1-on-1 coaching giữa Quản lý và Nhân viên
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={handleSave}>
            Lưu Biên Bản Coaching
          </Button>
        </div>
      </div>

      {isSaved && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold animate-in fade-in">
          ✓ Đã lưu biên bản Review &amp; Coaching Giữa Năm thành công!
        </div>
      )}

      {/* Progress H1 Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-surface rounded-xl border border-line shadow-2xs space-y-1">
          <div className="text-xs text-ink-muted">Tiến Độ Quý 1 / 2026</div>
          <div className="text-2xl font-bold text-ink">94.0%</div>
          <Badge variant="ok">Hoàn thành xuất sắc</Badge>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-line shadow-2xs space-y-1">
          <div className="text-xs text-ink-muted">Tiến Độ Quý 2 / 2026</div>
          <div className="text-2xl font-bold text-ink">88.5%</div>
          <Badge variant="ok">Đạt chỉ tiêu đề ra</Badge>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-accent/40 bg-accent-soft/20 shadow-2xs space-y-1">
          <div className="text-xs text-accent-dark font-medium">Trung Bình 6 Tháng (H1)</div>
          <div className="text-2xl font-black text-accent">91.3%</div>
          <Badge variant="accent">Xếp loại: A (On-Track)</Badge>
        </div>
      </div>

      {/* Coaching & Alignment Form */}
      <Card title="Nội Dung Biên Bản Đối Thoại 1-on-1 Giữa Năm">
        <div className="space-y-5 text-xs">
          <div>
            <label className="block text-ink font-semibold mb-1">
              1. Nhân viên tự chia sẻ thuận lợi &amp; khó khăn trong 6 tháng qua
            </label>
            <textarea
              rows={3}
              value={employeeFeedback}
              onChange={(e) => setEmployeeFeedback(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-line bg-surface text-ink"
            />
          </div>

          <div>
            <label className="block text-ink font-semibold mb-1">
              2. Định hướng &amp; Coaching của Quản lý trực tiếp (Manager Guidance)
            </label>
            <textarea
              rows={3}
              value={managerCoachingNotes}
              onChange={(e) => setManagerCoachingNotes(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-line bg-surface text-ink"
            />
          </div>

          <div>
            <label className="block text-ink font-semibold mb-1">
              3. Kế hoạch hành động &amp; Cam kết mục tiêu nửa cuối năm (H2 Alignment)
            </label>
            <textarea
              rows={3}
              value={h2Commitment}
              onChange={(e) => setH2Commitment(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-line bg-surface text-ink"
            />
          </div>

          <div className="p-3 bg-canvas rounded-lg border border-line text-[11px] text-ink-muted space-y-1">
            <div>• Người đánh giá: <strong>Phạm Minh Tuấn (Tech Lead)</strong></div>
            <div>• Nhân viên được đánh giá: <strong>Nguyễn Văn Minh (Senior Developer)</strong></div>
            <div>• Chu kỳ: {selectedQuarter} · Trạng thái: Đã hoàn tất buổi đối thoại trực tiếp</div>
          </div>
        </div>
      </Card>
    </div>
  );
};
