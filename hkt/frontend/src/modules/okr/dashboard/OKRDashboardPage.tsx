import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';

export const OKRDashboardPage: React.FC = () => {
  const [selectedCycle, setSelectedCycle] = useState('Năm 2026 (Quý 4)');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Bảng Điều Khiển Mục Tiêu &amp; Hiệu Suất (OKR Dashboard)</h1>
            <Badge variant="accent">S20</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Tổng quan tiến độ thực hiện mục tiêu cấp Công ty, Phòng ban và mức độ đóng góp của từng cá nhân
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedCycle}
            onChange={e => setSelectedCycle(e.target.value)}
            className="text-xs p-2 border border-line rounded-lg bg-surface font-semibold text-ink"
          >
            <option value="Năm 2026 (Quý 4)">Năm 2026 (Quý 4 - Hiện tại)</option>
            <option value="Năm 2026 (Quý 3)">Năm 2026 (Quý 3)</option>
            <option value="Năm 2026 (Cả năm)">Năm 2026 (Cả năm)</option>
          </select>
        </div>
      </div>

      {/* S20 · Self proposal năm sau */}
      <div className="p-4 rounded-xl border border-accent/40 bg-accent-soft/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-accent-dark">Self proposal năm 2027 — Đang viết</div>
          <div className="text-xs text-ink-secondary mt-1">Tự đề xuất mục tiêu định hướng năm sau · lưu nháp 12/11 · hạn nộp 30/11/2026</div>
        </div>
        <a href="/okr/my-okr" className="text-xs px-3 py-1.5 rounded bg-accent text-white self-start sm:self-center">Tiếp tục viết đề xuất</a>
      </div>

      {/* High-level Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-surface rounded-xl border border-line">
          <div className="text-xs text-ink-muted">Tiến Độ Toàn Công Ty</div>
          <div className="text-3xl font-extrabold text-accent mt-1">78.4%</div>
          <div className="w-full bg-line rounded-full h-2 mt-2">
            <div className="bg-accent h-2 rounded-full" style={{ width: '78.4%' }} />
          </div>
          <div className="text-[11px] text-ink-secondary mt-1.5">3 Mục tiêu trọng tâm cấp công ty</div>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-line">
          <div className="text-xs text-ink-muted">Tỷ Lệ Check-In Tuần</div>
          <div className="text-3xl font-extrabold text-emerald-700 mt-1">94.2%</div>
          <div className="w-full bg-line rounded-full h-2 mt-2">
            <div className="bg-emerald-600 h-2 rounded-full" style={{ width: '94.2%' }} />
          </div>
          <div className="text-[11px] text-ink-secondary mt-1.5">49/52 nhân sự đã cập nhật tuần này</div>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-line">
          <div className="text-xs text-ink-muted">Mục Tiêu Đạt Chuẩn (On-Track)</div>
          <div className="text-3xl font-extrabold text-ink mt-1">14 / 18</div>
          <div className="text-[11px] text-emerald-700 mt-2 font-medium">
            ✓ 77% KR đang đúng tiến độ
          </div>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-line">
          <div className="text-xs text-ink-muted">Mục Tiêu Có Rủi Ro (At Risk)</div>
          <div className="text-3xl font-extrabold text-rose-700 mt-1">2 KR</div>
          <div className="text-[11px] text-rose-600 mt-2 font-medium">
            ⚠️ Cần can thiệp hỗ trợ tài nguyên
          </div>
        </div>
      </div>

      {/* Company OKRs Section */}
      <Card title="Mục Tiêu Chiến Lược Cấp Công Ty (Company Objectives)">
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-line bg-canvas/30 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-accent-dark">MỤC TIÊU 1 (O1):</span>
                <h3 className="text-sm font-bold text-ink">Nâng Cấp Nền Tảng Chấm Công &amp; Đánh Giá Nhân Sự ActPulse Đạt Chuẩn Doanh Nghiệp</h3>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-ink">82% Hoàn thành</span>
              </div>
            </div>

            {/* Key Results */}
            <div className="space-y-2 border-t border-line/60 pt-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink">KR 1.1: Triển khai 5 tầng bảo mật chấm công khuôn mặt AI và vị trí thực</span>
                <span className="font-semibold text-emerald-700">95% (Đã nghiệm thu)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink">KR 1.2: Hoàn tất tích hợp Keycloak IAM SSO &amp; RBAC nội bộ</span>
                <span className="font-semibold text-emerald-700">90% (Đang test tải)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink">KR 1.3: Đạt chỉ số hài lòng nhân viên nội bộ (eNPS) &gt; 85 điểm</span>
                <span className="font-semibold text-amber-700">62% (Đang khảo sát)</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-line bg-canvas/30 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-accent-dark">MỤC TIÊU 2 (O2):</span>
                <h3 className="text-sm font-bold text-ink">Đẩy Mạnh Tăng Trưởng Doanh Thu B2B Sản Phẩm Mobile App &amp; Chữ Ký Số CA</h3>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-ink">74% Hoàn thành</span>
              </div>
            </div>

            <div className="space-y-2 border-t border-line/60 pt-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink">KR 2.1: Đạt mốc 15,000 active users hàng tháng trên ứng dụng di động</span>
                <span className="font-semibold text-emerald-700">80% (12,000 users)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink">KR 2.2: Ký mới 5 hợp đồng đối tác doanh nghiệp lớn</span>
                <span className="font-semibold text-amber-700">60% (3/5 hợp đồng)</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
