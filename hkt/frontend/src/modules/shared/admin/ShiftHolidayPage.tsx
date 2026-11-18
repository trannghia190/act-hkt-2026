import React, { useState, useEffect } from 'react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { useAuth } from '../../../context/AuthContext';

export interface ShiftConfig {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  standardWorkHours: number;
  paidHours: number;
  gracePeriodMinutes: number;
  targetGroup: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface HolidayConfig {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  type: 'PUBLIC_HOLIDAY' | 'COMPENSATION_DAY';
  isPaid: boolean;
}

const INITIAL_SHIFTS: ShiftConfig[] = [
  {
    id: 'SHIFT_STANDARD',
    name: 'Ca Làm Việc Chuẩn 8 Giờ (Standard Shift)',
    startTime: '08:30',
    endTime: '17:30',
    breakStart: '12:00',
    breakEnd: '13:00',
    standardWorkHours: 8,
    paidHours: 8,
    gracePeriodMinutes: 15,
    targetGroup: 'Toàn bộ nhân viên chính thức & thử việc',
    status: 'ACTIVE'
  },
  {
    id: 'SHIFT_MATERNITY_EARLY',
    name: 'Ca Thai Sản / Con Nhỏ < 12 Tháng (Về sớm 1h)',
    startTime: '08:30',
    endTime: '16:30',
    breakStart: '12:00',
    breakEnd: '13:00',
    standardWorkHours: 7,
    paidHours: 8,
    gracePeriodMinutes: 15,
    targetGroup: 'Lao động nữ mang thai từ tháng thứ 7 hoặc nuôi con < 12 tháng',
    status: 'ACTIVE'
  },
  {
    id: 'SHIFT_MATERNITY_LATE',
    name: 'Ca Thai Sản / Con Nhỏ < 12 Tháng (Đi muộn 1h)',
    startTime: '09:30',
    endTime: '17:30',
    breakStart: '12:00',
    breakEnd: '13:00',
    standardWorkHours: 7,
    paidHours: 8,
    gracePeriodMinutes: 15,
    targetGroup: 'Lao động nữ mang thai hoặc nuôi con nhỏ đăng ký vào muộn',
    status: 'ACTIVE'
  }
];

const INITIAL_HOLIDAYS: HolidayConfig[] = [
  {
    id: 'H01',
    name: 'Tết Dương Lịch 2026',
    startDate: '2026-01-01',
    endDate: '2026-01-01',
    totalDays: 1,
    type: 'PUBLIC_HOLIDAY',
    isPaid: true
  },
  {
    id: 'H02',
    name: 'Tết Nguyên Đán Bính Ngọ 2026',
    startDate: '2026-02-16',
    endDate: '2026-02-22',
    totalDays: 7,
    type: 'PUBLIC_HOLIDAY',
    isPaid: true
  },
  {
    id: 'H03',
    name: 'Giỗ Tổ Hùng Vương (10/3 Âm Lịch)',
    startDate: '2026-04-26',
    endDate: '2026-04-26',
    totalDays: 1,
    type: 'PUBLIC_HOLIDAY',
    isPaid: true
  },
  {
    id: 'H04',
    name: 'Ngày Chiến Thắng 30/4 & Quốc Tế Lao Động 1/5',
    startDate: '2026-04-30',
    endDate: '2026-05-01',
    totalDays: 2,
    type: 'PUBLIC_HOLIDAY',
    isPaid: true
  },
  {
    id: 'H05',
    name: 'Quốc Khánh 02/09/2026',
    startDate: '2026-09-01',
    endDate: '2026-09-02',
    totalDays: 2,
    type: 'PUBLIC_HOLIDAY',
    isPaid: true
  }
];

const STORAGE_KEY_SHIFTS = 'pulse_shifts_config';
const STORAGE_KEY_HOLIDAYS = 'pulse_holidays_config';

export const ShiftHolidayPage: React.FC = () => {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'HR_ADMIN';

  const [activeTab, setActiveTab] = useState<'shifts' | 'holidays'>('shifts');
  const [searchTerm, setSearchTerm] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Shifts state
  const [shifts, setShifts] = useState<ShiftConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SHIFTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_SHIFTS;
  });

  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftConfig | null>(null);
  const [shiftForm, setShiftForm] = useState<ShiftConfig>({
    id: '',
    name: '',
    startTime: '08:30',
    endTime: '17:30',
    breakStart: '12:00',
    breakEnd: '13:00',
    standardWorkHours: 8,
    paidHours: 8,
    gracePeriodMinutes: 15,
    targetGroup: 'Nhân viên văn phòng',
    status: 'ACTIVE'
  });

  // Holidays state
  const [holidays, setHolidays] = useState<HolidayConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HOLIDAYS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_HOLIDAYS;
  });

  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<HolidayConfig | null>(null);
  const [holidayForm, setHolidayForm] = useState<HolidayConfig>({
    id: '',
    name: '',
    startDate: '2026-01-01',
    endDate: '2026-01-01',
    totalDays: 1,
    type: 'PUBLIC_HOLIDAY',
    isPaid: true
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SHIFTS, JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_HOLIDAYS, JSON.stringify(holidays));
  }, [holidays]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Shift Handlers
  const handleOpenAddShift = () => {
    const nextId = `SHIFT_${Date.now().toString().slice(-4)}`;
    setEditingShift(null);
    setShiftForm({
      id: nextId,
      name: '',
      startTime: '08:30',
      endTime: '17:30',
      breakStart: '12:00',
      breakEnd: '13:00',
      standardWorkHours: 8,
      paidHours: 8,
      gracePeriodMinutes: 15,
      targetGroup: '',
      status: 'ACTIVE'
    });
    setIsShiftModalOpen(true);
  };

  const handleOpenEditShift = (shift: ShiftConfig) => {
    setEditingShift(shift);
    setShiftForm({ ...shift });
    setIsShiftModalOpen(true);
  };

  const handleSaveShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftForm.name.trim()) return;

    if (editingShift) {
      setShifts(prev => prev.map(s => (s.id === editingShift.id ? shiftForm : s)));
      showToast(`Đã cập nhật ca làm việc "${shiftForm.name}" thành công`);
    } else {
      setShifts(prev => [...prev, shiftForm]);
      showToast(`Đã thêm ca làm việc "${shiftForm.name}" thành công`);
    }
    setIsShiftModalOpen(false);
  };

  const handleDeleteShift = (shiftId: string, shiftName: string) => {
    if (confirm(`Bạn có chắc muốn xóa ca làm việc "${shiftName}"?`)) {
      setShifts(prev => prev.filter(s => s.id !== shiftId));
      showToast(`Đã xóa ca làm việc "${shiftName}"`);
    }
  };

  // Holiday Handlers
  const handleOpenAddHoliday = () => {
    const nextId = `H${String(holidays.length + 1).padStart(2, '0')}`;
    setEditingHoliday(null);
    setHolidayForm({
      id: nextId,
      name: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      totalDays: 1,
      type: 'PUBLIC_HOLIDAY',
      isPaid: true
    });
    setIsHolidayModalOpen(true);
  };

  const handleOpenEditHoliday = (holiday: HolidayConfig) => {
    setEditingHoliday(holiday);
    setHolidayForm({ ...holiday });
    setIsHolidayModalOpen(true);
  };

  const handleSaveHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayForm.name.trim()) return;

    if (editingHoliday) {
      setHolidays(prev => prev.map(h => (h.id === editingHoliday.id ? holidayForm : h)));
      showToast(`Đã cập nhật ngày nghỉ lễ "${holidayForm.name}" thành công`);
    } else {
      setHolidays(prev => [...prev, holidayForm]);
      showToast(`Đã thêm ngày nghỉ lễ "${holidayForm.name}" thành công`);
    }
    setIsHolidayModalOpen(false);
  };

  const handleDeleteHoliday = (holidayId: string, holidayName: string) => {
    if (confirm(`Bạn có chắc muốn xóa ngày nghỉ lễ "${holidayName}"?`)) {
      setHolidays(prev => prev.filter(h => h.id !== holidayId));
      showToast(`Đã xóa ngày nghỉ lễ "${holidayName}"`);
    }
  };

  const handleResetToDefault = () => {
    if (confirm('Khôi phục danh mục ca làm việc và lịch nghỉ lễ về mặc định ban đầu?')) {
      setShifts(INITIAL_SHIFTS);
      setHolidays(INITIAL_HOLIDAYS);
      localStorage.removeItem(STORAGE_KEY_SHIFTS);
      localStorage.removeItem(STORAGE_KEY_HOLIDAYS);
      showToast('Đã khôi phục cấu hình ca & lễ mẫu thành công');
    }
  };

  const filteredShifts = shifts.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.targetGroup.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredHolidays = holidays.filter(h =>
    h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.startDate.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-16 right-6 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 animate-bounce">
          <span>✓</span>
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Cấu Hình Ca Làm Việc &amp; Lịch Nghỉ Lễ</h1>
            <Badge variant="accent">S26</Badge>
            {canManage ? (
              <Badge variant="ok">Chế độ Quản trị (Admin/HR)</Badge>
            ) : (
              <Badge variant="gray">Chế độ Xem (Read-only)</Badge>
            )}
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Thiết lập ca chuẩn 8h, chính sách ưu đãi thai sản 7h hưởng đủ 8h lương và niên lịch ngày nghỉ lễ quốc gia
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Tìm ca làm việc, ngày lễ..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-line bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {canManage && (
            <Button variant="outline" size="sm" onClick={handleResetToDefault}>
              Khôi phục mẫu
            </Button>
          )}
          {activeTab === 'shifts' ? (
            canManage && (
              <Button variant="primary" size="sm" onClick={handleOpenAddShift}>
                + Thêm Ca Làm Việc
              </Button>
            )
          ) : (
            canManage && (
              <Button variant="primary" size="sm" onClick={handleOpenAddHoliday}>
                + Thêm Ngày Nghỉ Lễ
              </Button>
            )
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <button
          onClick={() => setActiveTab('shifts')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${activeTab === 'shifts'
              ? 'bg-accent-soft text-accent border border-accent-line'
              : 'text-ink-secondary hover:text-ink'
            }`}
        >
          ⏰ Danh Mục Ca Làm Việc ({shifts.length})
        </button>
        <button
          onClick={() => setActiveTab('holidays')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${activeTab === 'holidays'
              ? 'bg-accent-soft text-accent border border-accent-line'
              : 'text-ink-secondary hover:text-ink'
            }`}
        >
          🌴 Niên Lịch Nghỉ Lễ ({holidays.length})
        </button>
      </div>

      {/* Tab Shifts Content */}
      {activeTab === 'shifts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredShifts.map(shift => (
              <div key={shift.id} className="bg-surface rounded-xl border border-line p-5 shadow-2xs space-y-3 relative group">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-xs text-ink">{shift.name}</h3>
                  <Badge variant={shift.status === 'ACTIVE' ? 'ok' : 'gray'}>
                    {shift.status === 'ACTIVE' ? 'Đang áp dụng' : 'Tạm dừng'}
                  </Badge>
                </div>

                <div className="p-3 bg-canvas rounded-lg space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Giờ làm việc:</span>
                    <strong className="font-mono text-ink">{shift.startTime} - {shift.endTime}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Nghỉ trưa:</span>
                    <span className="font-mono text-ink">{shift.breakStart} - {shift.breakEnd}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Giờ chuẩn thực tế:</span>
                    <span className="font-medium text-ink">{shift.standardWorkHours} giờ / ngày</span>
                  </div>
                  <div className="flex justify-between text-accent font-semibold">
                    <span>Số giờ tính công:</span>
                    <span>{shift.paidHours} giờ (Hưởng nguyên lương)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Dung sai cho phép:</span>
                    <span className="text-ink font-mono">±{shift.gracePeriodMinutes} phút</span>
                  </div>
                </div>

                <div className="text-[11px] text-ink-secondary">
                  <strong>Đối tượng:</strong> {shift.targetGroup || 'Chưa cấu hình đối tượng'}
                </div>

                {canManage && (
                  <div className="pt-2 border-t border-line flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenEditShift(shift)}>
                      Chỉnh sửa
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteShift(shift.id, shift.name)}
                      className="text-status-danger hover:border-status-danger"
                    >
                      Xóa
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Holidays Content */}
      {activeTab === 'holidays' && (
        <div className="bg-surface rounded-xl border border-line shadow-2xs overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas border-b border-line text-ink-secondary font-medium">
                <th className="py-3 px-4">Tên Kỳ Nghỉ Lễ</th>
                <th className="py-3 px-4">Từ Ngày</th>
                <th className="py-3 px-4">Đến Ngày</th>
                <th className="py-3 px-4">Số Ngày Nghỉ</th>
                <th className="py-3 px-4">Phân Loại</th>
                <th className="py-3 px-4">Hưởng Lương</th>
                {canManage && <th className="py-3 px-4 text-right">Thao Tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredHolidays.map(h => (
                <tr key={h.id} className="hover:bg-canvas/40 transition-colors">
                  <td className="py-3 px-4 font-semibold text-ink">{h.name}</td>
                  <td className="py-3 px-4 font-mono text-ink-secondary">{h.startDate}</td>
                  <td className="py-3 px-4 font-mono text-ink-secondary">{h.endDate}</td>
                  <td className="py-3 px-4 font-bold text-ink">{h.totalDays} ngày</td>
                  <td className="py-3 px-4">
                    <Badge variant={h.type === 'PUBLIC_HOLIDAY' ? 'accent' : 'gray'}>
                      {h.type === 'PUBLIC_HOLIDAY' ? 'Nghỉ Lễ Quốc Gia' : 'Nghỉ Bù'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    {h.isPaid ? (
                      <span className="text-emerald-700 font-semibold">✓ 100% Lương</span>
                    ) : (
                      <span className="text-ink-muted">Không hưởng lương</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditHoliday(h)}>
                          Sửa
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteHoliday(h.id, h.name)}
                          className="text-status-danger"
                        >
                          Xóa
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Thêm / Sửa Ca Làm Việc */}
      <Modal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        title={editingShift ? 'Chỉnh Sửa Ca Làm Việc' : 'Thêm Ca Làm Việc Mới'}
      >
        <form onSubmit={handleSaveShift} className="space-y-4 text-xs">
          <div>
            <label className="block text-ink-muted mb-1">Tên Ca Làm Việc</label>
            <input
              type="text"
              required
              value={shiftForm.name}
              onChange={e => setShiftForm({ ...shiftForm, name: e.target.value })}
              placeholder="VD: Ca Hành Chính Chuẩn (8h30 - 17h30)"
              className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-muted mb-1">Giờ Vào Ca</label>
              <input
                type="time"
                required
                value={shiftForm.startTime}
                onChange={e => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink font-mono"
              />
            </div>
            <div>
              <label className="block text-ink-muted mb-1">Giờ Hết Ca</label>
              <input
                type="time"
                required
                value={shiftForm.endTime}
                onChange={e => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-muted mb-1">Bắt Đầu Nghỉ Trưa</label>
              <input
                type="time"
                required
                value={shiftForm.breakStart}
                onChange={e => setShiftForm({ ...shiftForm, breakStart: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink font-mono"
              />
            </div>
            <div>
              <label className="block text-ink-muted mb-1">Kết Thúc Nghỉ Trưa</label>
              <input
                type="time"
                required
                value={shiftForm.breakEnd}
                onChange={e => setShiftForm({ ...shiftForm, breakEnd: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-ink-muted mb-1">Giờ Chuẩn (thực tế)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="12"
                required
                value={shiftForm.standardWorkHours}
                onChange={e => setShiftForm({ ...shiftForm, standardWorkHours: parseFloat(e.target.value) || 8 })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
              />
            </div>
            <div>
              <label className="block text-ink-muted mb-1">Giờ Tính Lương</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="12"
                required
                value={shiftForm.paidHours}
                onChange={e => setShiftForm({ ...shiftForm, paidHours: parseFloat(e.target.value) || 8 })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
              />
            </div>
            <div>
              <label className="block text-ink-muted mb-1">Dung Sai Cho Phép (phút)</label>
              <input
                type="number"
                min="0"
                max="60"
                required
                value={shiftForm.gracePeriodMinutes}
                onChange={e => setShiftForm({ ...shiftForm, gracePeriodMinutes: parseInt(e.target.value) || 15 })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
              />
            </div>
          </div>

          <div>
            <label className="block text-ink-muted mb-1">Đối Tượng Áp Dụng</label>
            <input
              type="text"
              required
              value={shiftForm.targetGroup}
              onChange={e => setShiftForm({ ...shiftForm, targetGroup: e.target.value })}
              placeholder="VD: Lao động nữ thai sản hoặc nuôi con nhỏ < 12 tháng"
              className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
            />
          </div>

          <div>
            <label className="block text-ink-muted mb-1">Trạng Thái Ca</label>
            <select
              value={shiftForm.status}
              onChange={e => setShiftForm({ ...shiftForm, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
              className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
            >
              <option value="ACTIVE">Đang áp dụng (Active)</option>
              <option value="INACTIVE">Tạm dừng áp dụng (Inactive)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsShiftModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" size="sm" type="submit">
              {editingShift ? 'Cập Nhật Ca Làm Việc' : 'Tạo Ca Làm Việc'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Thêm / Sửa Nghỉ Lễ */}
      <Modal
        isOpen={isHolidayModalOpen}
        onClose={() => setIsHolidayModalOpen(false)}
        title={editingHoliday ? 'Chỉnh Sửa Ngày Nghỉ Lễ' : 'Thêm Ngày Nghỉ Lễ Mới'}
      >
        <form onSubmit={handleSaveHoliday} className="space-y-4 text-xs">
          <div>
            <label className="block text-ink-muted mb-1">Tên Dịp Nghỉ Lễ</label>
            <input
              type="text"
              required
              value={holidayForm.name}
              onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })}
              placeholder="VD: Nghỉ Lễ Giỗ Tổ Hùng Vương"
              className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-muted mb-1">Từ Ngày</label>
              <input
                type="date"
                required
                value={holidayForm.startDate}
                onChange={e => setHolidayForm({ ...holidayForm, startDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink font-mono"
              />
            </div>
            <div>
              <label className="block text-ink-muted mb-1">Đến Ngày</label>
              <input
                type="date"
                required
                value={holidayForm.endDate}
                onChange={e => setHolidayForm({ ...holidayForm, endDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-muted mb-1">Tổng Số Ngày Nghỉ</label>
              <input
                type="number"
                min="1"
                max="30"
                required
                value={holidayForm.totalDays}
                onChange={e => setHolidayForm({ ...holidayForm, totalDays: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
              />
            </div>
            <div>
              <label className="block text-ink-muted mb-1">Phân Loại Nghỉ</label>
              <select
                value={holidayForm.type}
                onChange={e => setHolidayForm({ ...holidayForm, type: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
              >
                <option value="PUBLIC_HOLIDAY">Nghỉ Lễ Quốc Gia</option>
                <option value="COMPENSATION_DAY">Nghỉ Bù Hoặc Đặc Biệt</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isPaidHoliday"
              checked={holidayForm.isPaid}
              onChange={e => setHolidayForm({ ...holidayForm, isPaid: e.target.checked })}
              className="rounded border-line text-accent focus:ring-accent"
            />
            <label htmlFor="isPaidHoliday" className="text-xs text-ink cursor-pointer">
              Hưởng 100% nguyên lương theo luật lao động
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsHolidayModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" size="sm" type="submit">
              {editingHoliday ? 'Cập Nhật Ngày Nghỉ' : 'Lưu Ngày Nghỉ Lễ'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
