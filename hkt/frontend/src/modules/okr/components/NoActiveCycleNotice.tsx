import React from 'react';
import { Card } from '../../../components/common/Card';

interface Props {
  /** Gợi ý hành động tuỳ theo vai trò đang xem trang. */
  role?: 'employee' | 'manager';
}

/** Empty state dùng chung khi hệ thống chưa có chu kỳ OKR nào đang hoạt động. */
export const NoActiveCycleNotice: React.FC<Props> = ({ role = 'employee' }) => (
  <Card>
    <div className="p-10 text-center space-y-2">
      <div className="text-3xl">🗓️</div>
      <div className="text-sm font-bold text-ink">Hiện tại không có kỳ OKR nào được thiết lập</div>
      <div className="text-xs text-ink-muted max-w-md mx-auto">
        {role === 'manager'
          ? 'Chưa có chu kỳ OKR đang hoạt động nên chưa có hồ sơ để duyệt, nhận xét hay chấm điểm. '
            + 'Liên hệ HR để tạo và kích hoạt chu kỳ cho năm hiện tại.'
          : 'Chưa có chu kỳ OKR đang hoạt động nên chưa thể thiết lập mục tiêu, cập nhật tiến độ hay tự đánh giá. '
            + 'Liên hệ HR để tạo và kích hoạt chu kỳ cho năm hiện tại.'}
      </div>
    </div>
  </Card>
);
