import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';

interface OKRApprovalItem {
  id: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  quarter: string;
  objectiveTitle: string;
  krCount: number;
  totalWeight: number;
  submittedDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  keyResults: { title: string; target: string; weight: number }[];
}

export const OKRApprovalsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED'>('PENDING');
  const [selectedItem, setSelectedItem] = useState<OKRApprovalItem | null>(null);
  const [managerComment, setManagerComment] = useState('Đồng ý phê duyệt mục tiêu');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const [items, setItems] = useState<OKRApprovalItem[]>([
    {
      id: 'OKR-REQ-001',
      employeeName: 'Nguyễn Văn Minh',
      employeeCode: 'ACT0142',
      department: 'Phát Triển Phần Mềm (Sirius)',
      quarter: 'Quý 4 / 2026',
      objectiveTitle: 'Tối ưu hóa hiệu năng hạ tầng và bảo mật toàn diện cho nền tảng ACT-HKT',
      krCount: 3,
      totalWeight: 100,
      submittedDate: '15/11/2026',
      status: 'PENDING',
      keyResults: [
        { title: 'Tối ưu P99 API response time < 80ms trên toàn hệ thống', target: 'P99 < 80ms', weight: 40 },
        { title: 'Hoàn thiện 45 cột Timesheet Master và công thức tính phép', target: '100% test pass', weight: 30 },
        { title: 'Tích hợp nhận diện khuôn mặt AI Liveness 3 góc chuẩn xác', target: 'Độ chính xác > 98%', weight: 30 },
      ],
    },
    {
      id: 'OKR-REQ-002',
      employeeName: 'Lê Hải Đăng',
      employeeCode: 'ACT0156',
      department: 'Phát Triển Phần Mềm (Sirius)',
      quarter: 'Quý 4 / 2026',
      objectiveTitle: 'Triển khai Rule Engine linh hoạt cấu hình 19 quy chế nhân sự',
      krCount: 2,
      totalWeight: 100,
      submittedDate: '16/11/2026',
      status: 'PENDING',
      keyResults: [
        { title: 'Xây dựng Dry-run simulator kiểm thử rule trước khi áp dụng', target: 'Hoàn thành module', weight: 50 },
        { title: 'Sinh văn bản quy chế tự động khớp 100% với Rule Config', target: '19/19 điều khoản', weight: 50 },
      ],
    },
    {
      id: 'OKR-REQ-003',
      employeeName: 'Trần Thị Thu Hà',
      employeeCode: 'ACT0088',
      department: 'AI & Khoa Học Dữ Liệu (Optimus)',
      quarter: 'Quý 4 / 2026',
      objectiveTitle: 'Nâng cấp mô hình AI Face Matcher & chống gian lận Check-in 5 tầng',
      krCount: 3,
      totalWeight: 100,
      submittedDate: '10/11/2026',
      status: 'APPROVED',
      keyResults: [
        { title: 'Huấn luyện mạng nơ-ron nhận diện khuôn mặt góc nghiêng 45 độ', target: 'F1 Score 0.96', weight: 40 },
        { title: 'Giảm thời gian xử lý AI pipeline < 200ms', target: 'Latency < 200ms', weight: 30 },
        { title: 'Chống ảnh giả mạo màn hình (Anti-spoofing check)', target: '0% False Acceptance', weight: 30 },
      ],
    },
  ]);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  const handleApprove = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'APPROVED' as const } : item))
    );
    setSelectedItem(null);
    showToast('Đã phê duyệt thành công bộ mục tiêu OKR!');
  };

  const handleReject = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'REJECTED' as const } : item))
    );
    setSelectedItem(null);
    showToast('Đã trả về yêu cầu nhân viên điều chỉnh lại mục tiêu.');
  };

  const displayedItems = items.filter((item) => item.status === activeTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Duyệt Mục Tiêu &amp; Check-in OKR Nhóm</h1>
            <Badge variant="accent">S42</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Phê duyệt bộ Mục tiêu (Objectives) và Kết quả then chốt (Key Results) của thành viên trong nhóm, kiểm tra trọng số đủ 100%
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-line">
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'PENDING'
                ? 'bg-accent text-white shadow-xs'
                : 'text-ink-secondary hover:text-ink hover:bg-canvas'
            }`}
          >
            Chờ Duyệt ({items.filter((i) => i.status === 'PENDING').length})
          </button>
          <button
            onClick={() => setActiveTab('APPROVED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'APPROVED'
                ? 'bg-accent text-white shadow-xs'
                : 'text-ink-secondary hover:text-ink hover:bg-canvas'
            }`}
          >
            Đã Phê Duyệt ({items.filter((i) => i.status === 'APPROVED').length})
          </button>
        </div>
      </div>

      {feedbackToast && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold animate-in fade-in">
          ✓ {feedbackToast}
        </div>
      )}

      {/* List of OKR Submissions */}
      <div className="space-y-4">
        {displayedItems.length === 0 ? (
          <div className="p-12 text-center bg-surface rounded-xl border border-line text-ink-muted text-xs">
            Không có hồ sơ mục tiêu nào trong danh sách này.
          </div>
        ) : (
          displayedItems.map((item) => (
            <div
              key={item.id}
              className="p-5 bg-surface rounded-xl border border-line hover:border-line-focus transition-all shadow-2xs space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-ink">{item.employeeName}</span>
                    <span className="font-mono text-emerald-400 text-xs">{item.employeeCode}</span>
                    <Badge variant="accent">{item.quarter}</Badge>
                    {item.status === 'PENDING' ? (
                      <Badge variant="warn">Chờ duyệt</Badge>
                    ) : (
                      <Badge variant="ok">Đã duyệt</Badge>
                    )}
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">{item.department} · Nộp ngày {item.submittedDate}</div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedItem(item)}>
                    Xem Chi Tiết KRs
                  </Button>
                  {item.status === 'PENDING' && (
                    <Button variant="primary" size="sm" onClick={() => handleApprove(item.id)}>
                      Duyệt Nhanh
                    </Button>
                  )}
                </div>
              </div>

              {/* Objective statement */}
              <div className="p-3 bg-canvas rounded-lg text-xs font-medium text-ink border border-line/60">
                🎯 <strong>Mục tiêu:</strong> {item.objectiveTitle}
              </div>

              {/* Summary of KRs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                {item.keyResults.map((kr, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg border border-line bg-surface flex flex-col justify-between">
                    <span className="text-ink font-medium leading-snug">{kr.title}</span>
                    <div className="flex items-center justify-between text-[11px] text-ink-muted mt-2 pt-1 border-t border-line/60">
                      <span>Chỉ tiêu: <strong className="text-ink">{kr.target}</strong></span>
                      <span className="font-bold text-emerald-400">Trọng số: {kr.weight}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Review & Feedback Modal */}
      {selectedItem && (
        <Modal
          isOpen={Boolean(selectedItem)}
          onClose={() => setSelectedItem(null)}
          title={`Thẩm Định Mục Tiêu OKR - ${selectedItem.employeeName}`}
        >
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-ink-muted block text-[11px]">Mục tiêu chính:</span>
              <p className="font-bold text-ink mt-0.5">{selectedItem.objectiveTitle}</p>
            </div>

            <div className="space-y-2">
              <span className="text-ink-muted block text-[11px]">Danh sách Key Results ({selectedItem.keyResults.length}):</span>
              {selectedItem.keyResults.map((kr, idx) => (
                <div key={idx} className="p-2.5 bg-canvas rounded-lg border border-line flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-ink">KR {idx + 1}: {kr.title}</div>
                    <div className="text-[11px] text-ink-muted">Chỉ tiêu định lượng: {kr.target}</div>
                  </div>
                  <span className="font-bold text-emerald-400 font-mono">{kr.weight}%</span>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-ink font-semibold mb-1">Nhận xét &amp; Góp ý của Quản lý</label>
              <textarea
                rows={3}
                value={managerComment}
                onChange={(e) => setManagerComment(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-line bg-surface text-ink"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => handleReject(selectedItem.id)}>
                Yêu Cầu Sửa Lại
              </Button>
              <Button variant="primary" onClick={() => handleApprove(selectedItem.id)}>
                Chấp Thuận &amp; Khóa Mục Tiêu
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
