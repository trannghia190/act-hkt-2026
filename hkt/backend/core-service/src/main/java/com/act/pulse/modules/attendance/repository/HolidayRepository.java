package com.act.pulse.modules.attendance.repository;
import com.act.pulse.modules.attendance.entity.Holiday;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
public interface HolidayRepository extends JpaRepository<Holiday, java.util.UUID> {
    List<Holiday> findAllByOrderByHolidayDateAsc();
    boolean existsByHolidayDate(LocalDate d);
    java.util.Optional<Holiday> findByHolidayDate(LocalDate d);
}
