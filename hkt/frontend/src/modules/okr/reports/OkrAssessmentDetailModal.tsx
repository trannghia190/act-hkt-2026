import React from 'react';
import { Modal } from '../../../components/common/Modal';
import { Badge } from '../../../components/common/Badge';
import { useForm4Box } from '../assessment/useForm4Box';
import { GROUP_ITEMS, statusLabel } from '../assessment/types';

interface Props {
  /** null = đóng modal. */
  employeeCode: string | null;
  employeeName?: string;
  onClose: () => void;
  onToast?: (msg: string) => void;
}

const TextBlock: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <div className="rounded-lg border border-line bg-canvas p-2.5">
    <div className="text-[11px] text-ink-muted mb-1">{label}</div>
    <div className="text-xs text-ink whitespace-pre-wrap">{value?.trim() || '—'}</div>
  </div>
);

const ScoreLine: React.FC<{ label: string; value?: number | null }> = ({ label, value }) => (
  <div className="rounded-lg border border-line bg-canvas p-2.5">
    <div className="text-[11px] text-ink-muted">{label}</div>
    <div className="font-bold text-ink">{value ?? '—'}</div>
  </div>
);

/** HR xem lại form đánh giá 4 Box của nhân viên — chỉ đọc, không có thao tác sửa/nộp. */
export const OkrAssessmentDetailModal: React.FC<Props> = ({ employeeCode, employeeName, onClose, onToast }) => {
  const { form, loading } = useForm4Box({ employeeCode: employeeCode || '', enabled: !!employeeCode, onToast });

  const boxItems = (box?: { items?: { id: string; title: string; progress: number }[] }, fallback?: { id: string; title: string; progress: number }[]) =>
    box?.items || fallback || [];

  const officialAverage = form.managerAverageScore ?? form.selfAverageScore ?? null;
  // Tránh hiển thị nhầm form của nhân viên xem trước đó khi form mới đang tải/lỗi.
  const loaded = !!employeeCode && form.employeeCode === employeeCode;

  return (
    <Modal
      isOpen={!!employeeCode}
      onClose={onClose}
      title={`Chi tiết đánh giá OKR — ${employeeName || form.employeeName || employeeCode || ''}`}
      maxWidth="4xl"
    >
      {loading || !loaded ? (
        <div className="py-10 text-center text-xs text-ink-muted">
          {loading ? 'Đang tải form đánh giá...' : 'Không tải được form đánh giá của nhân viên này.'}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tổng quan */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={form.status === 'DA_HOAN_TAT' ? 'ok' : form.status === 'CHO_QL_CHAM' ? 'warn' : 'gray'}>
              {statusLabel(form.status)}
            </Badge>
            <Badge variant="accent">Điểm TB chính thức: {officialAverage != null ? officialAverage.toFixed(1) : '—'}</Badge>
            <span className="text-[11px] text-ink-muted">Chu kỳ {form.year} · Chỉ xem, không thể chỉnh sửa</span>
          </div>

          {/* Box 1 */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-ink border-b border-line pb-1.5">Box 1 · Thông tin nhân viên</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
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
                  <div className="font-semibold text-ink">{value != null && value !== '' ? String(value) : '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Box 2 / Box 3 */}
          {([
            { title: 'Box 2 · Thành tựu công việc (Business)', box: form.box2, items: boxItems(form.box2, form.box2Items), pct: form.box2?.progress, selfScore: form.box2BusinessScore },
            { title: 'Box 3 · Thành tựu con người (People)', box: form.box3, items: boxItems(form.box3, form.box3Items), pct: form.box3?.progress, selfScore: form.box3PeopleScore },
          ] as const).map(({ title, items, pct, selfScore }, idx) => {
            const prefix = idx === 0 ? 'box2' : 'box3';
            const valueOf = (suffix: string) => (form as any)[prefix + suffix] as string | null | undefined;
            return (
              <div key={title} className="space-y-2">
                <h4 className="text-sm font-bold text-ink border-b border-line pb-1.5 flex items-center justify-between">
                  <span>{title}</span>
                  <span className="text-[11px] font-semibold text-ink-muted">Tiến độ {pct != null ? `${pct}%` : '—'} · Tự chấm {selfScore ?? '—'}</span>
                </h4>

                {items.length > 0 && (
                  <div className="rounded-lg border border-line overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-canvas text-ink-muted">
                          <th className="px-2.5 py-1.5 font-semibold">Mục tiêu / đầu việc</th>
                          <th className="px-2.5 py-1.5 font-semibold text-right w-24">Tiến độ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-2.5 py-1.5 text-ink">{item.title}</td>
                            <td className="px-2.5 py-1.5 text-right font-semibold text-ink">{item.progress}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {GROUP_ITEMS.map((g) => (
                    <TextBlock key={g.suffix} label={g.label} value={valueOf(g.suffix)} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Box 4 */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-ink border-b border-line pb-1.5">Box 4 · Định hướng năm sau</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <TextBlock label="Định hướng" value={form.box4Direction} />
              <TextBlock label="Đề xuất" value={form.box4SelfProposal} />
              <TextBlock label="Khu vực cải thiện" value={form.box4ImprovementArea} />
            </div>
          </div>

          {/* Quản lý chấm */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-ink border-b border-line pb-1.5">Quản lý chấm điểm</h4>
            <div className="grid grid-cols-3 gap-2">
              <ScoreLine label="Điểm Business" value={form.managerBusinessScore} />
              <ScoreLine label="Điểm People" value={form.managerPeopleScore} />
              <ScoreLine label="Điểm TB chính thức" value={form.managerAverageScore} />
            </div>
            <TextBlock label="Nhận xét của Quản lý" value={form.managerComment} />
          </div>
        </div>
      )}
    </Modal>
  );
};
