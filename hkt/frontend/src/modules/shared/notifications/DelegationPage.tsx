import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { useAuth } from '../../../context/AuthContext';

export interface Delegation {
  id: string;
  delegatorName: string;
  delegateeName: string;
  delegateeEmail: string;
  startDate: string;
  endDate: string;
  scope: string[];
  reason: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
}

const INITIAL_DELEGATIONS: Delegation[] = [
  {
    id: 'DEL-2026-001',
    delegatorName: 'Phạm Minh Tuấn (Lead Sirius)',
    delegateeName: 'Lê Hải Đăng (Senior Core Eng)',
    delegateeEmail: 'dang.lh@actvn.edu.vn',
    startDate: '2026-11-19',
    endDate: '2026-11-23',
    scope: ['Duyệt đơn nghỉ phép', 'Duyệt giải trình chấm công', 'Duyệt làm thêm giờ (OT)'],
    reason: 'Tham dự hội thảo công nghệ TechExpo tại Singapore',
    status: 'ACTIVE'
  },
  {
    id: 'DEL-2026-002',
    delegatorName: 'Hoàng Anh Dũng (Lead Optimus)',
    delegateeName: 'Trịnh Lan Hương (Data Eng Lead)',
    delegateeEmail: 'huong.tl@actvn.edu.vn',
    startDate: '2026-11-01',
    endDate: '2026-11-05',
    scope: ['Duyệt đơn nghỉ phép'],
    reason: 'Nghỉ phép gia đình',
    status: 'EXPIRED'
  }
];

export const DelegationPage: React.FC = () => {
  const { user } = useAuth();
  const [delegations, setDelegations] = useState<Delegation[]>(INITIAL_DELEGATIONS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [newDel, setNewDel] = useState({
    delegateeName: '',
    delegateeEmail: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: '',
    scopeLeave: true,
    scopeOT: true,
    scopeOKR: false
  });

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDel.delegateeName.trim() || !newDel.delegateeEmail.trim()) return;

    const scopes: string[] = [];
    if (newDel.scopeLeave) scopes.push('Duyệt đơn nghỉ phép');
    if (newDel.scopeOT) scopes.push('Duyệt làm thêm giờ (OT)');
    if (newDel.scopeOKR) scopes.push('Duyệt mục tiêu OKR');

    const created: Delegation = {
      id: `DEL-2026-00${delegations.length + 1}`,
      delegatorName: `${user?.fullName || 'Manager'} (${user?.team || 'Quản lý'})`,
      delegateeName: newDel.delegateeName.trim(),
      delegateeEmail: newDel.delegateeEmail.trim(),
      startDate: newDel.startDate,
      endDate: newDel.endDate,
      scope: scopes.length > 0 ? scopes : ['Duyệt đơn nghỉ phép'],
      reason: newDel.reason || 'Công tác xa',
      status: 'ACTIVE'
    };

    setDelegations([created, ...delegations]);
    setIsCreateOpen(false);
    showToast(`Đã thiết lập ủy quyền cho ${created.delegateeName} thành công`);
  };

  const handleRevoke = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn thu hồi quyền ủy quyền này trước thời hạn?')) {
      setDelegations(delegations.map(d => (d.id === id ? { ...d, status: 'REVOKED' } : d)));
      showToast('Đã thu hồi giấy ủy quyền');
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Xóa bản ghi ủy quyền này?')) {
      setDelegations(delegations.filter(d => d.id !== id));
      showToast('Đã xóa bản ghi ủy quyền');
    }
  };

  const filteredDelegations = delegations.filter(d => {
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match =
        d.delegatorName.toLowerCase().includes(q) ||
        d.delegateeName.toLowerCase().includes(q) ||
        d.delegateeEmail.toLowerCase().includes(q) ||
        d.reason.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q);
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
            <h1 className="text-xl font-bold tracking-tight text-ink">Ủy Quyền Phê Duyệt Tạm Thời</h1>
            <Badge variant="accent">S37</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Thiết lập chuyển giao quyền duyệt đơn từ hoặc đánh giá OKR cho nhân sự cấp phó trong thời gian quản lý đi công tác hoặc nghỉ phép
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
            + Tạo Giấy Ủy Quyền Mới
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-line shadow-2xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Tìm theo người ủy quyền, người nhận, lý do..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:ring-1 focus:ring-accent w-full sm:w-72"
          />

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-line bg-canvas text-ink"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hiệu lực (ACTIVE)</option>
            <option value="EXPIRED">Hết hạn (EXPIRED)</option>
            <option value="REVOKED">Đã thu hồi (REVOKED)</option>
          </select>
        </div>

        <div className="text-xs text-ink-muted">
          Tổng cộng: <strong className="text-ink">{filteredDelegations.length}</strong> giấy ủy quyền
        </div>
      </div>

      {/* Delegations Table */}
      <div className="bg-surface rounded-xl border border-line shadow-2xs overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-canvas border-b border-line text-ink-secondary font-medium">
              <th className="py-3 px-4">Mã Số</th>
              <th className="py-3 px-4">Người Ủy Quyền (Delegator)</th>
              <th className="py-3 px-4">Người Nhận Ủy Quyền (Delegatee)</th>
              <th className="py-3 px-4">Thời Hạn</th>
              <th className="py-3 px-4">Phạm Vi Quyền Hạn</th>
              <th className="py-3 px-4">Lý Do</th>
              <th className="py-3 px-4">Trạng Thái</th>
              <th className="py-3 px-4 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredDelegations.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-ink-muted">
                  Không tìm thấy giấy ủy quyền nào phù hợp.
                </td>
              </tr>
            ) : (
              filteredDelegations.map(del => (
                <tr key={del.id} className="hover:bg-canvas/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-ink">{del.id}</td>
                  <td className="py-3 px-4 font-semibold text-ink">{del.delegatorName}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-ink">{del.delegateeName}</div>
                    <div className="text-[11px] text-ink-muted font-mono">{del.delegateeEmail}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-ink-secondary">
                    {del.startDate} → {del.endDate}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {del.scope.map((s, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 bg-canvas rounded border border-line text-[10px] text-ink">
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-ink-secondary max-w-xs">{del.reason}</td>
                  <td className="py-3 px-4">
                    {del.status === 'ACTIVE' && <Badge variant="ok">Đang hiệu lực</Badge>}
                    {del.status === 'EXPIRED' && <Badge variant="gray">Hết hiệu lực</Badge>}
                    {del.status === 'REVOKED' && <Badge variant="danger">Đã thu hồi</Badge>}
                  </td>
                  <td className="py-3 px-4 text-right space-x-1">
                    {del.status === 'ACTIVE' && (
                      <Button variant="ghost" size="sm" onClick={() => handleRevoke(del.id)} className="text-status-danger">
                        Thu hồi
                      </Button>
                    )}
                    <button
                      onClick={() => handleDelete(del.id)}
                      className="p-1 text-xs text-ink-muted hover:text-status-danger rounded"
                      title="Xóa bản ghi"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Tạo ủy quyền */}
      {isCreateOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsCreateOpen(false)}
          title="Tạo Giấy Ủy Quyền Phê Duyệt Tạm Thời (S37)"
          maxWidth="md"
        >
          <form onSubmit={handleCreate} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-ink mb-1">Họ tên Người nhận ủy quyền *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Lê Hải Đăng"
                  value={newDel.delegateeName}
                  onChange={e => setNewDel({ ...newDel, delegateeName: e.target.value })}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
                />
              </div>
              <div>
                <label className="block font-medium text-ink mb-1">Email Người nhận ủy quyền *</label>
                <input
                  type="email"
                  required
                  placeholder="dang.lh@act-corp.internal"
                  value={newDel.delegateeEmail}
                  onChange={e => setNewDel({ ...newDel, delegateeEmail: e.target.value })}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-ink mb-1">Từ ngày</label>
                <input
                  type="date"
                  required
                  value={newDel.startDate}
                  onChange={e => setNewDel({ ...newDel, startDate: e.target.value })}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-ink mb-1">Đến ngày</label>
                <input
                  type="date"
                  required
                  value={newDel.endDate}
                  onChange={e => setNewDel({ ...newDel, endDate: e.target.value })}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-ink mb-1">Phạm vi ủy quyền</label>
              <div className="space-y-2 p-3 bg-canvas rounded-lg border border-line">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newDel.scopeLeave}
                    onChange={e => setNewDel({ ...newDel, scopeLeave: e.target.checked })}
                    className="rounded text-accent focus:ring-accent"
                  />
                  <span>Duyệt đơn xin nghỉ phép (Nghỉ ốm, phép năm, việc riêng)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newDel.scopeOT}
                    onChange={e => setNewDel({ ...newDel, scopeOT: e.target.checked })}
                    className="rounded text-accent focus:ring-accent"
                  />
                  <span>Duyệt đơn đăng ký làm thêm giờ (OT) &amp; WFH</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newDel.scopeOKR}
                    onChange={e => setNewDel({ ...newDel, scopeOKR: e.target.checked })}
                    className="rounded text-accent focus:ring-accent"
                  />
                  <span>Duyệt báo cáo Check-In mục tiêu OKR tuần</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block font-medium text-ink mb-1">Lý do ủy quyền</label>
              <textarea
                rows={2}
                required
                placeholder="Nhập lý do (VD: Đi công tác nước ngoài từ ngày...)"
                value={newDel.reason}
                onChange={e => setNewDel({ ...newDel, reason: e.target.value })}
                className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
                Hủy
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Kích Hoạt Ủy Quyền
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
