import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { useAuth } from '../../../context/AuthContext';

export interface KeyResult {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  weight: number; // percentage
  confidence: number; // 1-10
  status: 'ON_TRACK' | 'BEHIND' | 'AT_RISK';
}

export interface Objective {
  id: string;
  title: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  weight: number;
  keyResults: KeyResult[];
}

const INITIAL_OBJECTIVES: Objective[] = [
  {
    id: 'OBJ-01',
    title: 'Tối Ưu Hiệu Năng Core Service & Kiến Trúc Microservice Chuẩn',
    quarter: 'Q4',
    weight: 50,
    keyResults: [
      {
        id: 'KR-101',
        title: 'Giảm P99 API Latency của hệ thống chấm công xuống dưới 80ms',
        targetValue: 80,
        currentValue: 75,
        unit: 'ms',
        weight: 40,
        confidence: 9,
        status: 'ON_TRACK'
      },
      {
        id: 'KR-102',
        title: 'Đạt độ phủ Unit Test (Code Coverage) trên 85% toàn bộ repository',
        targetValue: 85,
        currentValue: 82,
        unit: '%',
        weight: 35,
        confidence: 8,
        status: 'ON_TRACK'
      },
      {
        id: 'KR-103',
        title: 'Triển khai bảo mật Keycloak RBAC hoàn tất trên Staging và Production',
        targetValue: 100,
        currentValue: 90,
        unit: '%',
        weight: 25,
        confidence: 7,
        status: 'ON_TRACK'
      }
    ]
  },
  {
    id: 'OBJ-02',
    title: 'Nâng Cao Năng Lực Đội Ngũ Kỹ Thuật & Đổi Mới Sáng Tạo',
    quarter: 'Q4',
    weight: 50,
    keyResults: [
      {
        id: 'KR-201',
        title: 'Tổ chức 3 buổi Tech Sharing chuyên sâu về AI Face Recognition & Liveness',
        targetValue: 3,
        currentValue: 2,
        unit: 'buổi',
        weight: 60,
        confidence: 8,
        status: 'ON_TRACK'
      },
      {
        id: 'KR-202',
        title: 'Đạt chứng chỉ quốc tế AWS Solutions Architect hoặc CKA',
        targetValue: 1,
        currentValue: 0.5,
        unit: 'chứng chỉ',
        weight: 40,
        confidence: 6,
        status: 'BEHIND'
      }
    ]
  }
];

const STORAGE_KEY = 'pulse_my_okr_objectives';

export const MyOKRPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q4');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [objectives, setObjectives] = useState<Objective[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_OBJECTIVES;
  });

  // Check-In modal state
  const [activeCheckInKR, setActiveCheckInKR] = useState<KeyResult | null>(null);
  const [checkInVal, setCheckInVal] = useState<number>(0);
  const [confidenceVal, setConfidenceVal] = useState<number>(8);
  const [checkInNote, setCheckInNote] = useState<string>('');

  // Add Objective modal state
  const [isAddObjOpen, setIsAddObjOpen] = useState(false);
  const [newObjTitle, setNewObjTitle] = useState('');
  const [newObjWeight, setNewObjWeight] = useState(50);

  // Add KR modal state
  const [targetObjIdForKR, setTargetObjIdForKR] = useState<string | null>(null);
  const [newKRForm, setNewKRForm] = useState({
    title: '',
    targetValue: 100,
    unit: '%',
    weight: 30,
    confidence: 8
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(objectives));
  }, [objectives]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleOpenCheckIn = (kr: KeyResult) => {
    setActiveCheckInKR(kr);
    setCheckInVal(kr.currentValue);
    setConfidenceVal(kr.confidence);
    setCheckInNote('');
  };

  const handleSaveCheckIn = () => {
    if (!activeCheckInKR) return;
    setObjectives(prev =>
      prev.map(obj => ({
        ...obj,
        keyResults: obj.keyResults.map(kr =>
          kr.id === activeCheckInKR.id
            ? {
                ...kr,
                currentValue: checkInVal,
                confidence: confidenceVal,
                status:
                  checkInVal >= kr.targetValue
                    ? 'ON_TRACK'
                    : confidenceVal >= 7
                    ? 'ON_TRACK'
                    : confidenceVal >= 4
                    ? 'BEHIND'
                    : 'AT_RISK'
              }
            : kr
        )
      }))
    );
    showToast(`Đã lưu check-in cho ${activeCheckInKR.id}`);
    setActiveCheckInKR(null);
  };

  const handleAddObjective = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newObjTitle.trim()) return;

    const nextId = `OBJ-${String(objectives.length + 1).padStart(2, '0')}`;
    const created: Objective = {
      id: nextId,
      title: newObjTitle.trim(),
      quarter: selectedQuarter,
      weight: newObjWeight,
      keyResults: []
    };

    setObjectives(prev => [...prev, created]);
    setIsAddObjOpen(false);
    setNewObjTitle('');
    showToast(`Đã thêm mục tiêu "${created.title}" vào Quý ${selectedQuarter}`);
  };

  const handleDeleteObjective = (objId: string, objTitle: string) => {
    if (confirm(`Bạn có chắc muốn xóa mục tiêu "${objTitle}"?`)) {
      setObjectives(prev => prev.filter(o => o.id !== objId));
      showToast(`Đã xóa mục tiêu "${objTitle}"`);
    }
  };

  const handleOpenAddKR = (objId: string) => {
    setTargetObjIdForKR(objId);
    setNewKRForm({
      title: '',
      targetValue: 100,
      unit: '%',
      weight: 30,
      confidence: 8
    });
  };

  const handleSaveKR = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetObjIdForKR || !newKRForm.title.trim()) return;

    const targetObj = objectives.find(o => o.id === targetObjIdForKR);
    const krCount = targetObj ? targetObj.keyResults.length : 0;
    const nextKrId = `KR-${targetObjIdForKR.replace('OBJ-', '')}0${krCount + 1}`;

    const newKR: KeyResult = {
      id: nextKrId,
      title: newKRForm.title.trim(),
      targetValue: newKRForm.targetValue,
      currentValue: 0,
      unit: newKRForm.unit.trim() || '%',
      weight: newKRForm.weight,
      confidence: newKRForm.confidence,
      status: 'ON_TRACK'
    };

    setObjectives(prev =>
      prev.map(o => (o.id === targetObjIdForKR ? { ...o, keyResults: [...o.keyResults, newKR] } : o))
    );
    setTargetObjIdForKR(null);
    showToast(`Đã thêm kết quả then chốt "${newKR.title}"`);
  };

  const handleDeleteKR = (objId: string, krId: string, krTitle: string) => {
    if (confirm(`Xóa kết quả then chốt "${krTitle}"?`)) {
      setObjectives(prev =>
        prev.map(o => (o.id === objId ? { ...o, keyResults: o.keyResults.filter(k => k.id !== krId) } : o))
      );
      showToast(`Đã xóa KR ${krId}`);
    }
  };

  const currentQuarterObjectives = objectives.filter(o => o.quarter === selectedQuarter);

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
            <h1 className="text-xl font-bold tracking-tight text-ink">Mục Tiêu Cá Nhân &amp; Check-In Tuần (My OKR)</h1>
            <Badge variant="accent">S21 / S22</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Thiết lập biểu mẫu 4 Box cho các quý, phân bổ trọng số KR (tổng 100%) và cập nhật tiến độ định kỳ hàng tuần
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => setIsAddObjOpen(true)}>
            + Thêm Mục Tiêu (Objective)
          </Button>
        </div>
      </div>

      {/* 4 Quarters Tabs (Form 4 Box - S21) */}
      <div className="flex items-center gap-2 border-b border-line pb-2">
        {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
          <button
            key={q}
            onClick={() => setSelectedQuarter(q)}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              selectedQuarter === q
                ? 'bg-accent text-white shadow-xs'
                : 'text-ink-secondary hover:text-ink hover:bg-canvas'
            }`}
          >
            Quý {q} / 2026 {q === 'Q4' && '★ (Đang diễn ra)'}
          </button>
        ))}
      </div>

      {/* Objectives List */}
      <div className="space-y-6">
        {currentQuarterObjectives.length === 0 ? (
          <div className="p-8 text-center bg-surface rounded-xl border border-line text-xs text-ink-muted space-y-2">
            <div>Chưa có mục tiêu nào được thiết lập cho {selectedQuarter} / 2026.</div>
            <Button variant="outline" size="sm" onClick={() => setIsAddObjOpen(true)}>
              + Tạo mục tiêu đầu tiên cho Quý {selectedQuarter}
            </Button>
          </div>
        ) : (
          currentQuarterObjectives.map(obj => {
            const totalWeight = obj.keyResults.reduce((acc, kr) => acc + kr.weight, 0);

            return (
              <div key={obj.id} className="bg-surface rounded-xl border border-line p-5 shadow-2xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-line pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-accent">{obj.id}</span>
                      <h3 className="font-bold text-sm text-ink">{obj.title}</h3>
                    </div>
                    <div className="text-xs text-ink-secondary">Trọng số mục tiêu: {obj.weight}%</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        totalWeight === 100
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      Tổng trọng số KR: {totalWeight}% {totalWeight === 100 ? '✓ Hợp lệ' : '⚠️ Phải bằng 100%'}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => handleOpenAddKR(obj.id)}>
                      + Thêm KR
                    </Button>
                    <button
                      onClick={() => handleDeleteObjective(obj.id, obj.title)}
                      className="p-1 text-xs text-status-danger hover:bg-status-danger/10 rounded"
                      title="Xóa mục tiêu"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Key Results */}
                {obj.keyResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-ink-muted border border-dashed border-line rounded-lg">
                    Chưa có kết quả then chốt nào. Hãy bấm "+ Thêm KR" để tạo tiêu chí đo lường.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {obj.keyResults.map(kr => {
                      const percent = Math.min(Math.round((kr.currentValue / kr.targetValue) * 100), 100);

                      return (
                        <div
                          key={kr.id}
                          className="p-3.5 rounded-lg border border-line bg-canvas/40 flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-semibold text-ink-muted">{kr.id}</span>
                              <span className="text-xs font-semibold text-ink">{kr.title}</span>
                              <span className="text-[11px] text-accent font-medium">({kr.weight}%)</span>
                              {kr.status === 'ON_TRACK' && <Badge variant="ok">Đúng tiến độ</Badge>}
                              {kr.status === 'BEHIND' && <Badge variant="warn">Chậm tiến độ</Badge>}
                              {kr.status === 'AT_RISK' && <Badge variant="danger">Rủi ro cao</Badge>}
                            </div>

                            <div className="flex items-center gap-4 text-xs">
                              <div className="w-48 bg-line rounded-full h-2">
                                <div
                                  className="bg-accent h-2 rounded-full transition-all"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                              <span className="font-mono font-bold text-ink">
                                {kr.currentValue} / {kr.targetValue} {kr.unit} ({percent}%)
                              </span>
                              <span className="text-[11px] text-ink-muted">
                                Độ tự tin: <strong className="text-ink">{kr.confidence}/10</strong>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end md:self-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenCheckIn(kr)}
                            >
                              Check-in Tuần (S22)
                            </Button>
                            <button
                              onClick={() => handleDeleteKR(obj.id, kr.id, kr.title)}
                              className="p-1 text-xs text-status-danger hover:bg-status-danger/10 rounded"
                              title="Xóa KR"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Check-In Modal (S22) */}
      {activeCheckInKR && (
        <Modal
          isOpen={true}
          onClose={() => setActiveCheckInKR(null)}
          title={`Check-In Tiến Độ Tuần: ${activeCheckInKR.title}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-ink-muted mb-1">
                Giá trị hiện tại ({activeCheckInKR.unit}) / Mục tiêu: {activeCheckInKR.targetValue} {activeCheckInKR.unit}
              </label>
              <input
                type="number"
                step="any"
                value={checkInVal}
                onChange={e => setCheckInVal(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-line rounded-lg bg-surface text-ink text-sm font-bold font-mono"
              />
            </div>

            <div>
              <label className="block text-ink-muted mb-1">
                Mức độ tự tin đạt mục tiêu cuối kỳ (Confidence Score: {confidenceVal}/10)
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={confidenceVal}
                onChange={e => setConfidenceVal(parseInt(e.target.value))}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-[10px] text-ink-muted mt-1">
                <span>1 (Rất rủi ro)</span>
                <span>5 (Trung bình)</span>
                <span>10 (Chắc chắn đạt)</span>
              </div>
            </div>

            <div>
              <label className="block text-ink font-medium mb-1">
                Tiến độ thực hiện, khó khăn &amp; Kế hoạch tuần tiếp theo
              </label>
              <textarea
                rows={3}
                placeholder="Mô tả kết quả đạt được trong tuần qua và các rào cản cần Lead hỗ trợ..."
                value={checkInNote}
                onChange={e => setCheckInNote(e.target.value)}
                className="w-full p-2 border border-line rounded-lg bg-surface text-ink"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="outline" size="sm" onClick={() => setActiveCheckInKR(null)}>
                Hủy
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveCheckIn}>
                Lưu Báo Cáo Check-In
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Thêm Mục Tiêu (Hỗ trợ Tính năng C17: Kế thừa từ Quản lý) */}
      <Modal
        isOpen={isAddObjOpen}
        onClose={() => setIsAddObjOpen(false)}
        title={`Thêm Mục Tiêu (Objective) - Quý ${selectedQuarter}/2026`}
      >
        <form onSubmit={handleAddObjective} className="space-y-4 text-xs">
          {/* C17: Quick inheritance from manager OKR */}
          <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400">⚡ Gợi ý kế thừa từ OKR Quản lý (Tính năng C17)</span>
              <span className="text-[10px] text-ink-muted">Lead: Phạm Minh Tuấn</span>
            </div>
            <p className="text-[11px] text-ink-muted">
              Căn chỉnh mục tiêu cá nhân ăn khớp trực tiếp vào mục tiêu của đội ngũ kỹ thuật.
            </p>
            <div className="flex flex-col gap-1 pt-1">
              {[
                'Đảm bảo kiến trúc Microservice và hệ thống bảo mật Keycloak chuẩn',
                'Tối ưu hóa P99 latency < 80ms và hoàn thiện 45 cột Timesheet',
                'Nâng cao năng lực đội ngũ kỹ thuật & Tech Lead readiness'
              ].map((mgrObj, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNewObjTitle(mgrObj)}
                  className="text-left p-1.5 rounded bg-surface hover:bg-emerald-500/10 border border-line text-ink transition-colors flex items-center justify-between text-[11px] cursor-pointer"
                >
                  <span className="truncate">{mgrObj}</span>
                  <span className="text-[10px] text-emerald-400 font-bold shrink-0 ml-1">Kế thừa</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-ink-muted mb-1">Tiêu Đề Mục Tiêu (Inspiring &amp; Action-oriented)</label>
            <input
              type="text"
              required
              value={newObjTitle}
              onChange={e => setNewObjTitle(e.target.value)}
              placeholder="VD: Mở rộng thị trường doanh nghiệp và đạt mốc 100 khách hàng B2B"
              className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
            />
          </div>

          <div>
            <label className="block text-ink-muted mb-1">Trọng Số Mục Tiêu (%)</label>
            <input
              type="number"
              min="1"
              max="100"
              required
              value={newObjWeight}
              onChange={e => setNewObjWeight(parseInt(e.target.value) || 50)}
              className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsAddObjOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Tạo Mục Tiêu
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Thêm Key Result */}
      {targetObjIdForKR && (
        <Modal
          isOpen={true}
          onClose={() => setTargetObjIdForKR(null)}
          title={`Thêm Kết Quả Then Chốt (KR) cho ${targetObjIdForKR}`}
        >
          <form onSubmit={handleSaveKR} className="space-y-4 text-xs">
            <div>
              <label className="block text-ink-muted mb-1">Tiêu Đề Kết Quả Then Chốt (Measurable Outcome)</label>
              <input
                type="text"
                required
                value={newKRForm.title}
                onChange={e => setNewKRForm({ ...newKRForm, title: e.target.value })}
                placeholder="VD: Ký kết hợp đồng thành công với 15 khách hàng lớn"
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-ink-muted mb-1">Chỉ Tiêu Cần Đạt (Target)</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={newKRForm.targetValue}
                  onChange={e => setNewKRForm({ ...newKRForm, targetValue: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink font-mono"
                />
              </div>
              <div>
                <label className="block text-ink-muted mb-1">Đơn Vị Đo Lường</label>
                <input
                  type="text"
                  required
                  value={newKRForm.unit}
                  onChange={e => setNewKRForm({ ...newKRForm, unit: e.target.value })}
                  placeholder="VD: %, khách hàng, tỷ VNĐ, giờ"
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-ink-muted mb-1">Trọng Số Trong Objective (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={newKRForm.weight}
                  onChange={e => setNewKRForm({ ...newKRForm, weight: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink font-mono"
                />
              </div>
              <div>
                <label className="block text-ink-muted mb-1">Độ Tự Tin Khởi Điểm (1-10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={newKRForm.confidence}
                  onChange={e => setNewKRForm({ ...newKRForm, confidence: parseInt(e.target.value) || 8 })}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="outline" size="sm" type="button" onClick={() => setTargetObjIdForKR(null)}>
                Hủy
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Lưu Kết Quả Then Chốt
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
