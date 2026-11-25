import React from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { ScorePicker } from './ScorePicker';
import { GROUP_ITEMS, Form4Box } from './types';
import type { Form4BoxState } from './useForm4Box';

// Box 1–4 + điểm trung bình + nút nộp bản tự đánh giá (dùng chung cho workspace nhân viên và trang chấm điểm).
export const OkrSelfAssessmentSection: React.FC<{ assessment: Form4BoxState }> = ({ assessment }) => {
  const {
    form, selfDraft, setSelfDraft, canEditSelf, isSelf, scaleText, scaleMin, scaleMax, selfAverage, submitSelf, saving,
  } = assessment;

  return (
        <>
          {/* Box 1 — Thông tin cá nhân: hệ thống tự điền từ hồ sơ nhân sự */}
          <Card className="space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h2 className="text-sm font-bold text-ink">Thông tin nhân viên</h2>
              <Badge variant="gray">Tự điền từ hồ sơ</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {([
                ['Họ và tên', form.box1?.fullName ?? form.employeeName],
                ['Mã nhân viên', form.box1?.employeeCode ?? form.employeeCode],
                ['Vị trí', form.box1?.jobTitle],
                ['Phòng ban', form.box1?.department],
                ['Quản lý trực tiếp', form.box1?.managerName],
                ['Ngày vào làm', form.box1?.joinedDate],
                ['Thời gian công tác', form.box1?.seniority],
                ['Chu kỳ đánh giá', form.box1?.cycleYear ?? form.year],
              ] as [string, unknown][]).map(([label, value]) => (
                <div key={label} className="rounded-lg border border-line bg-canvas p-2.5">
                  <div className="text-[11px] text-ink-muted">{label}</div>
                  <div className="font-semibold text-ink mt-0.5">{value ? String(value) : '—'}</div>
                </div>
              ))}
            </div>
            {form.box1?.newJoiner && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-800">
                👋 {form.box1.seniorityNote || `Nhân viên mới — đánh giá theo ${form.box1.monthsWorked ?? '—'} tháng thực tế.`}
              </div>
            )}
          </Card>

          {/* Box 2 Business / Box 3 People — mục tiêu + tiến độ check-in + điểm tự chấm / quản lý chấm */}
          {([
            { box: 2 as const, title: 'Thành tựu công việc (Business)', scoreKey: 'box2BusinessScore' as const, managerScore: form.managerBusinessScore, progress: form.box2?.progress, items: form.box2Items, badge: 'accent' as const },
            { box: 3 as const, title: 'Thành tựu con người (People)', scoreKey: 'box3PeopleScore' as const, managerScore: form.managerPeopleScore, progress: form.box3?.progress, items: form.box3Items, badge: 'ok' as const },
          ]).map(({ box, title, scoreKey, managerScore, progress, items, badge }) => (
            <Card key={box} className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-2">
                <div>
                  <h2 className="text-sm font-bold text-ink">{title}</h2>
                  {typeof progress === 'number' && (
                    <div className="text-[11px] text-ink-muted">Tiến độ check-in của nhóm: {progress}%</div>
                  )}
                </div>
                <Badge variant={badge}>Chấm {scaleText} · không điểm lẻ</Badge>
              </div>

              {/* Mục tiêu + tiến độ — hiển thị giống màn check-in */}
              <div className="rounded-xl border border-line bg-canvas p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-ink">Mục tiêu &amp; tiến độ</div>
                  {(items || []).length > 0 && (
                    <div className="text-[11px] text-ink-muted">{(items || []).length} mục tiêu</div>
                  )}
                </div>
                {(items || []).length === 0 ? (
                  <div className="text-[11px] text-ink-muted py-2">
                    Nhóm này chưa có mục tiêu nào được duyệt — tiến độ sẽ hiện khi có check-in.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(items || []).map((it) => (
                      <div key={it.id} className="rounded-lg border border-line bg-surface p-2.5">
                        <div className="text-xs font-semibold text-ink leading-snug">{it.title}</div>
                        {it.detail && <div className="text-[11px] text-ink-muted mt-0.5">{it.detail}</div>}
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent"
                              style={{ width: `${Math.min(100, Math.max(0, it.progress ?? 0))}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-ink-muted whitespace-nowrap">
                            Tiến độ: <b className="text-ink font-semibold">{it.progress ?? 0}%</b>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ghi chú tự đánh giá — gộp gọn vì phần chính là mục tiêu + tiến độ + điểm.
                  "Kết quả" vẫn bắt buộc khi nộp bản cuối năm (quy định form 4 Box). */}
              <details className="rounded-xl border border-line bg-canvas p-3" open>
                <summary className="cursor-pointer text-xs font-bold text-ink select-none">
                  Ghi chú tự đánh giá
                  <span className="ml-1 font-normal text-ink-muted">(Kết quả bắt buộc khi nộp bản cuối năm)</span>
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  {GROUP_ITEMS.map(({ suffix, label, placeholder, required }) => {
                    const key = `box${box}${suffix}` as keyof Form4Box;
                    return (
                      <div key={String(key)}>
                        <label className="block text-xs font-semibold text-ink mb-1">
                          {label}
                          {required && <span className="text-danger"> *</span>}
                        </label>
                        <textarea
                          rows={3}
                          disabled={!canEditSelf}
                          value={(selfDraft[key] as string | null | undefined) || ''}
                          onChange={(e) => setSelfDraft({ ...selfDraft, [key]: e.target.value })}
                          placeholder={placeholder}
                          className="w-full border border-line rounded-lg p-2.5 text-xs bg-surface disabled:bg-surface disabled:text-ink-muted focus:outline-none focus:border-accent"
                        />
                      </div>
                    );
                  })}
                </div>
              </details>

              {/* Điểm: tự chấm to & rõ, quản lý chấm nổi bật tương đương */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-line bg-surface p-3">
                  <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">Điểm tự chấm</div>
                  <div className="mt-1.5">
                    <ScorePicker
                      min={scaleMin}
                      max={scaleMax}
                      value={selfDraft[scoreKey]}
                      disabled={!canEditSelf}
                      onChange={(v) => setSelfDraft({ ...selfDraft, [scoreKey]: v })}
                    />
                  </div>
                  <div className="text-[11px] text-ink-muted mt-1.5">
                    Nhân viên tự đánh giá theo thang {scaleText}.
                  </div>
                </div>

                <div
                  className={`rounded-xl border-2 p-3 ${
                    managerScore != null
                      ? 'border-accent bg-accent-soft/30 shadow-sm'
                      : 'border-dashed border-line bg-canvas'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-accent-dark">Điểm quản lý chấm</div>
                    {managerScore != null && <Badge variant="accent">Đã chấm</Badge>}
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className={`text-4xl font-black leading-none ${
                      managerScore != null ? 'text-accent' : 'text-ink-muted'
                    }`}>
                      {managerScore ?? '—'}
                    </span>
                    {managerScore != null && (
                      <span className="text-[11px] text-ink-muted">/ {scaleText}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-ink-muted mt-1.5">
                    {managerScore != null
                      ? (selfDraft[scoreKey] != null && managerScore !== selfDraft[scoreKey]
                        ? `Lệch so với tự chấm: ${Number(managerScore) - Number(selfDraft[scoreKey]) > 0 ? '+' : ''}${Number(managerScore) - Number(selfDraft[scoreKey])} điểm`
                        : 'Trùng với điểm tự chấm')
                      : 'Chưa có Quản lý chấm — điểm hiển thị khi Quản lý nộp.'}
                  </div>
                </div>
              </div>
            </Card>
          ))}

          <Card className="space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h2 className="text-sm font-bold text-ink">Điểm trung bình tự tính</h2>
              <Badge variant="accent">Không có ô nhập tay</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-line bg-canvas p-3">
                <div className="text-[11px] text-ink-muted">Tự chấm (Business + People) / 2</div>
                <div className="text-2xl font-black text-ink">{selfAverage == null ? '—' : selfAverage.toFixed(1)}</div>
              </div>
              <div className={`rounded-lg p-3 ${
                form.managerAverageScore != null
                  ? 'border-2 border-accent bg-accent-soft/30'
                  : 'border border-dashed border-line bg-canvas'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-accent-dark">
                    Quản lý chấm (Business + People) / 2
                  </div>
                  {form.managerAverageScore != null && <Badge variant="accent">Điểm chính thức</Badge>}
                </div>
                <div className={`text-4xl font-black leading-none mt-1 ${
                  form.managerAverageScore != null ? 'text-accent' : 'text-ink-muted'
                }`}>
                  {form.managerAverageScore == null ? '—' : form.managerAverageScore.toFixed(1)}
                </div>
              </div>
            </div>
            {isSelf && !canEditSelf && form.selfLockReason && (
              <div className="text-[11px] text-ink-muted">🔒 {form.selfLockReason}</div>
            )}
            {canEditSelf && (
              <div className="flex justify-end">
                <Button size="sm" variant="primary" onClick={submitSelf} disabled={saving}>{saving ? 'Đang lưu...' : 'Nộp bản tự đánh giá'}</Button>
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h2 className="text-sm font-bold text-ink">Định hướng &amp; đề xuất phát triển</h2>
              <Badge variant="warn">Tuỳ chọn</Badge>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink">Định hướng phát triển</label>
              <textarea
                rows={2}
                disabled={!canEditSelf}
                value={selfDraft.box4Direction || ''}
                onChange={(e) => setSelfDraft({ ...selfDraft, box4Direction: e.target.value })}
                placeholder="Định hướng phát triển của bạn trong kỳ..."
                className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas disabled:bg-surface disabled:text-ink-muted focus:outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink">Đề xuất</label>
              <textarea
                rows={2}
                disabled={!canEditSelf}
                value={selfDraft.box4SelfProposal || ''}
                onChange={(e) => setSelfDraft({ ...selfDraft, box4SelfProposal: e.target.value })}
                placeholder="Đề xuất của bạn trong kỳ..."
                className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas disabled:bg-surface disabled:text-ink-muted focus:outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink">Điểm cần cải thiện</label>
              <textarea
                rows={2}
                disabled={!canEditSelf}
                value={selfDraft.box4ImprovementArea || ''}
                onChange={(e) => setSelfDraft({ ...selfDraft, box4ImprovementArea: e.target.value })}
                placeholder="Điểm cần cải thiện..."
                className="w-full border border-line rounded-lg p-2.5 text-xs bg-canvas disabled:bg-surface disabled:text-ink-muted focus:outline-none focus:border-accent"
              />
            </div>
          </Card>
        </>
  );
};

