import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';

export const PolicyDocPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState('shifts');

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Tra Cứu Nội Quy &amp; Quy Chế Lao Động</h1>
            <Badge variant="accent">S19</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Cẩm nang hướng dẫn chế độ chấm công, thời gian biểu làm việc, quyền lợi nghỉ phép và quy định làm từ xa (WFH)
          </p>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="flex flex-wrap gap-2 border-b border-line pb-3">
        <button
          onClick={() => setActiveSection('shifts')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeSection === 'shifts' ? 'bg-accent-soft text-accent border border-accent-line' : 'text-ink-secondary hover:text-ink'
          }`}
        >
          ⏰ Giờ làm việc &amp; Dung sai
        </button>
        <button
          onClick={() => setActiveSection('checkin')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeSection === 'checkin' ? 'bg-accent-soft text-accent border border-accent-line' : 'text-ink-secondary hover:text-ink'
          }`}
        >
          🤳 Chấm công &amp; Xác thực khuôn mặt
        </button>
        <button
          onClick={() => setActiveSection('leaves')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeSection === 'leaves' ? 'bg-accent-soft text-accent border border-accent-line' : 'text-ink-secondary hover:text-ink'
          }`}
        >
          🌴 Chế độ nghỉ phép &amp; Bảo lưu
        </button>
        <button
          onClick={() => setActiveSection('wfh')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeSection === 'wfh' ? 'bg-accent-soft text-accent border border-accent-line' : 'text-ink-secondary hover:text-ink'
          }`}
        >
          🏡 Làm việc từ xa (WFH) &amp; Quên Check-in
        </button>
      </div>

      {/* Content */}
      <Card>
        {activeSection === 'shifts' && (
          <div className="space-y-4 text-xs leading-relaxed text-ink-secondary">
            <h3 className="text-sm font-bold text-ink">1. Thời gian làm việc chuẩn &amp; Chính sách đặc thù</h3>
            <p>
              Hệ thống áp dụng chế độ làm việc 5 ngày / tuần (từ Thứ Hai đến Thứ Sáu), nghỉ Thứ Bảy và Chủ Nhật:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-ink">
              <li><strong>Ca Tiêu Chuẩn:</strong> Bắt đầu từ <strong>08:30</strong> đến <strong>17:30</strong> (8 giờ công thực tế). Nghỉ trưa từ <strong>12:00</strong> đến <strong>13:00</strong>.</li>
              <li><strong>Dung sai cho phép (Grace Period):</strong> Hệ thống cho phép nhân viên check-in trễ tối đa <strong>15 phút</strong> (đến 08:45) mà không bị ghi nhận đi muộn.</li>
              <li><strong>Quota miễn phạt đi muộn:</strong> Mỗi nhân viên được hưởng tối đa <strong>3 lần/tháng</strong> check-in trong khung từ 08:45 - 09:00 mà không bị trừ điểm chuyên cần.</li>
              <li><strong>Chế độ Thai Sản / Nuôi con nhỏ &lt; 12 tháng:</strong> Lao động nữ được giảm 01 giờ làm việc mỗi ngày (làm việc 7 giờ nhưng hưởng trọn vẹn 8 giờ công). Nhân viên có thể lựa chọn ca về sớm (08:30 - 16:30) hoặc vào muộn (09:30 - 17:30).</li>
            </ul>
          </div>
        )}

        {activeSection === 'checkin' && (
          <div className="space-y-4 text-xs leading-relaxed text-ink-secondary">
            <h3 className="text-sm font-bold text-ink">2. Phương thức chấm công &amp; 5 tầng bảo mật chống gian lận</h3>
            <p>
              Để bảo đảm tính minh bạch và công bằng tuyệt đối cho toàn bộ tập thể nhân viên, hệ thống kết hợp 5 tầng kiểm tra song song:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div className="p-3 bg-canvas rounded-lg border border-line">
                <strong className="text-ink">1. Wi-Fi Nội Bộ (BSSID):</strong>
                <p className="mt-1 text-ink-muted">Thiết bị bắt buộc phải kết nối đúng các Router Wi-Fi văn phòng được cấp phép trong danh bạ Whitelist.</p>
              </div>
              <div className="p-3 bg-canvas rounded-lg border border-line">
                <strong className="text-ink">2. GPS Geofencing (Bán kính 100m):</strong>
                <p className="mt-1 text-ink-muted">Tọa độ GPS phải nằm trong phạm vi tòa nhà văn phòng công ty.</p>
              </div>
              <div className="p-3 bg-canvas rounded-lg border border-line">
                <strong className="text-ink">3. AI Face Recognition &amp; Liveness:</strong>
                <p className="mt-1 text-ink-muted">Camera chụp ảnh trực tiếp, kiểm tra liveness chống ảnh in/màn hình và so khớp vector khuôn mặt với ảnh hồ sơ lưu trữ.</p>
              </div>
              <div className="p-3 bg-canvas rounded-lg border border-line">
                <strong className="text-ink">4. Server-Authoritative Timestamp:</strong>
                <p className="mt-1 text-ink-muted">Thời gian chấm công lấy trực tiếp từ đồng hồ nguyên tử của máy chủ Backend, ngăn chặn hành vi chỉnh lùi đồng hồ trên điện thoại.</p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'leaves' && (
          <div className="space-y-4 text-xs leading-relaxed text-ink-secondary">
            <h3 className="text-sm font-bold text-ink">3. Chế độ Nghỉ phép năm &amp; Hạn chót bảo lưu</h3>
            <ul className="list-disc pl-5 space-y-2 text-ink">
              <li><strong>Cấp phép năm:</strong> Mỗi nhân viên chính thức được cấp <strong>12 ngày phép năm / năm</strong> (tương ứng 1 ngày/tháng công tác). Nhân viên làm việc từ 5 năm trở lên được cộng thêm thâm niên theo Luật Lao động.</li>
              <li><strong>Quy định bảo lưu phép:</strong> Số ngày phép chưa sử dụng trong năm tài chính được bảo lưu tối đa <strong>5 ngày</strong> sang quý 1 của năm kế tiếp.</li>
              <li><strong>Hạn chót sử dụng phép tồn:</strong> Toàn bộ số ngày phép bảo lưu sẽ hết hạn sử dụng vào ngày <strong>31/03</strong> hàng năm. Hệ thống sẽ tự động đóng sổ phép cũ từ ngày 01/04.</li>
            </ul>
          </div>
        )}

        {activeSection === 'wfh' && (
          <div className="space-y-4 text-xs leading-relaxed text-ink-secondary">
            <h3 className="text-sm font-bold text-ink">4. Quy chế Làm việc từ xa (WFH) &amp; Giải trình chấm công</h3>
            <ul className="list-disc pl-5 space-y-2 text-ink">
              <li><strong>Hạn mức WFH:</strong> Tối đa <strong>3 ngày / tháng</strong> cho nhân sự khối Kỹ thuật và Dữ liệu. Đơn xin WFH cần gửi trước ít nhất <strong>12 tiếng</strong> để Trưởng nhóm phân bổ kế hoạch.</li>
              <li><strong>Giải trình quên chấm công:</strong> Trong trường hợp máy hỏng hoặc quên quẹt thẻ, nhân viên có thời hạn tối đa <strong>24 giờ</strong> để tạo đơn giải trình kèm minh chứng (commit git, biên bản bảo vệ, xác nhận của đồng nghiệp). Quá 24 giờ hệ thống sẽ tự động khóa ngày công đó thành Vắng mặt (Absent).</li>
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
};
