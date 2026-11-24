package com.act.pulse.modules.auth.repository;

import com.act.pulse.modules.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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
    /**
     * Email có thể trùng giữa nhân viên đang hoạt động và nhân viên đã nghỉ (email được
     * giải phóng khi nghỉ) — luôn trả bản ghi ĐANG HOẠT ĐỘNG nếu có, ưu tiên bản ghi mới nhất.
     */
    @Query("select u from User u where lower(u.email) = lower(:email) "
            + "order by case when u.status is distinct from 'INACTIVE' then 0 else 1 end, u.createdAt desc")
    Optional<User> findByEmail(@Param("email") String email);

    /** Bản ghi đang hoạt động theo email — dùng khi kiểm tra trùng khi thêm nhân viên. */
    Optional<User> findFirstByEmailIgnoreCaseAndStatusNot(String email, String status);
    Optional<User> findByEmployeeCodeOrEmail(String employeeCode, String email);

    /**
     * Tìm theo mã nhân viên TRƯỚC, rồi tới email; email trùng giữa người đang hoạt động và
     * người đã nghỉ thì ưu tiên tài khoản ĐANG HOẠT ĐỘNG (xem {@link #findByEmail}).
     */
    @Query("select u from User u where lower(u.employeeCode) = lower(:identifier) "
            + "or lower(u.email) = lower(:identifier) "
            + "order by case when u.status is distinct from 'INACTIVE' then 0 else 1 end, u.createdAt desc")
    Optional<User> findByEmployeeCodeIgnoreCaseOrEmailIgnoreCase(
            @Param("identifier") String identifier);

    java.util.List<User> findByRoleIn(java.util.Collection<String> roles);

    /** Đếm nhân viên báo cáo trực tiếp — dùng để xác định "có vai trò quản lý". */
    long countByManagerId(UUID managerId);
}
