package com.act.pulse.modules.auth.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Người dùng — **tài khoản nội bộ do HR cấp** (không dùng Google SSO / Keycloak).
 * <p>Business: docs/01 §2 (mô hình User) + §3 (Auth).</p>
 */
@Entity
@Table(name = "users")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User extends BaseEntity {

    @Column(name = "employee_code", unique = true, nullable = false, length = 30)
    private String employeeCode;

    @Column(name = "full_name", nullable = false, length = 150)
    private String fullName;

    @Column(name = "email", unique = true, nullable = false, length = 150)
    private String email;

    /** Số điện thoại liên hệ (nhân viên tự cập nhật trong hồ sơ). */
    @Column(name = "phone", length = 20)
    private String phone;

    /** Avatar dạng data URL (ảnh đã resize phía client) — hiển thị ở header và trang hồ sơ. */
    @Column(name = "avatar_url", columnDefinition = "TEXT")
    private String avatarUrl;

    /** Chỉ lưu dạng băm (bcrypt cost 12) — không lưu bản thô. */
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    /** employee | manager | hr | admin — vai trò tự xác định từ tài khoản, không chọn khi đăng nhập. */
    @Column(name = "role", nullable = false, length = 30)
    @Builder.Default
    private String role = "EMPLOYEE";

    @Column(name = "team_id")
    private UUID teamId;

    @Column(name = "shift_id")
    private UUID shiftId;

    /** Quản lý trực tiếp — căn cứ để duyệt đơn. */
    @Column(name = "manager_id")
    private UUID managerId;

    @Column(name = "position_id")
    private UUID positionId;

    @Column(name = "position_name", length = 100)
    private String positionName;

    @Column(name = "hire_date")
    private LocalDate hireDate;

    /** Ngày vào làm (giữ tên cột cũ cho dữ liệu đã có). */
    @Column(name = "joined_date")
    private LocalDate joinedDate;

    /** pending_activation | active | locked | inactive */
    @Column(name = "status", length = 30)
    @Builder.Default
    private String status = "PENDING_ACTIVATION";

    /** Bắt buộc đổi mật khẩu ở lần đăng nhập đầu. */
    @Column(name = "must_change_password")
    @Builder.Default
    private Boolean mustChangePassword = true;

    /** Thời điểm kích hoạt lần đầu. */
    @Column(name = "activated_at")
    private LocalDateTime activatedAt;

    /** Đã đăng ký khuôn mặt — chưa có thì chưa chấm công được. */
    @Column(name = "face_enrolled")
    @Builder.Default
    private Boolean faceEnrolled = false;
}
