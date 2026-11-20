import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';

type GroupKey = 'BUSINESS' | 'PEOPLE';

interface OkrItem {
  id: string;
  group: GroupKey;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  deleted?: boolean;
  deleteReason?: string;
}

const STORAGE_KEY = 'pulse_okr_items_v2';

const INITIAL_ITEMS: OkrItem[] = [
  { id: 'B1', group: 'BUSINESS', title: 'Giảm P99 API latency chấm công xuống dưới 80ms', targetValue: 80, currentValue: 75, unit: 'ms' },
  { id: 'B2', group: 'BUSINESS', title: 'Hoàn thiện bảng công 53 cột khớp file HR', targetValue: 100, currentValue: 90, unit: '%' },
  { id: 'P1', group: 'PEOPLE', title: 'Tổ chức 3 buổi tech sharing về AI Face Recognition', targetValue: 3, currentValue: 2, unit: 'buổi' },
  { id: 'P2', group: 'PEOPLE', title: 'Hoàn thành chứng chỉ AWS Solutions Architect', targetValue: 1, currentValue: 0.5, unit: 'chứng chỉ' },
];

const GROUP_LABEL: Record<GroupKey, string> = {
  BUSINESS: 'Business — mục tiêu kinh doanh / dự án',
  PEOPLE: 'People — phát triển con người & đội ngũ',
};

export const MyOKRPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<OkrItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return INITIAL_ITEMS;
  });
  const [toast, setToast] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [checkInItem, setCheckInItem] = useState<OkrItem | null>(null);
  const [checkInValue, setCheckInValue] = useState(0);
  const [checkInNote, setCheckInNote] = useState('');
  const [form, setForm] = useState({ group: 'BUSINESS' as GroupKey, title: '', targetValue: 100, unit: '%' });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const activeItems = items.filter((i) => !i.deleted);

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const item: OkrItem = {
      id: `${form.group[0]}-${Date.now()}`,
      group: form.group,
      title: form.title.trim(),
      targetValue: form.targetValue,
      currentValue: 0,
      unit: form.unit.trim() || '%',
    };
    setItems((prev) => [...prev, item]);
    setIsAddOpen(false);
    setForm({ group: 'BUSINESS', title: '', targetValue: 100, unit: '%' });
    showToast('Đã thêm đầu việc OKR');
  };

  const removeItem = (item: OkrItem) => {
    const reason = window.prompt(`Lý do xoá "${item.title}"? (bắt buộc)`, '');
    if (!reason || !reason.trim()) return;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, deleted: true, deleteReason: reason.trim() } : i)));
    showToast('Đã xoá mềm — mục vẫn còn trong lịch sử');
  };

  const openCheckIn = (item: OkrItem) => {
    setCheckInItem(item);
    setCheckInValue(item.currentValue);
    setCheckInNote('');
  };

  const saveCheckIn = () => {
    if (!checkInItem) return;
    setItems((prev) => prev.map((i) => (i.id === checkInItem.id ? { ...i, currentValue: checkInValue } : i)));
    setCheckInItem(null);
    showToast('Đã lưu check-in — chỉ cập nhật giá trị');
  };

  const progress = (item: OkrItem) => {
    if (!item.targetValue) return 0;
    return Math.min(100, Math.round((item.currentValue / item.targetValue) * 100));
  };

  const renderGroup = (group: GroupKey) => {
    const groupItems = activeItems.filter((i) => i.group === group);
    return (
      <div className="bg-surface border border-line rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-ink">{GROUP_LABEL[group]}</h2>
            <div className="text-xs text-ink-muted mt-0.5">{groupItems.length} đầu việc · tự do, không giới hạn</div>
          </div>
          <button
            type="button"
            className="text-xs px-3 py-1.5 rounded border border-line"
            onClick={() => {
              setForm((f) => ({ ...f, group }));
              setIsAddOpen(true);
            }}
          >
            + Thêm đầu việc
          </button>
        </div>
        {groupItems.length === 0 && <div className="text-xs text-ink-muted py-4 text-center">Chưa có đầu việc — thêm để bắt đầu.</div>}
        {groupItems.map((item) => (
          <div key={item.id} className="border border-line rounded-lg p-3 mb-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink">{item.title}</div>
                <div className="text-xs text-ink-muted mt-1 font-mono">
                  {item.currentValue} / {item.targetValue} {item.unit} ({progress(item)}%)
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button className="text-xs px-2 py-1 rounded bg-accent text-white" onClick={() => openCheckIn(item)}>Check-in</button>
                <button className="text-xs px-2 py-1 rounded border border-line" onClick={() => removeItem(item)}>Xoá</button>
              </div>
            </div>
            <div className="mt-2 h-1.5 bg-line rounded-full overflow-hidden">
              <div className="h-full bg-accent" style={{ width: `${progress(item)}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {toast && <div className="fixed top-16 right-6 z-50 bg-emerald-700 text-white px-4 py-2 rounded text-xs font-semibold">{toast}</div>}
      <div className="bg-canvas border border-line rounded-xl p-6">
        <h1 className="text-xl font-bold text-ink mt-1">Thiết lập & Check-in OKR</h1>
        <p className="text-xs text-ink-muted mt-1">
          {user?.fullName || 'Nhân viên'} · 2 nhóm Business / People · đầu việc tự do · <b>chỉ nhập giá trị</b>, không có trọng số hay confidence.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 text-[11px] px-2.5 py-1 rounded bg-accent-soft text-accent border border-accent-line">
          Điểm nhóm (1–5) do quản lý chấm ở bước đánh giá — không xếp loại A/B/C/D
        </div>
      </div>

      {renderGroup('BUSINESS')}
      {renderGroup('PEOPLE')}

      {isAddOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4" onClick={() => setIsAddOpen(false)}>
          <form className="bg-surface rounded-xl p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()} onSubmit={addItem}>
            <h3 className="text-base font-bold">Thêm đầu việc</h3>
            <select className="w-full border border-line rounded-lg p-2 text-sm" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value as GroupKey })}>
              <option value="BUSINESS">Business</option>
              <option value="PEOPLE">People</option>
            </select>
            <input className="w-full border border-line rounded-lg p-2 text-sm" placeholder="Tên đầu việc" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" className="w-full border border-line rounded-lg p-2 text-sm" value={form.targetValue} onChange={(e) => setForm({ ...form, targetValue: parseFloat(e.target.value) || 0 })} />
              <input className="w-full border border-line rounded-lg p-2 text-sm" placeholder="Đơn vị" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="text-xs px-3 py-1.5 rounded border border-line" onClick={() => setIsAddOpen(false)}>Huỷ</button>
              <button type="submit" className="text-xs px-3 py-1.5 rounded bg-accent text-white">Thêm</button>
            </div>
          </form>
        </div>
      )}

      {/* S22 · Check-in tiến độ — mở form là có sẵn giá trị kỳ trước, chỉ nhập giá trị mới */}
      {checkInItem && (
        <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4" onClick={() => setCheckInItem(null)}>
          <div className="bg-surface rounded-xl p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold">Check-in: {checkInItem.title}</h3>
            <div className="text-xs text-ink-muted">Kỳ trước: {checkInItem.currentValue} {checkInItem.unit} · mục tiêu {checkInItem.targetValue} {checkInItem.unit}</div>
            <label className="block text-xs font-semibold">Giá trị hiện tại</label>
            <input type="number" className="w-full border border-line rounded-lg p-2 text-sm" value={checkInValue} onChange={(e) => setCheckInValue(parseFloat(e.target.value) || 0)} />
            <textarea className="w-full border border-line rounded-lg p-2 text-sm" rows={3} placeholder="Ghi chú (không bắt buộc)" value={checkInNote} onChange={(e) => setCheckInNote(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button className="text-xs px-3 py-1.5 rounded border border-line" onClick={() => setCheckInItem(null)}>Huỷ</button>
              <button className="text-xs px-3 py-1.5 rounded bg-accent text-white" onClick={saveCheckIn}>Lưu check-in</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
