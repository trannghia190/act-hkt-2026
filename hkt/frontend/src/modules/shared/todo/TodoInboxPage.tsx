import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';

interface TodoItem {
  id: string;
  category: 'attendance' | 'okr' | 'system';
  priority: 'red' | 'yellow' | 'green';
  title: string;
  subtitle: string;
  requester: string;
  dept: string;
  submittedAt: string;
  badgeText: string;
  details?: Record<string, string>;
}

export const TodoInboxPage: React.FC = () => {
  const [filterPriority, setFilterPriority] = useState<'all' | 'red' | 'yellow' | 'green'>('all');
  const [selectedItem, setSelectedItem] = useState<TodoItem | null>(null);
  const [activeActionModal, setActiveActionModal] = useState<'approve' | 'reject' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [items, setItems] = useState<TodoItem[]>([
    {
      id: 'REQ-2026-0042',
      category: 'attendance',
      priority: 'red',
      title: 'Đơn xin nghỉ phép đột xuất (Fever/Sick)',
      subtitle: 'Nghỉ 1.5 ngày từ 18/11 đến hết sáng 19/11/2026',
      requester: 'Nguyễn Văn Minh (ACT0142)',
      dept: 'Trung tâm Công nghệ · Nhóm Sirius',
      submittedAt: '18/11/2026 07:45 (Cách đây 15 phút)',
      badgeText: 'Khẩn cấp / Trong ngày',
      details: {
        'Loại nghỉ': 'Nghỉ ốm hưởng BHXH (Sick Leave)',
        'Số ngày trừ phép': '0 ngày (Có giấy chứng nhận khám bệnh)',
        'Người bàn giao': 'Lê Hải Đăng (Sirius Core)',
        'Lý do chi tiết': 'Sốt cao 38.5 độ C sáng nay, đi khám tại BV Hồng Ngọc'
      }
    },
    {
      id: 'REQ-2026-0039',
      category: 'attendance',
      priority: 'red',
      title: 'Yêu cầu giải trình Quên chấm công (Missed Check-in)',
      subtitle: 'Ca sáng ngày 17/11/2026 lúc 08:32',
      requester: 'Trần Thị Thu Thảo (ACT0089)',
      dept: 'Khối Kinh Doanh & Tiếp Thị · Nhóm Mobile App',
      submittedAt: '17/11/2026 18:05 (Gần chạm hạn 24h)',
      badgeText: 'Hạn chót giải trình: 18/11 12:00',
      details: {
        'Loại giải trình': 'Quên Check-in ca sáng (Chỉ có log Check-out 18:15)',
        'Bằng chứng': 'Lịch sử log git commit lúc 08:35 và xác nhận của Lead',
        'Số lần đã giải trình trong tháng': '1 / 3 lần tối đa'
      }
    },
    {
      id: 'REQ-2026-0028',
      category: 'okr',
      priority: 'yellow',
      title: 'Phê duyệt Mục tiêu OKR Quý 4/2026',
      subtitle: '3 Objectives · 7 Key Results (Trọng số 100%)',
      requester: 'Hoàng Anh Dũng (ACT0055)',
      dept: 'Trung tâm Công nghệ · Nhóm Optimus',
      submittedAt: '16/11/2026 14:20 (Chờ duyệt 2 ngày)',
      badgeText: 'Hạn duyệt quý: 20/11/2026',
      details: {
        'Mục tiêu 1': 'Tối ưu hóa Core Engine giảm latency P99 xuống < 80ms (40%)',
        'Mục tiêu 2': 'Triển khai bảo mật Keycloak RBAC hoàn tất 100% (35%)',
        'Mục tiêu 3': 'Hoàn thành chứng chỉ Certified Kubernetes Administrator (25%)'
      }
    },
    {
      id: 'REQ-2026-0015',
      category: 'attendance',
      priority: 'green',
      title: 'Đăng ký làm thêm giờ (Overtime - OT)',
      subtitle: 'Kế hoạch OT 3 tiếng ngày thứ 7 (21/11/2026)',
      requester: 'Vũ Quốc Toàn (ACT0112)',
      dept: 'Khối Hạ Tầng & Bảo Mật · DevOps Team',
      submittedAt: '15/11/2026 10:12',
      badgeText: 'Kế hoạch tuần tới',
      details: {
        'Thời gian': '09:00 - 12:00 Ngày 21/11/2026 (Thứ 7)',
        'Mục tiêu công việc': 'Bảo trì định kỳ cụm PostgreSQL Cluster và Keycloak v24'
      }
    }
  ]);

  const filteredItems = items.filter(item => {
    if (filterPriority === 'all') return true;
    return item.priority === filterPriority;
  });

  const redCount = items.filter(i => i.priority === 'red').length;
  const yellowCount = items.filter(i => i.priority === 'yellow').length;
  const greenCount = items.filter(i => i.priority === 'green').length;

  const handleAction = (status: 'approved' | 'rejected') => {
    if (!selectedItem) return;
    setItems(prev => prev.filter(i => i.id !== selectedItem.id));
    setActiveActionModal(null);
    setSelectedItem(null);
    setActionReason('');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Hộp Việc Cần Xử Lý (Todo Inbox)</h1>
            <Badge variant="accent">S02</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Trung tâm điều hướng tập trung các nhiệm vụ phê duyệt đơn từ, giải trình chấm công và rà soát OKR theo 3 mức độ ưu tiên
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Làm mới (F5)
          </Button>
          <Button variant="primary" size="sm">
            Duyệt nhanh tất cả mục xanh
          </Button>
        </div>
      </div>

      {/* Priority Filters Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => setFilterPriority('all')}
          className={`p-4 rounded-xl border text-left transition-all ${
            filterPriority === 'all'
              ? 'bg-canvas border-accent shadow-xs'
              : 'bg-surface border-line hover:border-line-focus'
          }`}
        >
          <div className="text-xs font-medium text-ink-secondary">Tất cả nhiệm vụ</div>
          <div className="text-2xl font-bold text-ink mt-1">{items.length}</div>
          <div className="text-[11px] text-ink-muted mt-1">Tổng việc đang tồn đọng</div>
        </button>

        <button
          onClick={() => setFilterPriority('red')}
          className={`p-4 rounded-xl border text-left transition-all ${
            filterPriority === 'red'
              ? 'bg-rose-50/60 border-rose-400 shadow-xs'
              : 'bg-surface border-line hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700">Khẩn cấp (Red Bucket)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          </div>
          <div className="text-2xl font-bold text-rose-800 mt-1">{redCount}</div>
          <div className="text-[11px] text-rose-600 mt-1">&lt; 24h hoặc liên quan ca làm hôm nay</div>
        </button>

        <button
          onClick={() => setFilterPriority('yellow')}
          className={`p-4 rounded-xl border text-left transition-all ${
            filterPriority === 'yellow'
              ? 'bg-amber-50/60 border-amber-400 shadow-xs'
              : 'bg-surface border-line hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700">Cần làm sớm (Yellow)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-800 mt-1">{yellowCount}</div>
          <div className="text-[11px] text-amber-600 mt-1">Hạn 1 - 3 ngày tới (OKR / Đơn tuần)</div>
        </button>

        <button
          onClick={() => setFilterPriority('green')}
          className={`p-4 rounded-xl border text-left transition-all ${
            filterPriority === 'green'
              ? 'bg-emerald-50/60 border-emerald-400 shadow-xs'
              : 'bg-surface border-line hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700">Theo lịch (Green)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-800 mt-1">{greenCount}</div>
          <div className="text-[11px] text-emerald-600 mt-1">Kế hoạch dài hạn &gt; 3 ngày</div>
        </button>
      </div>

      {/* Todo List */}
      <Card title={`Danh sách việc cần duyệt (${filteredItems.length})`}>
        {filteredItems.length === 0 ? (
          <div className="py-12 text-center text-ink-muted text-xs">
            🎉 Bạn đã xử lý hết mọi công việc trong hòm thư!
          </div>
        ) : (
          <div className="divide-y divide-line">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-canvas/40 px-2 rounded-lg transition-colors cursor-pointer"
                onClick={() => setSelectedItem(item)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {item.priority === 'red' && <span className="inline-block w-3 h-3 rounded-full bg-rose-500 shadow-xs" />}
                    {item.priority === 'yellow' && <span className="inline-block w-3 h-3 rounded-full bg-amber-500 shadow-xs" />}
                    {item.priority === 'green' && <span className="inline-block w-3 h-3 rounded-full bg-emerald-500 shadow-xs" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-ink">{item.title}</span>
                      <Badge variant={item.priority === 'red' ? 'danger' : item.priority === 'yellow' ? 'warn' : 'ok'}>
                        {item.badgeText}
                      </Badge>
                      <span className="text-[11px] font-mono text-ink-muted">#{item.id}</span>
                    </div>
                    <div className="text-xs text-ink-secondary mt-1">{item.subtitle}</div>
                    <div className="flex items-center gap-4 text-[11px] text-ink-muted mt-1.5">
                      <span>👤 {item.requester}</span>
                      <span>🏢 {item.dept}</span>
                      <span>⏱️ {item.submittedAt}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center" onClick={e => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedItem(item);
                      setActiveActionModal('reject');
                    }}
                  >
                    Từ chối
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSelectedItem(item);
                      setActiveActionModal('approve');
                    }}
                  >
                    Phê duyệt
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Item Detail Modal */}
      {selectedItem && !activeActionModal && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedItem(null)}
          title={`Chi tiết đơn: ${selectedItem.id}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div>
              <div className="text-xs text-ink-muted uppercase tracking-wider font-semibold">Tiêu đề yêu cầu</div>
              <div className="text-sm font-semibold text-ink mt-0.5">{selectedItem.title}</div>
              <div className="text-xs text-ink-secondary mt-1">{selectedItem.subtitle}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-canvas rounded-lg text-xs">
              <div>
                <span className="text-ink-muted">Người làm đơn:</span>
                <div className="font-medium text-ink mt-0.5">{selectedItem.requester}</div>
              </div>
              <div>
                <span className="text-ink-muted">Phòng ban / Nhóm:</span>
                <div className="font-medium text-ink mt-0.5">{selectedItem.dept}</div>
              </div>
              <div>
                <span className="text-ink-muted">Thời điểm gửi:</span>
                <div className="font-medium text-ink mt-0.5">{selectedItem.submittedAt}</div>
              </div>
              <div>
                <span className="text-ink-muted">Mức độ ưu tiên:</span>
                <div className="mt-0.5">
                  <Badge variant={selectedItem.priority === 'red' ? 'danger' : selectedItem.priority === 'yellow' ? 'warn' : 'ok'}>
                    {selectedItem.badgeText}
                  </Badge>
                </div>
              </div>
            </div>

            {selectedItem.details && (
              <div className="space-y-2 border-t border-line pt-3">
                <div className="text-xs font-semibold text-ink">Nội dung chi tiết &amp; Minh chứng</div>
                <div className="space-y-1.5">
                  {Object.entries(selectedItem.details).map(([k, v]) => (
                    <div key={k} className="text-xs flex gap-2">
                      <span className="text-ink-muted min-w-[140px]">• {k}:</span>
                      <span className="text-ink font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-line pt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedItem(null)}>
                Đóng
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setActiveActionModal('reject')}
              >
                Từ chối
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setActiveActionModal('approve')}
              >
                Duyệt đơn
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Action Confirmation Modal */}
      {activeActionModal && selectedItem && (
        <Modal
          isOpen={true}
          onClose={() => setActiveActionModal(null)}
          title={activeActionModal === 'approve' ? 'Xác nhận phê duyệt đơn' : 'Từ chối đơn yêu cầu'}
          maxWidth="md"
        >
          <div className="space-y-4">
            <p className="text-xs text-ink-secondary">
              Bạn đang thực hiện thao tác <strong className={activeActionModal === 'approve' ? 'text-emerald-700' : 'text-rose-700'}>
                {activeActionModal === 'approve' ? 'ĐỒNG Ý PHÊ DUYỆT' : 'TỪ CHỐI'}
              </strong> cho đơn <strong>#{selectedItem.id}</strong> của nhân viên <strong>{selectedItem.requester}</strong>.
            </p>

            <div>
              <label className="block text-xs font-medium text-ink mb-1">
                Ý kiến phê duyệt / Lý do từ chối {activeActionModal === 'reject' && <span className="text-rose-500">*</span>}
              </label>
              <textarea
                value={actionReason}
                onChange={e => setActionReason(e.target.value)}
                placeholder={activeActionModal === 'approve' ? 'Đồng ý duyệt theo quy định...' : 'Nhập lý do từ chối để nhân viên bổ sung minh chứng...'}
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-canvas focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setActiveActionModal(null)}>
                Hủy bỏ
              </Button>
              <Button
                variant={activeActionModal === 'approve' ? 'primary' : 'danger'}
                size="sm"
                onClick={() => handleAction(activeActionModal === 'approve' ? 'approved' : 'rejected')}
                disabled={activeActionModal === 'reject' && !actionReason.trim()}
              >
                {activeActionModal === 'approve' ? 'Xác nhận Duyệt' : 'Xác nhận Từ chối'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
