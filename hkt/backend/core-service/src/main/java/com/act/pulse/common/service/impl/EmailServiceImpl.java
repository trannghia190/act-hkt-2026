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

    @Override
    public boolean configureSmtp(String host, int port, String username, String password) {
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
                log.info("Cập nhật cấu hình SMTP thành công cho host: {}, port: {}, sender: {}", host, port, username);
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
    public String getSenderEmail() {
        if (mailSender instanceof JavaMailSenderImpl impl && impl.getUsername() != null && !impl.getUsername().isBlank()) {
            return impl.getUsername();
        }
        return senderEmail != null ? senderEmail : "Chưa cấu hình";
    }

    @Override
    public void sendAccountActivationEmail(String toEmail, String fullName, String employeeCode, String temporaryPassword) {
        String subject = "[ACT PULSE] Kích hoạt tài khoản nhân viên & Đổi mật khẩu lần đầu";
        String content = String.format("""
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
                <div style="background: linear-gradient(135deg, #15803d, #166534); padding: 20px; border-radius: 8px; color: white; text-align: center;">
                    <h2 style="margin: 0; font-size: 20px; font-weight: 700;">ACT PULSE — Hệ Thống Quản Trị Nhân Sự & OKR</h2>
                    <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Thông Báo Kích Hoạt Tài Khoản Mới</p>
                </div>
                <div style="padding: 24px 0; line-height: 1.6;">
                    <p style="font-size: 15px;">Kính gửi <strong>%s</strong>,</p>
                    <p>Bộ phận Nhân sự đã khởi tạo tài khoản làm việc của bạn trên hệ thống quản trị nhân sự tập trung <strong>ACT PULSE</strong>.</p>
                    <div style="background-color: #f8fafc; padding: 18px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                        <p style="margin: 6px 0;">• <strong>Mã nhân viên:</strong> <span style="font-family: monospace; font-weight: bold; color: #15803d; font-size: 14px;">%s</span></p>
                        <p style="margin: 6px 0;">• <strong>Email đăng nhập:</strong> <span style="font-weight: 600;">%s</span></p>
                        <p style="margin: 6px 0;">• <strong>Mật khẩu tạm thời:</strong> <span style="font-family: monospace; font-weight: bold; background: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 15px; color: #0f172a;">%s</span></p>
                    </div>
                    <p style="color: #b45309; background: #fffbeb; padding: 12px; border-radius: 6px; font-size: 12px; border: 1px solid #fef3c7;">
                        ⚠️ <strong>Lưu ý bảo mật:</strong> Để đảm bảo an toàn thông tin, bạn bắt buộc phải đăng nhập và đổi mật khẩu mới trong lần đầu tiên truy cập.
                    </p>
                    <div style="text-align: center; margin: 28px 0;">
                        <a href="http://localhost:3000/login" style="background-color: #15803d; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">Đăng Nhập & Kích Hoạt Ngay</a>
                    </div>
                </div>
                <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #64748b; text-align: center;">
                    Email này được gửi tự động từ Hệ thống ACT PULSE Doanh Nghiệp. Vui lòng không trả lời thư này.
                </div>
            </div>
            """, fullName, employeeCode, toEmail, temporaryPassword);

        sendHtmlEmail(toEmail, subject, content);
    }

    @Override
    public void sendPasswordResetEmail(String toEmail, String fullName, String resetToken) {
        String subject = "[ACT PULSE] Yêu cầu đặt lại mật khẩu tài khoản";
        String content = String.format("""
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
                <div style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 20px; border-radius: 8px; color: white; text-align: center;">
                    <h2 style="margin: 0; font-size: 20px; font-weight: 700;">ACT PULSE — Đặt Lại Mật Khẩu</h2>
                    <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Xác thực tài khoản qua Gmail</p>
                </div>
                <div style="padding: 24px 0; line-height: 1.6;">
                    <p style="font-size: 15px;">Xin chào <strong>%s</strong>,</p>
                    <p>Hệ thống nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với địa chỉ email <strong>%s</strong>.</p>
                    <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #bbf7d0; text-align: center;">
                        <p style="margin: 0; font-size: 13px; color: #166534; font-weight: 600;">MÃ XÁC THỰC OTP (HIỆU LỰC 15 PHÚT):</p>
                        <p style="margin: 12px 0 0 0; font-family: monospace; font-size: 32px; letter-spacing: 8px; font-weight: 800; color: #15803d;">%s</p>
                    </div>
                    <p style="font-size: 12px; color: #64748b;">Nếu bạn không yêu cầu đặt lại mật khẩu, xin hãy bỏ qua email này hoặc liên hệ ngay bộ phận Quản trị hệ thống để bảo vệ tài khoản.</p>
                </div>
                <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #64748b; text-align: center;">
                    Hệ thống Xác thực & An Toàn Thông Tin ACT PULSE.
                </div>
            </div>
            """, fullName, toEmail, resetToken);

        sendHtmlEmail(toEmail, subject, content);
    }

    @Override
    public void sendRequestDecisionNotification(String toEmail, String fullName, String requestId, String requestType, String decision, String approverName, String approverComment) {
        boolean isApproved = "APPROVED".equalsIgnoreCase(decision);
        String statusText = isApproved ? "ĐÃ ĐƯỢC PHÊ DUYỆT" : "BỊ TỪ CHỐI";
        String colorTheme = isApproved ? "#15803d" : "#b91c1c";
        String subject = String.format("[ACT PULSE] Kết quả xét duyệt đơn: %s (%s)", requestId, statusText);

        String content = String.format("""
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
                <div style="background-color: %s; padding: 18px 20px; border-radius: 8px; color: white;">
                    <h2 style="margin: 0; font-size: 18px; font-weight: 700;">Kết Quả Phê Duyệt Đơn: %s</h2>
                    <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Trạng thái: %s</p>
                </div>
                <div style="padding: 20px 0; line-height: 1.6;">
                    <p>Xin chào <strong>%s</strong>,</p>
                    <p>Đơn yêu cầu của bạn đã được cấp quản lý xử lý với kết quả như sau:</p>
                    <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e2e8f0; font-size: 13px;">
                        <p style="margin: 5px 0;">• <strong>Mã đơn:</strong> <span style="font-family: monospace; font-weight: bold;">%s</span></p>
                        <p style="margin: 5px 0;">• <strong>Loại yêu cầu:</strong> %s</p>
                        <p style="margin: 5px 0;">• <strong>Người phê duyệt:</strong> %s</p>
                        <p style="margin: 5px 0;">• <strong>Ý kiến / Lý do:</strong> <em style="color: #475569;">%s</em></p>
                    </div>
                    <div style="text-align: center; margin: 24px 0;">
                        <a href="http://localhost:3000/attendance/requests" style="background-color: #0f172a; color: white; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Xem Chi Tiết Trên Hệ Thống</a>
                    </div>
                </div>
                <div style="border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 11px; color: #64748b; text-align: center;">
                    Email thông báo tự động từ Hệ thống ACT PULSE.
                </div>
            </div>
            """, colorTheme, requestId, statusText, fullName, requestId, requestType, approverName,
            approverComment != null && !approverComment.isBlank() ? approverComment : "Không có ghi chú thêm");

        sendHtmlEmail(toEmail, subject, content);
    }

    @Override
    public boolean sendTestEmail(String toEmail, String message) {
        String subject = "[ACT PULSE] Kiểm Tra Cấu Hình Gửi Mail Thành Công (Gmail Doanh Nghiệp)";
        String content = String.format("""
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
                <div style="background-color: #15803d; padding: 18px 20px; border-radius: 8px; color: white;">
                    <h2 style="margin: 0; font-size: 18px; font-weight: 700;">✓ Kết Nối Gmail Doanh Nghiệp Thành Công!</h2>
                    <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Giao Thức SMTP smtp.gmail.com:587 (TLS)</p>
                </div>
                <div style="padding: 20px 0; color: #1e293b; line-height: 1.6;">
                    <p>Xin chào,</p>
                    <p>Email này được gửi trực tiếp từ máy chủ <strong>ACT PULSE (Spring Boot 3)</strong> qua tài khoản Gmail doanh nghiệp thật mà bạn đã thiết lập.</p>
                    <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px; margin: 18px 0; border: 1px solid #bbf7d0; color: #166534; font-size: 13px;">
                        <p style="margin: 0;">• <strong>Địa chỉ nhận thật:</strong> %s</p>
                        <p style="margin: 6px 0 0 0;">• <strong>Thông điệp kiểm thử:</strong> %s</p>
                        <p style="margin: 6px 0 0 0;">• <strong>Thời gian gửi:</strong> %s</p>
                    </div>
                    <p style="font-size: 13px; color: #334155;">Từ bây giờ, tất cả các sự kiện: tạo tài khoản nhân viên mới, cấp mật khẩu tạm thời, gửi OTP đặt lại mật khẩu và phê duyệt đơn từ sẽ được chuyển thẳng tới hòm thư cá nhân của nhân sự.</p>
                </div>
                <div style="border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 11px; color: #64748b; text-align: center;">
                    ACT PULSE Enterprise Notification Service.
                </div>
            </div>
            """, toEmail, message, java.time.LocalDateTime.now());

        return sendHtmlEmail(toEmail, subject, content);
    }

    private boolean sendHtmlEmail(String toEmail, String subject, String htmlContent) {
        if (toEmail == null || toEmail.isBlank()) {
            log.error("Không thể gửi email: Địa chỉ người nhận trống");
            return false;
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
