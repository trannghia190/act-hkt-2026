package com.act.pulse.modules.auth.repository;

import com.act.pulse.modules.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    java.util.List<User> findByTeamId(UUID teamId);

    java.util.List<User> findByPositionName(String positionName);
    Optional<User> findByEmployeeCode(String employeeCode);
    Optional<User> findByEmployeeCodeIgnoreCase(String employeeCode);
    Optional<User> findFirstByFullName(String fullName);
    Optional<User> findByEmail(String email);
    Optional<User> findByEmployeeCodeOrEmail(String employeeCode, String email);
    Optional<User> findByEmployeeCodeIgnoreCaseOrEmailIgnoreCase(String employeeCode, String email);
    java.util.List<User> findByRoleIn(java.util.Collection<String> roles);

    /** Đếm nhân viên báo cáo trực tiếp — dùng để xác định "có vai trò quản lý". */
    long countByManagerId(UUID managerId);
}
