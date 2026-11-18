package com.act.pulse.modules.auth.entity;

import com.act.pulse.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.util.UUID;

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

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "role", nullable = false, length = 30)
    private String role; // EMPLOYEE, MANAGER, HR_ADMIN, EXECUTIVE

    @Column(name = "department", length = 100)
    private String department;

    @Column(name = "team_id")
    private UUID teamId;

    @Column(name = "line_manager_id")
    private UUID lineManagerId;

    @Column(name = "joined_date", nullable = false)
    private LocalDate joinedDate;

    @Column(name = "status", length = 30)
    @Builder.Default
    private String status = "PENDING_ACTIVATION";

    @Column(name = "must_change_password")
    @Builder.Default
    private Boolean mustChangePassword = true;

    @Column(name = "face_enrolled")
    @Builder.Default
    private Boolean faceEnrolled = false;
}
