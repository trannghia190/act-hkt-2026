import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';

export const OKRAssessmentPage: React.FC = () => {
  const [selfScore, setSelfScore] = useState<number>(4);
  const [managerScore] = useState<number>(4);
  const [selfNotes, setSelfNotes] = useState(
    'Trong năm 2026, tôi đã hoàn thành vượt mức mục tiêu tối ưu hiệu năng hạ tầng và triển khai bảo mật Keycloak chuẩn cho ActPulse. Các KR quý 1 đến quý 4 đều đạt trên 90%.'
  );
  const [managerFeedback] = useState(
    'Minh thể hiện năng lực kỹ thuật xuất sắc, luôn chủ động giải quyết các bài toán khó và hỗ trợ đồng đội trong nhóm Sirius rất nhiệt tình. Cần phát huy thêm vai trò chia sẻ kiến thức công nghệ (Tech Lead readiness).'
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Đánh Giá Hiệu Suất Cuối Năm (Form 4 Box)</h1>
            <Badge variant="accent">S23</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Tổng kết kết quả thực hiện OKR 4 Quý năm 2026, nhân viên tự đánh giá (Self-review) và Quản lý trực tiếp chấm điểm
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm">
            Lưu Bản Đánh Giá
          </Button>
        </div>
      </div>

      {/* 4 Quarters Performance Summary (4-Box Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-line bg-surface shadow-2xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-xs text-ink">QUÝ 1 / 2026</span>
            <Badge variant="ok">Hoàn thành: 94%</Badge>
          </div>
          <p className="text-xs text-ink-secondary">
            Triển khai cấu trúc dự án chuẩn, tái cấu trúc Backend PulseApplication và bộ rule engine.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-line bg-surface shadow-2xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-xs text-ink">QUÝ 2 / 2026</span>
            <Badge variant="ok">Hoàn thành: 88%</Badge>
          </div>
          <p className="text-xs text-ink-secondary">
            Xây dựng thuật toán nhận diện khuôn mặt kết hợp AI Liveness và xác thực Wi-Fi/GPS 5 tầng.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-line bg-surface shadow-2xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-xs text-ink">QUÝ 3 / 2026</span>
            <Badge variant="ok">Hoàn thành: 91%</Badge>
          </div>
          <p className="text-xs text-ink-secondary">
            Hoàn thiện bảng tổng hợp chấm công 53 cột, module tính phép tự động theo Luật Lao động.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-line bg-surface shadow-2xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-xs text-ink">QUÝ 4 / 2026</span>
            <Badge variant="accent">Hoàn thành: 82% (In-Progress)</Badge>
          </div>
          <p className="text-xs text-ink-secondary">
            Tối ưu hóa P99 Latency &lt; 80ms, tích hợp Keycloak IAM SSO &amp; RBAC toàn diện.
          </p>
        </div>
      </div>

      {/* Self Assessment Box */}
      <Card title="Phần 1: Nhân Viên Tự Đánh Giá (Self-Assessment)">
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-ink font-semibold mb-1">
              Điểm số tự đánh giá (Thang điểm 1 - 5)
            </label>
            <div className="flex items-center gap-3">
              {[1, 2, 3, 4, 5].map(score => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setSelfScore(score)}
                  className={`w-12 h-10 rounded-lg font-bold border transition-all ${
                    selfScore === score
                      ? 'bg-accent text-white border-accent shadow-xs'
                      : 'bg-canvas text-ink-secondary border-line hover:border-line-focus'
                  }`}
                >
                  {score}
                </button>
              ))}
              <span className="text-ink-secondary ml-2">
                {selfScore === 5 ? 'Xuất sắc (Top 10%)' : selfScore === 4 ? 'Vượt kỳ vọng (Exceeds)' : selfScore === 3 ? 'Đạt kỳ vọng (Meets)' : 'Cần cải thiện'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-ink font-semibold mb-1">
              Tự nhận xét thành tựu nổi bật và đóng góp trong năm
            </label>
            <textarea
              rows={4}
              value={selfNotes}
              onChange={e => setSelfNotes(e.target.value)}
              className="w-full p-2.5 border border-line rounded-lg bg-canvas text-xs focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      </Card>

      {/* Manager Evaluation Box */}
      <Card title="Phần 2: Quản Lý Trực Tiếp Đánh Giá (Manager Review)">
        <div className="space-y-4 text-xs">
          <div>
            <span className="text-ink-muted">Điểm đánh giá của Trưởng nhóm (Phạm Minh Tuấn):</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-black text-accent">{managerScore} / 5.0</span>
              <Badge variant="ok">Đánh giá: Vượt kỳ vọng (Exceeds Expectations)</Badge>
            </div>
          </div>

          <div>
            <span className="text-ink-muted">Nhận xét chi tiết của Quản lý:</span>
            <div className="p-3 bg-canvas border border-line rounded-lg text-ink leading-relaxed mt-1">
              {managerFeedback}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
