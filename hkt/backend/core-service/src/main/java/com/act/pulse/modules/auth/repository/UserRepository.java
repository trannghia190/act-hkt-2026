package com.act.pulse.modules.auth.repository;

import com.act.pulse.modules.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmployeeCode(String employeeCode);
    Optional<User> findByEmail(String email);
    Optional<User> findByEmployeeCodeOrEmail(String employeeCode, String email);
    Optional<User> findByEmployeeCodeIgnoreCaseOrEmailIgnoreCase(String employeeCode, String email);
}
