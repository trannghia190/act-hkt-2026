package com.act.pulse.common.service.impl;

import com.act.pulse.common.service.EmailService;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Properties;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String senderEmail;

    @Value("${spring.mail.host:smtp.gmail.com}")
    private String mailHost;

    /**
     * Chế độ dev: chưa cấu hình SMTP thì in email ra log và vẫn coi là đã gửi.
     * Bật qua {@code MAIL_DEV_LOG=true} (run-local.sh) — mặc định tắt để production
     * không âm thầm bỏ qua email.
     */
    @Value("${app.mail.dev-log:false}")
    private boolean devLogMail;

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss dd/MM/yyyy");
    private static final String SMTP_CONFIG_FILE = ".smtp-config.properties";

    private String lastConfiguredAt = null;
    private String lastConfiguredBy = null;

    @jakarta.annotation.PostConstruct
    public void initPersistedConfig() {
        try {
            File file = new File(SMTP_CONFIG_FILE);
            if (file.exists() && file.isFile()) {
                Properties props = new Properties();
                try (FileInputStream in = new FileInputStream(file)) {
                    props.load(in);
                }
                String host = props.getProperty("mail.host", "smtp.gmail.com");
                int port = Integer.parseInt(props.getProperty("mail.port", "587"));
                String username = props.getProperty("mail.username", "");
                String password = props.getProperty("mail.password", "");
                String configuredAt = props.getProperty("mail.configuredAt", "");
                String configuredBy = props.getProperty("mail.configuredBy", "HR_ADMIN");

                if (username != null && !username.isBlank() && password != null && !password.isBlank()) {
                    if (mailSender instanceof JavaMailSenderImpl impl) {
                        impl.setHost(host);
                        impl.setPort(port);
                        impl.setUsername(username);
                        impl.setPassword(password);
                        Properties mailProps = impl.getJavaMailProperties();
                        mailProps.put("mail.transport.protocol", "smtp");
                        mailProps.put("mail.smtp.auth", "true");
                        mailProps.put("mail.smtp.starttls.enable", "true");
                        mailProps.put("mail.smtp.starttls.required", "true");
                        mailProps.put("mail.smtp.ssl.trust", impl.getHost());
                        mailProps.put("mail.smtp.connectiontimeout", "8000");
                        mailProps.put("mail.smtp.timeout", "8000");
                        mailProps.put("mail.smtp.writetimeout", "8000");
                    }
                    this.senderEmail = username;
                    this.mailHost = host;
                    this.lastConfiguredAt = configuredAt;
                    this.lastConfiguredBy = configuredBy;
                    log.info("Đã nạp lại cấu hình SMTP từ file: sender={}, host={}, port={}, configuredBy={}", username, host, port, configuredBy);
                }
            }
        } catch (Exception ex) {
            log.warn("Lỗi khi nạp lại cấu hình SMTP từ file: {}", ex.getMessage());
        }
    }

    private void persistSmtpConfig(String host, int port, String username, String password, String configuredAt, String configuredBy) {
        try {
            Properties props = new Properties();
            props.setProperty("mail.host", host != null ? host : "smtp.gmail.com");
            props.setProperty("mail.port", String.valueOf(port));
            props.setProperty("mail.username", username != null ? username : "");
            props.setProperty("mail.password", password != null ? password : "");
            props.setProperty("mail.configuredAt", configuredAt != null ? configuredAt : "");
            props.setProperty("mail.configuredBy", configuredBy != null ? configuredBy : "");
            File file = new File(SMTP_CONFIG_FILE);
            try (FileOutputStream out = new FileOutputStream(file)) {
                props.store(out, "Persisted SMTP Configuration for ACT Pulse");
            }
            log.info("Đã lưu cấu hình SMTP bền vững vào file: {}", file.getAbsolutePath());
        } catch (Exception ex) {
            log.warn("Không thể lưu file cấu hình SMTP bền vững: {}", ex.getMessage());
        }
    }

    @Override
    public boolean configureSmtp(String host, int port, String username, String password) {
        return configureSmtp(host, port, username, password, "HR_ADMIN");
    }

    @Override
    public boolean configureSmtp(String host, int port, String username, String password, String configuredBy) {
        try {
            if (mailSender instanceof JavaMailSenderImpl impl) {
                impl.setHost(host != null && !host.isBlank() ? host : "smtp.gmail.com");
                impl.setPort(port > 0 ? port : 587);
                impl.setUsername(username);
                impl.setPassword(password);

                Properties props = impl.getJavaMailProperties();
                props.put("mail.transport.protocol", "smtp");
                props.put("mail.smtp.auth", "true");
                props.put("mail.smtp.starttls.enable", "true");
                props.put("mail.smtp.starttls.required", "true");
                props.put("mail.smtp.ssl.trust", impl.getHost());
                props.put("mail.smtp.connectiontimeout", "8000");
                props.put("mail.smtp.timeout", "8000");
                props.put("mail.smtp.writetimeout", "8000");

                this.senderEmail = username;
                this.mailHost = impl.getHost();
                this.lastConfiguredAt = LocalDateTime.now().format(TIME_FORMATTER);
                this.lastConfiguredBy = (configuredBy != null && !configuredBy.isBlank()) ? configuredBy : "HR_ADMIN";

                persistSmtpConfig(impl.getHost(), impl.getPort(), username, password, this.lastConfiguredAt, this.lastConfiguredBy);

                log.info("Cập nhật cấu hình SMTP thành công cho host: {}, port: {}, sender: {} bởi {}", host, port, username, this.lastConfiguredBy);
                return true;
            }
            return false;
        } catch (Exception e) {
            log.error("Lỗi khi cấu hình SMTP: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public boolean isSmtpConfigured() {
        if (mailSender instanceof JavaMailSenderImpl impl) {
            return impl.getUsername() != null && !impl.getUsername().isBlank()
                    && impl.getPassword() != null && !impl.getPassword().isBlank();
        }
        return senderEmail != null && !senderEmail.isBlank();
    }

    @Override
    public boolean isMailDeliverable() {
        return isSmtpConfigured() || devLogMail;
    }

    @Override
    public String getSenderEmail() {
        if (mailSender instanceof JavaMailSenderImpl impl && impl.getUsername() != null && !impl.getUsername().isBlank()) {
            return impl.getUsername();
        }
        return senderEmail != null ? senderEmail : "Chưa cấu hình";
    }

    @Override
    public String getLastConfiguredAt() {
        return lastConfiguredAt;
    }

    @Override
    public String getLastConfiguredBy() {
        return lastConfiguredBy;
    }

    // =========================================================================
    // 1. ACCOUNT ACTIVATION & FIRST LOGIN PASSWORD CHANGE
    // =========================================================================
    @Override
    public boolean sendAccountActivationEmail(String toEmail, String fullName, String employeeCode, String temporaryPassword) {
        String subject = "[ACT PULSE] Thông Báo Khởi Tạo Tài Khoản Nhân Viên & Kích Hoạt Lần Đầu";
        String preheader = "Kính gửi " + fullName + ", tài khoản của bạn đã được khởi tạo trên hệ thống ACT PULSE. Vui lòng kích hoạt trong 24 giờ.";

        String body = String.format("""
            <p style="font-size: 15px; margin-top: 0;">Kính gửi <strong>%s</strong>,</p>
            <p style="color: #334155;">Bộ phận Nhân sự trân trọng thông báo: Tài khoản làm việc của Anh/Chị trên hệ thống quản trị nhân sự tập trung <strong>ACT PULSE</strong> đã được khởi tạo thành công.</p>
            
            <!-- Credentials Card -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
                <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                    📋 THÔNG TIN ĐĂNG NHẬP KHỞI TẠO
                </div>
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%%" style="font-size: 14px;">
                    <tr>
                        <td style="padding: 7px 0; color: #64748b; width: 140px;">Mã nhân viên:</td>
                        <td style="padding: 7px 0; font-family: monospace; font-weight: 700; color: #047857; font-size: 15px;">%s</td>
                    </tr>
                    <tr>
                        <td style="padding: 7px 0; color: #64748b;">Email đăng nhập:</td>
                        <td style="padding: 7px 0; font-weight: 600; color: #0f172a;">%s</td>
                    </tr>
                    <tr>
                        <td style="padding: 7px 0; color: #64748b;">Mật khẩu tạm thời:</td>
                        <td style="padding: 7px 0;">
                            <span style="font-family: 'JetBrains Mono', Consolas, Monaco, monospace; font-weight: 800; background-color: #e2e8f0; color: #0f172a; padding: 4px 10px; border-radius: 6px; font-size: 15px; letter-spacing: 1px; border: 1px solid #cbd5e1;">%s</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 7px 0; color: #64748b;">Trạng thái tài khoản:</td>
                        <td style="padding: 7px 0;">
                            <span style="background-color: #fef3c7; color: #92400e; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; border: 1px solid #fde68a;">Chờ đổi mật khẩu lần đầu</span>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Security Notice Box -->
            <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 14px 16px; margin: 20px 0; font-size: 13px; color: #78350f; line-height: 1.5;">
                <strong>🛡️ Yêu cầu bảo mật bắt buộc:</strong><br>
                Nhằm tuân thủ chính sách an toàn thông tin nội bộ, Anh/Chị sẽ được hệ thống tự động hướng dẫn:
                <ul style="margin: 6px 0 0 0; padding-left: 20px;">
                    <li><strong>Bước 1:</strong> Thiết lập mật khẩu mới (tối thiểu 8 ký tự, gồm chữ hoa, số &amp; ký tự đặc biệt).</li>
                    <li><strong>Bước 2:</strong> Hoàn tất đăng ký khuôn mặt sinh trắc học (Face Biometric) để sẵn sàng điểm danh ca làm việc.</li>
                </ul>
            </div>
            """, fullName, employeeCode, toEmail, temporaryPassword);

        String htmlContent = buildMasterHtml(
                preheader,
                "linear-gradient(135deg, #064e3b 0%%, #047857 100%%)",
                "ONBOARDING",
                "Chào Mừng Thành Viên Mới!",
                "Kích hoạt tài khoản nhân viên & Đổi mật khẩu lần đầu",
                body,
                "ĐĂNG NHẬP & KÍCH HOẠT TÀI KHOẢN NGAY →",
                "http://localhost:3000/login"
        );

        return sendHtmlEmail(toEmail, subject, htmlContent);
    }

    // =========================================================================
    // 2. PASSWORD RESET OTP VIA GMAIL
    // =========================================================================
    @Override
    public boolean sendPasswordResetEmail(String toEmail, String fullName, String resetToken) {
        String subject = "[ACT PULSE] Mã Xác Thực OTP Đặt Lại Mật Khẩu";
        String preheader = "Mã OTP xác thực đặt lại mật khẩu của bạn là " + resetToken + " (hiệu lực 15 phút).";

        String body = String.format("""
            <p style="font-size: 15px; margin-top: 0;">Kính gửi <strong>%s</strong>,</p>
            <p style="color: #334155;">Hệ thống ACT PULSE vừa tiếp nhận yêu cầu đặt lại mật khẩu cho tài khoản liên kết với địa chỉ email <strong>%s</strong>.</p>
            
            <!-- OTP Block -->
            <div style="background-color: #f0fdf4; border: 2px dashed #86efac; border-radius: 14px; padding: 24px 20px; text-align: center; margin: 24px 0;">
                <div style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 1px;">
                    MÃ XÁC THỰC BẢO MẬT (OTP)
                </div>
                <div style="font-family: 'JetBrains Mono', Consolas, Monaco, monospace; font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #047857; margin: 12px 0;">
                    %s
                </div>
                <div style="display: inline-block; background-color: #dcfce7; color: #15803d; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px;">
                    ⏳ Hiệu lực trong vòng 15 phút
                </div>
            </div>

            <!-- Caution Note -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 12px; color: #64748b; line-height: 1.6;">
                <strong>⚠️ Khuyến cáo bảo mật:</strong><br>
                • Tuyệt đối <strong>không chia sẻ</strong> mã OTP này cho bất kỳ ai, kể cả nhân sự hoặc kỹ thuật viên.<br>
                • Nếu Anh/Chị không gửi yêu cầu này, rất có thể ai đó đang cố tình truy cập tài khoản của bạn. Vui lòng bỏ qua email và thông báo ngay cho Quản trị viên hệ thống để phong tỏa tài khoản kịp thời.
            </div>
            """, fullName, toEmail, resetToken);

        String htmlContent = buildMasterHtml(
                preheader,
                "linear-gradient(135deg, #0369a1 0%%, #0284c7 100%%)",
                "SECURITY",
                "Xác Thực Đặt Lại Mật Khẩu",
                "Mã bảo mật OTP gửi qua Gmail Doanh Nghiệp",
                body,
                "TRUY CẬP TRANG ĐẶT LẠI MẬT KHẨU →",
                "http://localhost:3000/forgot-password"
        );

        return sendHtmlEmail(toEmail, subject, htmlContent);
    }

    // =========================================================================
    // 2.1. PASSWORD CHANGED / RESET CONFIRMATION VIA GMAIL
    // =========================================================================
    @Override
    public boolean sendPasswordChangedSuccessEmail(String toEmail, String fullName, String changeType) {
        String subject = "[ACT PULSE] Xác Nhận Thay Đổi Mật Khẩu Tài Khoản Thành Công";
        String preheader = "Mật khẩu tài khoản ACT PULSE của " + fullName + " vừa được cập nhật thành công.";
        String timeStr = java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss dd/MM/yyyy"));

        String body = String.format("""
            <p style="font-size: 15px; margin-top: 0;">Kính gửi <strong>%s</strong>,</p>
            <p style="color: #334155;">Hệ thống ACT PULSE xin thông báo: Mật khẩu truy cập hệ thống của Anh/Chị đã được <strong>cập nhật thành công</strong>.</p>

            <!-- Success Box -->
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%%" style="font-size: 13px;">
                    <tr>
                        <td style="padding: 6px 0; color: #166534; width: 150px; font-weight: 600;">Hình thức thay đổi:</td>
                        <td style="padding: 6px 0; font-weight: 700; color: #047857;">%s</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #166534; font-weight: 600;">Thời điểm ghi nhận:</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">%s</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #166534; font-weight: 600;">Hộp thư nhận thông báo:</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">%s</td>
                    </tr>
                </table>
            </div>

            <!-- Session Revocation Notice -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 12px; color: #64748b; line-height: 1.6;">
                <strong>🔒 Cơ chế bảo vệ phiên đăng nhập:</strong><br>
                Theo chính sách bảo mật của ACT PULSE, khi mật khẩu thay đổi, <strong>toàn bộ các phiên làm việc cũ</strong> trên các thiết bị và trình duyệt khác đều tự động bị vô hiệu hóa và thu hồi. Vui lòng sử dụng mật khẩu mới để đăng nhập lại.
            </div>

            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-top: 14px; font-size: 12px; color: #991b1b; line-height: 1.5;">
                <strong>⚠️ Cảnh báo an ninh:</strong> Nếu Anh/Chị <strong>KHÔNG</strong> thực hiện yêu cầu thay đổi mật khẩu này, hãy liên hệ ngay lập tức với Quản trị viên hệ thống hoặc Bộ phận Nhân sự để khóa tài khoản khẩn cấp.
            </div>
            """, fullName, changeType != null ? changeType : "Đổi mật khẩu người dùng", timeStr, toEmail);

        String htmlContent = buildMasterHtml(
                preheader,
                "linear-gradient(135deg, #065f46 0%%, #059669 100%%)",
                "SECURITY",
                "Mật Khẩu Đã Được Thay Đổi",
                "Xác nhận thay đổi bảo mật tài khoản thành công",
                body,
                "ĐĂNG NHẬP BẰNG MẬT KHẨU MỚI →",
                "http://localhost:3000/login"
        );

        return sendHtmlEmail(toEmail, subject, htmlContent);
    }

    // =========================================================================
    // 3. REQUEST DECISION NOTIFICATION (APPROVED / REJECTED)
    // =========================================================================
    @Override
    public void sendRequestDecisionNotification(String toEmail, String fullName, String requestId, String requestType, String decision, String approverName, String approverComment) {
        boolean isApproved = "APPROVED".equalsIgnoreCase(decision);
        String statusText = isApproved ? "ĐÃ ĐƯỢC PHÊ DUYỆT" : "BỊ TỪ CHỐI";
        String statusColor = isApproved ? "#047857" : "#b91c1c";
        String statusBg = isApproved ? "#ecfdf5" : "#fef2f2";
        String statusBorder = isApproved ? "#a7f3d0" : "#fecaca";
        String headerGradient = isApproved
                ? "linear-gradient(135deg, #064e3b 0%%, #047857 100%%)"
                : "linear-gradient(135deg, #7f1d1d 0%%, #b91c1c 100%%)";

        String subject = String.format("[ACT PULSE] Kết Quả Xét Duyệt Đơn: %s — %s", requestId, statusText);
        String preheader = "Đơn yêu cầu " + requestId + " (" + requestType + ") của bạn đã " + (isApproved ? "được phê duyệt thành công." : "bị từ chối bởi cấp quản lý.");

        String body = String.format("""
            <p style="font-size: 15px; margin-top: 0;">Kính gửi <strong>%s</strong>,</p>
            <p style="color: #334155;">Cấp quản lý đã tiến hành xem xét và đưa ra kết quả xử lý đối với đơn yêu cầu của Anh/Chị trên hệ thống ACT PULSE:</p>

            <!-- Status Pill Banner -->
            <div style="background-color: %s; border: 1px solid %s; border-radius: 10px; padding: 14px 18px; margin: 20px 0; text-align: center;">
                <span style="font-size: 16px; font-weight: 800; color: %s; letter-spacing: 0.5px;">
                    %s %s
                </span>
            </div>

            <!-- Details Card -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 20px 0; font-size: 13px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%%">
                    <tr>
                        <td style="padding: 6px 0; color: #64748b; width: 140px;">Mã số đơn:</td>
                        <td style="padding: 6px 0; font-family: monospace; font-weight: 700; color: #0f172a; font-size: 14px;">%s</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #64748b;">Loại yêu cầu:</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">%s</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #64748b;">Người phê duyệt:</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #047857;">%s</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #64748b;">Thời gian xử lý:</td>
                        <td style="padding: 6px 0; color: #475569;">%s</td>
                    </tr>
                </table>
            </div>

            <!-- Approver Comment Card -->
            <div style="margin: 20px 0;">
                <div style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px;">Ý KIẾN / LÝ DO PHÊ DUYỆT:</div>
                <div style="background-color: #ffffff; border-left: 4px solid %s; border: 1px solid #e2e8f0; border-left-width: 4px; border-left-color: %s; padding: 14px 18px; border-radius: 0 8px 8px 0; font-style: italic; color: #1e293b; font-size: 13px; line-height: 1.6;">
                    "%s"
                </div>
            </div>

            <p style="font-size: 13px; color: #64748b;">Dữ liệu bảng công và quỹ phép cá nhân liên quan đã được tự động đồng bộ hóa tương ứng với kết quả này.</p>
            """,
                fullName,
                statusBg, statusBorder, statusColor,
                (isApproved ? "✓" : "✕"), statusText,
                requestId, requestType, approverName, LocalDateTime.now().format(TIME_FORMATTER),
                statusColor, statusColor,
                approverComment != null && !approverComment.isBlank() ? approverComment : "Không có ghi chú thêm từ người duyệt."
        );

        String htmlContent = buildMasterHtml(
                preheader,
                headerGradient,
                isApproved ? "PHÊ DUYỆT" : "TỪ CHỐI",
                "Thông Báo Kết Quả Xử Lý Đơn",
                "Đơn yêu cầu: " + requestId + " (" + requestType + ")",
                body,
                "XEM CHI TIẾT ĐƠN TRÊN HỆ THỐNG →",
                "http://localhost:3000/attendance/requests"
        );

        sendHtmlEmail(toEmail, subject, htmlContent);
    }

    // =========================================================================
    // 3b. THÔNG BÁO SỰ KIỆN TỔNG QUÁT (kênh email của tuỳ chỉnh S36)
    // =========================================================================
    @Override
    public boolean sendEventEmail(String toEmail, String fullName, String title, String content, String actionUrl) {
        if (toEmail == null || toEmail.isBlank()) return false;
        String subject = "[ACT PULSE] " + (title == null ? "Thông báo" : title);
        String link = actionUrl == null || actionUrl.isBlank() ? "" : actionUrl;
        String htmlContent = """
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
              <div style="background: linear-gradient(135deg, #064e3b 0%%, #047857 100%%); padding: 20px 24px; color: #ffffff;">
                <div style="font-size: 13px; opacity: 0.85;">ACT PULSE · Thông báo</div>
                <div style="font-size: 18px; font-weight: 800; margin-top: 4px;">%s</div>
              </div>
              <div style="padding: 20px 24px; color: #334155; font-size: 14px; line-height: 1.6;">
                <p>Kính gửi <strong>%s</strong>,</p>
                <p style="margin: 12px 0;">%s</p>
                %s
              </div>
              <div style="padding: 12px 24px; background: #f8fafc; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0;">
                Bạn nhận được email này vì đang bật kênh Email cho loại thông báo này trong Tuỳ chỉnh thông báo cá nhân.
              </div>
            </div>
            """.formatted(
                title == null ? "Thông báo" : title,
                fullName == null ? "" : fullName,
                content == null ? "" : content,
                link.isEmpty() ? ""
                        : "<a href=\"%s\" style=\"display:inline-block;margin-top:8px;padding:10px 16px;background:#047857;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;\">Mở trong hệ thống →</a>".formatted(link));
        return sendHtmlEmail(toEmail, subject, htmlContent);
    }

    // =========================================================================
    // 4. DAILY MORNING DIGEST (08:00 AM)
    // =========================================================================
    @Override
    public boolean sendDailyDigestEmail(String toEmail, String fullName, List<Map<String, Object>> tasks, Map<String, Object> leaveSummary) {
        String subject = "[ACT PULSE] Bản Tin Công Việc Buổi Sáng · 08:00 AM";
        String preheader = "Bản tin 08:00: Bạn có " + (tasks != null ? tasks.size() : 0) + " việc cần xử lý và số dư phép năm hiện tại.";

        StringBuilder tasksHtml = new StringBuilder();
        if (tasks == null || tasks.isEmpty()) {
            tasksHtml.append("""
                <div style="text-align: center; padding: 24px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">
                    🎉 Hôm nay bạn không có công việc nào tồn đọng cần xử lý!
                </div>
            """);
        } else {
            tasksHtml.append("<div style=\"margin: 16px 0;\">");
            for (Map<String, Object> t : tasks) {
                String title = String.valueOf(t.getOrDefault("title", "Nhiệm vụ"));
                String desc = String.valueOf(t.getOrDefault("description", ""));
                String urgency = String.valueOf(t.getOrDefault("urgency", "today"));
                String badgeColor = "overdue".equals(urgency) ? "#e11d48" : "soon".equals(urgency) ? "#d97706" : "#059669";
                String badgeBg = "overdue".equals(urgency) ? "#ffe4e6" : "soon".equals(urgency) ? "#fef3c7" : "#dcfce7";
                String badgeText = "overdue".equals(urgency) ? "Quá hạn" : "soon".equals(urgency) ? "Sắp hạn" : "Hôm nay";

                tasksHtml.append(String.format("""
                    <div style="border-left: 3px solid %s; background-color: #f8fafc; padding: 12px 14px; margin-bottom: 10px; border-radius: 0 8px 8px 0; border: 1px solid #e2e8f0; border-left-width: 3px; border-left-color: %s;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 700; font-size: 13px; color: #0f172a;">%s</span>
                            <span style="background-color: %s; color: %s; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; text-transform: uppercase;">%s</span>
                        </div>
                        <div style="font-size: 12px; color: #475569; margin-top: 4px;">%s</div>
                    </div>
                """, badgeColor, badgeColor, title, badgeBg, badgeColor, badgeText, desc));
            }
            tasksHtml.append("</div>");
        }

        String leaveHtml = "";
        if (leaveSummary != null) {
            Object total = leaveSummary.getOrDefault("totalRemaining", 10.5);
            Object carried = leaveSummary.getOrDefault("carriedRemaining", 3.5);
            Object annual = leaveSummary.getOrDefault("annualRemaining", 7.0);
            leaveHtml = String.format("""
                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 18px; margin: 20px 0;">
                    <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">🌴 THÔNG TIN PHÉP NĂM CÁ NHÂN</div>
                    <div style="font-size: 18px; font-weight: 800; color: #047857; margin-top: 4px;">
                        %s ngày phép khả dụng
                    </div>
                    <div style="font-size: 12px; color: #15803d; margin-top: 2px;">
                        (Phép tồn 2025: <strong>%s</strong> ngày · Phép năm 2026: <strong>%s</strong> ngày)
                    </div>
                </div>
            """, total, carried, annual);
        }

        String body = String.format("""
            <p style="font-size: 15px; margin-top: 0;">Chào buổi sáng <strong>%s</strong>,</p>
            <p style="color: #334155;">Đây là bản tin tổng hợp tự động lúc 08:00 sáng, giúp bạn nắm bắt nhanh các nhiệm vụ chấm công, đơn từ và cập nhật OKR cần xử lý trong ngày:</p>
            
            %s
            %s
            
            <p style="font-size: 12px; color: #64748b;">Chính sách chống spam: Hệ thống chỉ gửi tối đa 1 email digest mỗi ngày vào 08:00 sáng để bảo vệ sự tập trung của bạn.</p>
            """, fullName, tasksHtml, leaveHtml);

        String htmlContent = buildMasterHtml(
                preheader,
                "linear-gradient(135deg, #0f172a 0%%, #1e293b 100%%)",
                "BẢN TIN 08:00",
                "Bản Tin Công Việc Buổi Sáng",
                "Nhiệm vụ trong ngày & Số dư phép năm",
                body,
                "MỞ TRANG CẦN LÀM (TODO INBOX) →",
                "http://localhost:3000/todo"
        );

        return sendHtmlEmail(toEmail, subject, htmlContent);
    }

    // =========================================================================
    // 5. SLA ESCALATION EMAIL (> 48 HOURS)
    // =========================================================================
    @Override
    public void sendSlaEscalationEmail(String toEmail, String managerName, String requestId, String employeeName, String requestType, long elapsedHours) {
        String subject = String.format("[ACT PULSE - KHẨN] Cảnh Báo Quá Hạn Phê Duyệt Đơn %s (> %dh)", requestId, elapsedHours);
        String preheader = "Cảnh báo khẩn: Đơn " + requestId + " của " + employeeName + " đã quá hạn SLA " + elapsedHours + " giờ.";

        String body = String.format("""
            <p style="font-size: 15px; margin-top: 0;">Kính gửi Quản lý <strong>%s</strong>,</p>
            <p style="color: #334155;">Hệ thống ACT PULSE phát hiện đơn yêu cầu dưới đây đã chờ phê duyệt quá thời hạn cam kết dịch vụ (SLA &gt; 48 giờ) và cần được xử lý khẩn cấp:</p>

            <!-- Alert Card -->
            <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-left: 4px solid #e11d48; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <div style="font-size: 12px; font-weight: 800; color: #be123c; text-transform: uppercase;">
                    ⚠️ CẢNH BÁO QUÁ HẠN SLA PHÊ DUYỆT
                </div>
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%%" style="font-size: 13px; margin-top: 10px;">
                    <tr>
                        <td style="padding: 4px 0; color: #881337; width: 140px;">Mã đơn:</td>
                        <td style="padding: 4px 0; font-family: monospace; font-weight: 700; color: #0f172a;">%s</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; color: #881337;">Nhân viên gửi:</td>
                        <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">%s</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; color: #881337;">Loại yêu cầu:</td>
                        <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">%s</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; color: #881337;">Thời gian chờ duyệt:</td>
                        <td style="padding: 4px 0; font-weight: 800; color: #be123c;">%d giờ (Quá SLA 48h)</td>
                    </tr>
                </table>
            </div>

            <p style="font-size: 13px; color: #475569;">Theo Quy định số 12 (Quy tắc luồng duyệt &amp; SLA), nếu đơn tiếp tục quá hạn sau mốc 72 giờ, hệ thống sẽ tự động chuyển tiếp hồ sơ lên Cấp trên trực tiếp (Manager + 1) và thông báo tới Phòng Nhân sự.</p>
            """, managerName, requestId, employeeName, requestType, elapsedHours);

        String htmlContent = buildMasterHtml(
                preheader,
                "linear-gradient(135deg, #881337 0%%, #be123c 100%%)",
                "CẢNH BÁO SLA",
                "Cảnh Báo Quá Hạn Phê Duyệt Đơn",
                "Yêu cầu cấp bách: Đơn chờ xử lý quá hạn SLA 48h",
                body,
                "PHÊ DUYỆT ĐƠN NÀY NGAY TRÊN TODO INBOX →",
                "http://localhost:3000/todo"
        );

        sendHtmlEmail(toEmail, subject, htmlContent);
    }

    // =========================================================================
    // 6. SMTP CONNECTION TEST EMAIL
    // =========================================================================
    @Override
    public boolean sendTestEmail(String toEmail, String message) {
        String subject = "[ACT PULSE] Kiểm Tra Kết Nối Gmail Doanh Nghiệp Thành Công";
        String preheader = "Xác nhận kết nối máy chủ gửi thư Gmail SMTP của ACT PULSE hoạt động hoàn hảo.";

        String body = String.format("""
            <p style="font-size: 15px; margin-top: 0;">Xin chào Quản trị viên,</p>
            <p style="color: #334155;">Thư này được gửi trực tiếp từ máy chủ <strong>ACT PULSE (Spring Boot 3)</strong> nhằm kiểm tra tính tương thích và độ tin cậy của cấu hình gửi thư qua giao thức Gmail SMTP Doanh nghiệp.</p>

            <!-- Diagnostics Card -->
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 24px 0;">
                <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px; border-bottom: 1px solid #bbf7d0; padding-bottom: 8px;">
                    ✓ THÔNG SỐ CHẨN ĐOÁN KẾT NỐI
                </div>
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%%" style="font-size: 13px;">
                    <tr>
                        <td style="padding: 5px 0; color: #166534; width: 140px;">Địa chỉ nhận kiểm thử:</td>
                        <td style="padding: 5px 0; font-weight: 700; color: #047857;">%s</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0; color: #166534;">Máy chủ SMTP:</td>
                        <td style="padding: 5px 0; font-family: monospace; color: #0f172a;">%s:587 (TLS v1.3)</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0; color: #166534;">Thông điệp thử nghiệm:</td>
                        <td style="padding: 5px 0; font-style: italic; color: #0f172a;">"%s"</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0; color: #166534;">Thời điểm gửi:</td>
                        <td style="padding: 5px 0; color: #0f172a;">%s</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0; color: #166534;">Trạng thái dịch vụ:</td>
                        <td style="padding: 5px 0;">
                            <span style="background-color: #dcfce7; color: #15803d; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 10px;">HOẠT ĐỘNG HOÀN HẢO (ONLINE)</span>
                        </td>
                    </tr>
                </table>
            </div>

            <p style="font-size: 13px; color: #334155; line-height: 1.6;">
                Kể từ thời điểm này, tất cả các luồng thông báo tự động (Cấp tài khoản mới, Gửi OTP đặt lại mật khẩu, Phê duyệt đơn từ, Bản tin 08:00 sáng) sẽ được chuyển giao tức thời và an toàn vào hòm thư Gmail của cán bộ nhân viên.
            </p>
            """, toEmail, mailHost, message, LocalDateTime.now().format(TIME_FORMATTER));

        String htmlContent = buildMasterHtml(
                preheader,
                "linear-gradient(135deg, #065f46 0%%, #047857 100%%)",
                "KIỂM THỬ KẾT NỐI",
                "Kết Nối Gmail SMTP Thành Công",
                "Hệ thống gửi thư tự động ACT PULSE đã sẵn sàng",
                body,
                "TRUY CẬP TRANG QUẢN TRỊ ACT PULSE →",
                "http://localhost:3000/admin/users"
        );

        return sendHtmlEmail(toEmail, subject, htmlContent);
    }

    // =========================================================================
    // MASTER HTML EMAIL BUILDER (Clean, Responsive, Corporate Identity)
    // =========================================================================
    private String buildMasterHtml(String preheader, String headerGradient, String categoryPill,
                                   String heroTitle, String heroSubtitle, String bodyHtml,
                                   String ctaText, String ctaUrl) {

        String ctaBlock = "";
        if (ctaText != null && !ctaText.isBlank() && ctaUrl != null && !ctaUrl.isBlank()) {
            ctaBlock = String.format("""
                <div style="text-align: center; margin: 32px 0 16px 0;">
                    <a href="%s" style="background-color: #047857; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(4, 120, 87, 0.3); letter-spacing: 0.3px;">
                        %s
                    </a>
                </div>
            """, ctaUrl, ctaText);
        }

        return String.format("""
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>ACT PULSE Enterprise</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; line-height: 1.6;">
                <!-- Preheader snippet -->
                <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;">
                    %s
                </div>

                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%%" style="background-color: #f1f5f9; padding: 32px 12px;">
                    <tr>
                        <td align="center">
                            <!-- Main Container Card -->
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04); border: 1px solid #e2e8f0;">
                                <!-- Header Banner -->
                                <tr>
                                    <td style="background: %s; padding: 32px 36px; color: #ffffff;">
                                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%%">
                                            <tr>
                                                <td>
                                                    <div style="display: inline-block; font-size: 22px; font-weight: 900; letter-spacing: 0.5px; color: #ffffff;">
                                                        ACT <span style="color: #6ee7b7;">PULSE</span>
                                                    </div>
                                                    <span style="display: inline-block; margin-left: 10px; background: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 10px; font-weight: 800; padding: 3px 9px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.8px; vertical-align: middle;">
                                                        %s
                                                    </span>
                                                </td>
                                                <td align="right" style="font-size: 11px; opacity: 0.85; font-family: monospace; color: #e2e8f0;">
                                                    🔒 NỘI BỘ BẢO MẬT
                                                </td>
                                            </tr>
                                            <tr>
                                                <td colspan="2" style="padding-top: 18px;">
                                                    <h1 style="margin: 0; font-size: 21px; font-weight: 800; line-height: 1.35; color: #ffffff;">%s</h1>
                                                    <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; color: #e2e8f0;">%s</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Body Content -->
                                <tr>
                                    <td style="padding: 32px 36px 28px 36px; color: #1e293b; font-size: 14px; line-height: 1.65;">
                                        %s
                                        %s
                                    </td>
                                </tr>

                                <!-- Corporate Footer -->
                                <tr>
                                    <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 36px; font-size: 12px; color: #64748b; line-height: 1.6;">
                                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%%">
                                            <tr>
                                                <td>
                                                    <strong style="color: #334155; font-size: 13px;">Hệ Thống Quản Trị Nhân Sự &amp; Hiệu Suất ACT PULSE</strong>
                                                    <div style="margin-top: 4px; color: #475569;">CÔNG TY CỔ PHẦN CÔNG NGHỆ VÀ TRUYỀN THÔNG ACT</div>
                                                    <div style="margin-top: 2px;">Tầng 12, Tòa nhà ACT Tower, Phố Duy Tân, Cầu Giấy, Hà Nội</div>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding-top: 14px; border-top: 1px dashed #cbd5e1; margin-top: 14px;">
                                                    <div style="font-size: 11px; color: #94a3b8; line-height: 1.5;">
                                                        • Thư điện tử tự động từ máy chủ ACT PULSE. Vui lòng không trả lời thư này (No-reply).<br>
                                                        • Cần hỗ trợ? Bộ phận Nhân sự: <a href="mailto:hr@act.vn" style="color: #047857; font-weight: 600; text-decoration: none;">hr@act.vn</a> · Hotline kỹ thuật: <strong style="color: #0f172a;">1900 6868</strong>.<br>
                                                        • Cam kết bảo mật: ACT PULSE không bao giờ yêu cầu bạn cung cấp mật khẩu qua điện thoại hoặc tin nhắn.
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """,
                preheader != null ? preheader : "Thông báo từ ACT PULSE",
                headerGradient,
                categoryPill,
                heroTitle,
                heroSubtitle,
                bodyHtml,
                ctaBlock
        );
    }

    private boolean sendHtmlEmail(String toEmail, String subject, String htmlContent) {
        if (toEmail == null || toEmail.isBlank()) {
            log.error("Không thể gửi email: Địa chỉ người nhận trống");
            return false;
        }

        if (!isSmtpConfigured()) {
            if (!devLogMail) {
                log.warn("Bỏ qua email tới {} ({}): SMTP chưa cấu hình và MAIL_DEV_LOG đang tắt.",
                        toEmail, subject);
                return false;
            }
            // Dev-log: không gửi thật, in nội dung để kiểm thử luồng mà không cần SMTP.
            log.info("[MAIL DEV-LOG] Tới: {} | Tiêu đề: {}\n{}", toEmail, subject, htmlContent);
            return true;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            String from = (senderEmail != null && !senderEmail.isBlank()) ? senderEmail : "act.pulse.hr@gmail.com";
            helper.setFrom(from, "ACT PULSE Notification System");
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);

            mailSender.send(message);
            log.info("Email đã được gửi thành công tới: {} qua Gmail SMTP với tiêu đề: {}", toEmail, subject);
            return true;
        } catch (Exception e) {
            log.error("Lỗi khi gửi email tới {}: {}", toEmail, e.getMessage());
            // Log fallback so QA can still inspect email content in logs if needed
            log.info("NỘI DUNG EMAIL GỬI TỚI {}: {}", toEmail, htmlContent);
            return false;
        }
    }
}
