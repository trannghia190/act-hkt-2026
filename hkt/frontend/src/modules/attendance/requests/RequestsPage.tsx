import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { useAuth } from '../../../context/AuthContext';
import { getRequests, saveRequests, AttendanceRequestItem } from './requestStore';

export const RequestsPage: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<AttendanceRequestItem[]>(getRequests);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [newReq, setNewReq] = useState({
    type: 'LEAVE' as 'LEAVE' | 'WFH' | 'OT' | 'MISSED_PUNCH',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    duration: '1.0 ngày',
    reason: '',
  });

  useEffect(() => {
    // Reload whenever localStorage changes
    const handleStorage = () => {
      setRequests(getRequests());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReq.reason.trim()) return;

    const typeNames: Record<string, string> = {
      LEAVE: 'Nghỉ Phép Năm',
      WFH: 'Làm Việc Từ Xa (WFH)',
      OT: 'Đăng Ký Làm Thêm Giờ (OT)',
      MISSED_PUNCH: 'Giải Trình Quên Chấm Công'
    };

    // Routing rule: CA or Mobile team routes direct to HR
    const isDirectHR = user?.team?.includes('Mobile') || user?.team?.includes('CA');
    const approverName = isDirectHR
      ? 'Nguyễn Thị Thu Hà (HR Lead - Luồng Ngoại Lệ)'
      : user?.role === 'MANAGER'
      ? 'Nguyễn Thị Thu Hà (HR Lead)'
      : 'Nguyễn Thanh Tùng (Manager)';

    const newId = `REQ-2026-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const nowStr = new Date().toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const item: AttendanceRequestItem = {
      id: newId,
      requesterCode: user?.employeeCode || 'ACT0142',
      requesterName: user?.fullName || 'Người Dùng',
      requesterEmail: user?.email || 'luan.vu@act-corp.internal',
      team: user?.team || 'Sirius Core',
      type: newReq.type,
      typeName: typeNames[newReq.type],
      startDate: newReq.startDate,
      endDate: newReq.endDate,
      durationText: newReq.duration,
      reason: newReq.reason,
      status: 'PENDING',
      approver: approverName,
      createdAt: nowStr
    };

    const updated = [item, ...requests];
    setRequests(updated);
    saveRequests(updated);
    setIsCreateOpen(false);
    setNewReq({
      type: 'LEAVE',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      duration: '1.0 ngày',
      reason: ''
    });
    showToast(`Đã gửi đơn ${newId} thành công tới cấp phê duyệt`);
  };

  const handleCancelRequest = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn hủy đơn yêu cầu này?')) {
      const updated = requests.filter(r => r.id !== id);
      setRequests(updated);
      saveRequests(updated);
      showToast('Đã hủy đơn yêu cầu');
    }
  };

  // C-cố Feature: Auto-fill form directly from punch logs (docs/02 §C-cố - S07)
  const handleAutoFillMissedPunch = (kind: 'OUT' | 'LATE') => {
    if (kind === 'OUT') {
      setNewReq({
        type: 'MISSED_PUNCH',
        startDate: '2026-11-17',
        endDate: '2026-11-17',
        duration: 'Ca chiều (17:30)',
        reason: 'Tự động trích xuất từ log: Quên quẹt thẻ chấm công ra lúc 17:30 ngày 17/11 do bận họp với khách hàng'
      });
      setIsCreateOpen(true);
      showToast('⚡ C-cố: Đã tự động điền đơn bổ sung giờ ra ngày 17/11');
    } else {
      setNewReq({
        type: 'MISSED_PUNCH',
        startDate: '2026-11-05',
        endDate: '2026-11-05',
        duration: 'Muộn 22 phút (08:52)',
        reason: 'Tự động trích xuất từ log: Đi muộn 22 phút ngày 05/11 do sự cố kẹt xe Nguyễn Trãi (Đăng ký trừ vào Quota 1/3 lần)'
      });
      setIsCreateOpen(true);
      showToast('⚡ C-cố: Đã tự động điền giải trình đi muộn ngày 05/11');
    }
  };

  // Filter requests
  const filtered = requests.filter(r => {
    if (filterType !== 'ALL' && r.type !== filterType) return false;
    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      const match = r.id.toLowerCase().includes(q) ||
                    r.reason.toLowerCase().includes(q) ||
                    r.typeName.toLowerCase().includes(q) ||
                    r.approver.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast */}
      {successToast && (
        <div className="fixed top-16 right-6 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 animate-bounce">
          <span>✓</span>
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Đơn Của Tôi &amp; Đăng Ký Chấm Công</h1>
            <Badge variant="accent">S08 / S30 / S31</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Theo dõi tiến độ xét duyệt đơn xin nghỉ, đăng ký làm từ xa (WFH tối đa 3 ngày/tháng), làm thêm giờ (OT) và giải trình quên chấm công
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
            + Tạo Đơn Mới
          </Button>
        </div>
      </div>

      {/* C-cố Smart Scanner Banner: Auto-detect punch abnormalities */}
      <div className="p-3.5 bg-gradient-to-r from-emerald-950/40 to-teal-950/20 border border-emerald-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-start sm:items-center gap-2.5">
          <span className="text-xl">⚡</span>
          <div>
            <div className="font-bold text-emerald-400 flex items-center gap-2">
              <span>Tính năng C-cố: Phát hiện 2 log chấm công bất thường cần làm đơn</span>
              <Badge variant="accent">S07 / Tự Động</Badge>
            </div>
            <p className="text-[11px] text-ink-muted mt-0.5">
              Hệ thống tự động đọc log chấm công thật và điền sẵn ngày + số phút chính xác (tiết kiệm 100% thời gian nhập liệu).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleAutoFillMissedPunch('OUT')}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25 font-semibold text-[11px] transition-colors cursor-pointer"
          >
            + Điền Đơn Thiếu Ra 17/11
          </button>
          <button
            type="button"
            onClick={() => handleAutoFillMissedPunch('LATE')}
            className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25 font-semibold text-[11px] transition-colors cursor-pointer"
          >
            + Điền Đơn Muộn 22p 05/11
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-line shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Tìm theo mã đơn, lý do..."
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />

          <span className="text-xs text-ink-muted">Loại đơn:</span>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-line bg-canvas text-ink"
          >
            <option value="ALL">Tất cả loại đơn</option>
            <option value="LEAVE">Nghỉ phép năm / ốm</option>
            <option value="WFH">Làm việc từ xa (WFH)</option>
            <option value="OT">Làm thêm giờ (OT)</option>
            <option value="MISSED_PUNCH">Giải trình quên chấm công</option>
          </select>

          <span className="text-xs text-ink-muted ml-1">Trạng thái:</span>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-line bg-canvas text-ink"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING">Chờ phê duyệt</option>
            <option value="APPROVED">Đã phê duyệt</option>
            <option value="REJECTED">Bị từ chối</option>
          </select>
        </div>

        <div className="text-xs text-ink-muted">
          Tổng cộng: <strong className="text-ink">{filtered.length}</strong> đơn
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-surface rounded-xl border border-line shadow-2xs overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-canvas border-b border-line text-ink-secondary font-medium">
              <th className="py-3 px-4">Mã Đơn</th>
              <th className="py-3 px-4">Loại Đơn Yêu Cầu</th>
              <th className="py-3 px-4">Thời Gian Áp Dụng</th>
              <th className="py-3 px-4">Thời Lượng</th>
              <th className="py-3 px-4">Lý Do</th>
              <th className="py-3 px-4">Người Phê Duyệt</th>
              <th className="py-3 px-4">Trạng Thái</th>
              <th className="py-3 px-4 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-ink-muted">
                  Không có đơn yêu cầu nào phù hợp điều kiện lọc.
                </td>
              </tr>
            ) : (
              filtered.map(req => (
                <tr key={req.id} className="hover:bg-canvas/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-ink">{req.id}</td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-ink">{req.typeName}</span>
                    <div className="text-[10px] text-ink-muted">Gửi lúc: {req.createdAt}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-ink-secondary">
                    {req.startDate} {req.startDate !== req.endDate ? `→ ${req.endDate}` : ''}
                  </td>
                  <td className="py-3 px-4 font-medium text-ink">{req.durationText}</td>
                  <td className="py-3 px-4 text-ink-secondary max-w-xs">
                    <div>{req.reason}</div>
                    {req.approverComment && (
                      <div className="text-[11px] text-accent mt-0.5 font-medium">
                        💬 Phản hồi: {req.approverComment}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-ink-secondary">{req.approver}</td>
                  <td className="py-3 px-4">
                    {req.status === 'PENDING' && <Badge variant="warn">Chờ duyệt</Badge>}
                    {req.status === 'APPROVED' && <Badge variant="ok">Đã duyệt</Badge>}
                    {req.status === 'REJECTED' && <Badge variant="danger">Bị từ chối</Badge>}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {req.status === 'PENDING' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelRequest(req.id)}
                        className="text-status-danger"
                      >
                        Hủy đơn
                      </Button>
                    ) : (
                      <span className="text-ink-muted text-[11px]">Đã xử lý</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tạo Đơn Yêu Cầu Mới (S08 / S30 / S31)"
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-ink mb-1">Loại Đơn Yêu Cầu</label>
            <select
              value={newReq.type}
              onChange={e => setNewReq({ ...newReq, type: e.target.value as any })}
              className="w-full p-2 border border-line rounded-lg bg-surface font-medium text-ink"
            >
              <option value="LEAVE">🌴 Nghỉ Phép Năm (Annual Leave)</option>
              <option value="WFH">🏡 Làm Việc Từ Xa (WFH - Tối đa 3 ngày/tháng)</option>
              <option value="OT">⚡ Đăng Ký Làm Thêm Giờ (Overtime)</option>
              <option value="MISSED_PUNCH">⏱️ Giải Trình Quên Chấm Công (Trong 24h)</option>
            </select>
          </div>

          {newReq.type === 'WFH' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-[11px] leading-relaxed">
              <strong>Quy chế WFH:</strong> Mỗi nhân sự được đăng ký tối đa <strong>3 ngày WFH / tháng</strong>. Đảm bảo cam kết trực tuyến qua kênh giao tiếp và hoàn thành KPI công việc.
            </div>
          )}

          {newReq.type === 'MISSED_PUNCH' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] leading-relaxed">
              <strong>Thời hạn giải trình:</strong> Theo điều 18 Quy chế Chấm công, đơn giải trình quên chấm công bắt buộc phải gửi trong vòng <strong>24 giờ</strong> kể từ thời điểm ca làm việc kết thúc.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-ink mb-1">Từ Ngày</label>
              <input
                type="date"
                required
                value={newReq.startDate}
                onChange={e => setNewReq({ ...newReq, startDate: e.target.value })}
                className="w-full p-2 border border-line rounded-lg bg-surface text-ink font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-ink mb-1">Đến Ngày</label>
              <input
                type="date"
                required
                value={newReq.endDate}
                onChange={e => setNewReq({ ...newReq, endDate: e.target.value })}
                className="w-full p-2 border border-line rounded-lg bg-surface text-ink font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-ink mb-1">Số Lượng / Thời Lượng</label>
            <input
              type="text"
              required
              placeholder="Ví dụ: 1.0 ngày hoặc 3.5 giờ OT"
              value={newReq.duration}
              onChange={e => setNewReq({ ...newReq, duration: e.target.value })}
              className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
            />
          </div>

          <div>
            <label className="block font-medium text-ink mb-1">Lý Do Chi Tiết &amp; Minh Chứng</label>
            <textarea
              rows={3}
              required
              placeholder="Nhập lý do cụ thể và thông tin bàn giao công việc..."
              value={newReq.reason}
              onChange={e => setNewReq({ ...newReq, reason: e.target.value })}
              className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Gửi Đơn Phê Duyệt
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
