import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { useAuth } from '../../../context/AuthContext';

export interface RuleItem {
  code: string;
  name: string;
  category: 'CHECKIN' | 'LEAVE' | 'WFH' | 'OVERTIME' | 'PENALTY';
  currentVersion: string;
  parameters: Record<string, any>;
  effectiveDate: string;
  description: string;
  status: 'ACTIVE' | 'DRAFT';
}

const INITIAL_RULES: RuleItem[] = [
  {
    code: 'RULE_GRACE_PERIOD_MINUTES',
    name: 'Dung sai giờ vào ca chuẩn (Grace Period)',
    category: 'CHECKIN',
    currentVersion: 'v2.1',
    parameters: { grace_minutes: 15, apply_both_shifts: true },
    effectiveDate: '01/01/2026',
    description: 'Cho phép nhân viên check-in muộn tối đa 15 phút sau 08:30 (tức đến 08:45) mà không bị phạt đi muộn.',
    status: 'ACTIVE'
  },
  {
    code: 'RULE_LATE_MONTHLY_QUOTA',
    name: 'Số lần đi muộn miễn phạt mỗi tháng (Quota)',
    category: 'PENALTY',
    currentVersion: 'v1.0',
    parameters: { free_quota: 3, penalty_percent_from_4th: 5 },
    effectiveDate: '01/01/2026',
    description: 'Mỗi nhân viên có 3 lần đi muộn trong ngưỡng 15-30p không trừ chuyên cần. Từ lần thứ 4 trừ 5% chuyên cần.',
    status: 'ACTIVE'
  },
  {
    code: 'RULE_WFH_MONTHLY_LIMIT',
    name: 'Hạn mức đăng ký làm từ xa (WFH Cap)',
    category: 'WFH',
    currentVersion: 'v2.0',
    parameters: { max_days_per_month: 3, require_advance_hours: 12 },
    effectiveDate: '15/10/2026',
    description: 'Tối đa 3 ngày làm từ xa mỗi tháng cho khối Engineering & Data. Cần nộp đơn trước ít nhất 12 giờ.',
    status: 'ACTIVE'
  },
  {
    code: 'RULE_LEAVE_ROLLOVER_EXPIRY',
    name: 'Hạn sử dụng phép tồn năm trước (Rollover Deadline)',
    category: 'LEAVE',
    currentVersion: 'v1.2',
    parameters: { expiry_date: '31/03', max_carried_days: 5 },
    effectiveDate: '01/01/2026',
    description: 'Phép năm cũ được bảo lưu tối đa 5 ngày và bắt buộc phải sử dụng hết trước ngày 31/03 hàng năm.',
    status: 'ACTIVE'
  },
  {
    code: 'RULE_OVERTIME_MULTIPLIER',
    name: 'Hệ số tính công làm thêm giờ (OT Factor)',
    category: 'OVERTIME',
    currentVersion: 'v1.0',
    parameters: { weekday_multiplier: 1.5, weekend_multiplier: 2.0, holiday_multiplier: 3.0 },
    effectiveDate: '01/01/2026',
    description: 'Hệ số tính lương làm thêm giờ: Ngày thường x1.5, Thứ bảy & Chủ nhật x2.0, Nghỉ lễ x3.0 theo Bộ luật Lao động.',
    status: 'ACTIVE'
  },
  {
    code: 'RULE_MISSED_CHECKIN_EXPLANATION_WINDOW',
    name: 'Cửa sổ thời gian giải trình quên chấm công',
    category: 'CHECKIN',
    currentVersion: 'v2.0',
    parameters: { max_hours: 24, max_times_monthly: 3 },
    effectiveDate: '01/09/2026',
    description: 'Nhân viên bắt buộc phải nộp đơn giải trình quên check-in / check-out trong vòng 24 giờ kể từ thời điểm phát sinh.',
    status: 'ACTIVE'
  }
];

const STORAGE_KEY = 'pulse_rule_engine_data';

export const RuleEnginePage: React.FC = () => {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'HR_ADMIN';

  const [rules, setRules] = useState<RuleItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_RULES;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Edit modal
  const [editingRule, setEditingRule] = useState<RuleItem | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', paramsJson: '', effectiveDate: '' });

  // Add modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newRuleForm, setNewRuleForm] = useState({
    code: '',
    name: '',
    category: 'CHECKIN' as RuleItem['category'],
    description: '',
    paramsJson: '{\n  "parameter_name": 10\n}',
    effectiveDate: new Date().toISOString().split('T')[0]
  });

  // Dry-run modal
  const [isDryRunOpen, setIsDryRunOpen] = useState(false);
  const [dryRunRunning, setDryRunRunning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<any | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  }, [rules]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleOpenEdit = (rule: RuleItem) => {
    setEditingRule(rule);
    setEditForm({
      name: rule.name,
      description: rule.description,
      paramsJson: JSON.stringify(rule.parameters, null, 2),
      effectiveDate: rule.effectiveDate
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;

    try {
      const parsedParams = JSON.parse(editForm.paramsJson);
      const vNum = parseFloat(editingRule.currentVersion.replace('v', '')) || 1.0;
      const nextVersion = `v${(vNum + 0.1).toFixed(1)}`;

      setRules(prev =>
        prev.map(r =>
          r.code === editingRule.code
            ? {
                ...r,
                name: editForm.name.trim(),
                description: editForm.description.trim(),
                parameters: parsedParams,
                effectiveDate: editForm.effectiveDate,
                currentVersion: nextVersion
              }
            : r
        )
      );

      showToast(`Đã lưu quy định "${editingRule.code}" lên phiên bản ${nextVersion}`);
      setEditingRule(null);
    } catch (err: any) {
      alert('Định dạng JSON tham số không hợp lệ: ' + err.message);
    }
  };

  const handleSaveNewRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleForm.code.trim() || !newRuleForm.name.trim()) return;

    try {
      const parsedParams = JSON.parse(newRuleForm.paramsJson);
      const ruleCode = newRuleForm.code.trim().toUpperCase();

      if (rules.some(r => r.code === ruleCode)) {
        alert(`Mã quy định "${ruleCode}" đã tồn tại!`);
        return;
      }

      const created: RuleItem = {
        code: ruleCode,
        name: newRuleForm.name.trim(),
        category: newRuleForm.category,
        currentVersion: 'v1.0',
        parameters: parsedParams,
        effectiveDate: newRuleForm.effectiveDate,
        description: newRuleForm.description.trim(),
        status: 'ACTIVE'
      };

      setRules(prev => [created, ...prev]);
      setIsAddOpen(false);
      showToast(`Đã tạo quy tắc mới "${created.code}" thành công`);
    } catch (err: any) {
      alert('Định dạng JSON tham số không hợp lệ: ' + err.message);
    }
  };

  const handleDeleteRule = (code: string) => {
    if (confirm(`Bạn có chắc muốn xóa quy định "${code}"?`)) {
      setRules(prev => prev.filter(r => r.code !== code));
      showToast(`Đã xóa quy tắc ${code}`);
    }
  };

  const runSimulation = () => {
    setDryRunRunning(true);
    setDryRunResult(null);
    setTimeout(() => {
      setDryRunRunning(false);
      setDryRunResult({
        totalLogsEvaluated: 12450,
        affectedEmployees: 34,
        attendanceRateShift: '+1.8%',
        payrollImpactVND: '+4,250,000 đ',
        summary: 'Mô phỏng áp dụng luật mới trên dữ liệu chấm công tháng 10/2026 cho thấy 34 nhân viên giảm vi phạm đi muộn và quỹ lương chuyên cần tăng nhẹ 1.8%.'
      });
    }, 1200);
  };

  const filteredRules = rules.filter(r => {
    const matchesCat = filterCategory === 'ALL' || r.category === filterCategory;
    const matchesQ =
      r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesQ;
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
            <h1 className="text-xl font-bold tracking-tight text-ink">Động Cơ Quy Tắc &amp; Chính Sách (Rule Engine)</h1>
            <Badge variant="accent">S16 / S17 / S18</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Quản trị các quy định nghiệp vụ linh hoạt, versioning bất biến và mô phỏng Dry-Run tác động trước khi ban hành
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsDryRunOpen(true)}>
            🧪 Chạy Mô Phỏng Dry-Run (S18)
          </Button>
          {canManage && (
            <Button variant="primary" size="sm" onClick={() => setIsAddOpen(true)}>
              + Tạo Quy Định Mới
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-line shadow-2xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Tìm theo mã luật, tên, nội dung..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:ring-1 focus:ring-accent w-full sm:w-72"
          />

          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-line bg-canvas text-ink"
          >
            <option value="ALL">Tất cả danh mục</option>
            <option value="CHECKIN">Chấm công (CHECKIN)</option>
            <option value="PENALTY">Chuyên cần &amp; Phạt (PENALTY)</option>
            <option value="WFH">Làm việc từ xa (WFH)</option>
            <option value="LEAVE">Nghỉ phép (LEAVE)</option>
            <option value="OVERTIME">Làm thêm giờ (OVERTIME)</option>
          </select>
        </div>

        <div className="text-xs text-ink-muted">
          Tổng cộng: <strong className="text-ink">{filteredRules.length}</strong> quy định
        </div>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRules.map(rule => (
          <div
            key={rule.code}
            className="bg-surface rounded-xl border border-line p-5 shadow-2xs hover:border-accent transition-all flex flex-col justify-between relative group"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold text-accent-dark">{rule.code}</span>
                <Badge variant="ok">{rule.currentVersion}</Badge>
              </div>
              <h3 className="font-semibold text-xs text-ink mt-2">{rule.name}</h3>
              <p className="text-[11px] text-ink-secondary mt-1.5 line-clamp-2 leading-relaxed">
                {rule.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-line space-y-2">
              <div className="bg-canvas p-2 rounded-lg font-mono text-[10px] text-ink overflow-x-auto max-h-24">
                {JSON.stringify(rule.parameters, null, 2)}
              </div>
              <div className="flex items-center justify-between text-[11px] text-ink-muted">
                <span>Hiệu lực: {rule.effectiveDate}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEdit(rule)}
                    className="text-accent font-medium hover:underline text-xs"
                  >
                    Chỉnh sửa
                  </button>
                  {canManage && (
                    <button
                      onClick={() => handleDeleteRule(rule.code)}
                      className="text-status-danger hover:underline text-xs ml-1"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Rule Modal */}
      {editingRule && (
        <Modal
          isOpen={true}
          onClose={() => setEditingRule(null)}
          title={`Chỉnh sửa Quy định: ${editingRule.code}`}
          maxWidth="lg"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-ink mb-1">Tên quy định</label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
              />
            </div>

            <div>
              <label className="block font-medium text-ink mb-1">Mô tả nghiệp vụ</label>
              <textarea
                rows={2}
                required
                value={editForm.description}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
              />
            </div>

            <div>
              <label className="block font-medium text-ink mb-1">Tham số cấu hình (JSON Parameters)</label>
              <textarea
                rows={4}
                required
                value={editForm.paramsJson}
                onChange={e => setEditForm({ ...editForm, paramsJson: e.target.value })}
                className="w-full p-2 border border-line rounded-lg bg-surface font-mono text-[11px] text-ink"
              />
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-[11px]">
              ⚠️ Khi lưu thay đổi, hệ thống sẽ tự động tăng <strong>Rule Version</strong> và ghi vết kiểm toán Audit Log (S35).
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="outline" size="sm" type="button" onClick={() => setEditingRule(null)}>
                Hủy
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Lưu Phiên Bản Mới
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Rule Modal */}
      {isAddOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddOpen(false)}
          title="Tạo Quy Định &amp; Luật Mới (Rule Engine)"
          maxWidth="lg"
        >
          <form onSubmit={handleSaveNewRule} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-ink mb-1">Mã Quy Định (Unique Code) *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: RULE_OVERTIME_LIMIT_MONTHLY"
                  value={newRuleForm.code}
                  onChange={e => setNewRuleForm({ ...newRuleForm, code: e.target.value })}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-medium text-ink mb-1">Phân Loại Nghiệp Vụ *</label>
                <select
                  value={newRuleForm.category}
                  onChange={e => setNewRuleForm({ ...newRuleForm, category: e.target.value as any })}
                  className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
                >
                  <option value="CHECKIN">Chấm công (CHECKIN)</option>
                  <option value="PENALTY">Chuyên cần &amp; Phạt (PENALTY)</option>
                  <option value="WFH">Làm việc từ xa (WFH)</option>
                  <option value="LEAVE">Nghỉ phép (LEAVE)</option>
                  <option value="OVERTIME">Làm thêm giờ (OVERTIME)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-medium text-ink mb-1">Tên Quy Định Dễ Hiểu *</label>
              <input
                type="text"
                required
                placeholder="VD: Hạn mức tối đa làm thêm giờ trong tháng (40 giờ)"
                value={newRuleForm.name}
                onChange={e => setNewRuleForm({ ...newRuleForm, name: e.target.value })}
                className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
              />
            </div>

            <div>
              <label className="block font-medium text-ink mb-1">Mô Tả Nghiệp Vụ &amp; Căn Cứ Luật</label>
              <textarea
                rows={2}
                required
                placeholder="Mô tả chi tiết nguyên tắc áp dụng và căn cứ theo điều khoản quy chế nội bộ..."
                value={newRuleForm.description}
                onChange={e => setNewRuleForm({ ...newRuleForm, description: e.target.value })}
                className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
              />
            </div>

            <div>
              <label className="block font-medium text-ink mb-1">Tham Số Cấu Hình (JSON Parameters) *</label>
              <textarea
                rows={3}
                required
                value={newRuleForm.paramsJson}
                onChange={e => setNewRuleForm({ ...newRuleForm, paramsJson: e.target.value })}
                className="w-full p-2 border border-line rounded-lg bg-surface font-mono text-[11px] text-ink"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsAddOpen(false)}>
                Hủy
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Tạo Quy Định Mới
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Dry Run Modal */}
      {isDryRunOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsDryRunOpen(false)}
          title="Mô Phỏng Tác Động Quy Tắc Mới (Dry-Run Simulator - S18)"
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <p className="text-ink-secondary">
              Công cụ cho phép áp thử nghiệm các tham số luật mới lên dữ liệu chấm công lịch sử để đo lường tỷ lệ đi muộn, số ngày công hợp lệ và chi phí phát sinh trước khi ban hành.
            </p>

            <div className="p-3 bg-canvas rounded-lg border border-line space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-ink">Quy tắc chạy thử nghiệm:</span>
                <span className="font-mono text-accent-dark">RULE_GRACE_PERIOD_MINUTES</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="text-ink-muted">Tham số hiện tại:</span>
                  <div className="font-mono text-ink">grace_minutes = 15 phút</div>
                </div>
                <div>
                  <span className="text-ink-muted">Tham số thử nghiệm:</span>
                  <div className="font-mono text-accent-dark font-bold">grace_minutes = 20 phút</div>
                </div>
              </div>
            </div>

            <div className="text-center py-2">
              <Button
                variant="primary"
                size="md"
                onClick={runSimulation}
                disabled={dryRunRunning}
              >
                {dryRunRunning ? 'Đang phân tích 12,450 bản ghi log...' : 'Bắt đầu chạy mô phỏng trên dữ liệu tháng 10/2026'}
              </Button>
            </div>

            {dryRunResult && (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 space-y-3 animate-in fade-in">
                <div className="font-semibold text-xs text-emerald-900 flex items-center gap-1.5">
                  <span>📊</span> Kết quả mô phỏng Dry-Run:
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                  <div className="p-2 bg-white rounded border border-emerald-100">
                    <div className="text-[10px] text-emerald-700">Log đã quét</div>
                    <div className="text-sm font-bold">{dryRunResult.totalLogsEvaluated}</div>
                  </div>
                  <div className="p-2 bg-white rounded border border-emerald-100">
                    <div className="text-[10px] text-emerald-700">Nhân sự ảnh hưởng</div>
                    <div className="text-sm font-bold text-accent">{dryRunResult.affectedEmployees} người</div>
                  </div>
                  <div className="p-2 bg-white rounded border border-emerald-100">
                    <div className="text-[10px] text-emerald-700">Tỷ lệ đúng giờ</div>
                    <div className="text-sm font-bold text-emerald-700">{dryRunResult.attendanceRateShift}</div>
                  </div>
                  <div className="p-2 bg-white rounded border border-emerald-100">
                    <div className="text-[10px] text-emerald-700">Biến động quỹ công</div>
                    <div className="text-sm font-bold">{dryRunResult.payrollImpactVND}</div>
                  </div>
                </div>
                <div className="text-[11px] text-emerald-800 leading-relaxed">
                  {dryRunResult.summary}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-line">
              <Button variant="outline" size="sm" onClick={() => setIsDryRunOpen(false)}>
                Đóng mô phỏng
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
