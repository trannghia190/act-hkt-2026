package com.act.pulse.modules.auth.service.impl;

import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.common.service.EmailService;
import com.act.pulse.modules.attendance.entity.AuditLog;
import com.act.pulse.modules.attendance.entity.Team;
import com.act.pulse.modules.attendance.repository.AuditLogRepository;
import com.act.pulse.modules.attendance.repository.TeamRepository;
import com.act.pulse.modules.attendance.service.LeaveAccrualService;
import com.act.pulse.modules.attendance.service.ShiftResolver;
import com.act.pulse.modules.auth.dto.EmployeeImportResultDto;
import com.act.pulse.modules.auth.dto.EmployeeImportResultDto.ImportErrorDetail;
import com.act.pulse.modules.auth.dto.EmployeeImportResultDto.ImportedEmployeeSummary;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import com.act.pulse.modules.auth.service.EmployeeImportService;
import com.act.pulse.modules.notification.service.NotificationDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmployeeImportServiceImpl implements EmployeeImportService {

    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final ShiftResolver shiftResolver;
    private final LeaveAccrualService leaveAccrualService;
    private final NotificationDispatcher notificationDispatcher;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogRepository auditLogRepository;

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,63}$");
    private static final SecureRandom RANDOM = new SecureRandom();

    @Override
    public byte[] generateTemplate() throws IOException {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            // Sheet 1: Dữ liệu nhập
            Sheet sheet1 = workbook.createSheet("Danh_Sach_Nhan_Vien");
            sheet1.setDisplayGridlines(true);

            // Font & Styles
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerFont.setFontHeightInPoints((short) 11);

            CellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);

            CellStyle dataStyle = workbook.createCellStyle();
            dataStyle.setBorderTop(BorderStyle.THIN);
            dataStyle.setBorderBottom(BorderStyle.THIN);
            dataStyle.setBorderLeft(BorderStyle.THIN);
            dataStyle.setBorderRight(BorderStyle.THIN);
            dataStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle centerDataStyle = workbook.createCellStyle();
            centerDataStyle.cloneStyleFrom(dataStyle);
            centerDataStyle.setAlignment(HorizontalAlignment.CENTER);

            String[] headers = {
                    "Mã nhân viên (tùy chọn)",
                    "Họ và tên (*)",
                    "Email đăng nhập (*)",
                    "Số điện thoại",
                    "Phòng ban / Nhóm (*)",
                    "Chức danh / Vị trí (*)",
                    "Vai trò (*)",
                    "Mã QL trực tiếp",
                    "Ngày vào làm (dd/MM/yyyy)",
                    "Mật khẩu khởi tạo"
            };

            Row headerRow = sheet1.createRow(0);
            headerRow.setHeightInPoints(28);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // Dữ liệu mẫu (3 dòng chuẩn)
            String[][] sampleData = {
                    {"ASC001", "Nguyễn Văn An", "an.nv@ascendtech.vn", "0912345678", "Kỹ thuật Công nghệ", "Kỹ sư Phần mềm", "EMPLOYEE", "05ACT", "15/01/2026", ""},
                    {"ASC002", "Trần Thị Bích", "bich.tt@ascendtech.vn", "0987654321", "Nhân sự", "Chuyên viên Tuyển dụng", "HR_ADMIN", "05ACT", "01/02/2026", ""},
                    {"ASC003", "Lê Hoàng Long", "long.lh@ascendtech.vn", "0909123456", "Sirius", "Trưởng nhóm Kỹ thuật", "MANAGER", "05ACT", "10/02/2026", "Act@Pass2026"}
            };

            for (int r = 0; r < sampleData.length; r++) {
                Row row = sheet1.createRow(r + 1);
                row.setHeightInPoints(22);
                for (int c = 0; c < sampleData[r].length; c++) {
                    Cell cell = row.createCell(c);
                    cell.setCellValue(sampleData[r][c]);
                    if (c == 0 || c == 6 || c == 7 || c == 8) {
                        cell.setCellStyle(centerDataStyle);
                    } else {
                        cell.setCellStyle(dataStyle);
                    }
                }
            }

            // Set column width hợp lý
            for (int i = 0; i < headers.length; i++) {
                sheet1.autoSizeColumn(i);
                if (sheet1.getColumnWidth(i) < 18 * 256) {
                    sheet1.setColumnWidth(i, 20 * 256);
                } else {
                    sheet1.setColumnWidth(i, sheet1.getColumnWidth(i) + 4 * 256);
                }
            }

            // Sheet 2: Danh Mục Tham Chiếu & Hướng Dẫn
            Sheet sheet2 = workbook.createSheet("Danh_Muc_Tham_Chieu");
            sheet2.setDisplayGridlines(true);

            Font sectionFont = workbook.createFont();
            sectionFont.setBold(true);
            sectionFont.setColor(IndexedColors.DARK_BLUE.getIndex());
            sectionFont.setFontHeightInPoints((short) 12);

            CellStyle sectionStyle = workbook.createCellStyle();
            sectionStyle.setFont(sectionFont);

            CellStyle subHeaderStyle = workbook.createCellStyle();
            Font subHeaderFont = workbook.createFont();
            subHeaderFont.setBold(true);
            subHeaderFont.setColor(IndexedColors.WHITE.getIndex());
            subHeaderStyle.setFont(subHeaderFont);
            subHeaderStyle.setFillForegroundColor(IndexedColors.GREY_50_PERCENT.getIndex());
            subHeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            subHeaderStyle.setAlignment(HorizontalAlignment.CENTER);

            int rowIdx = 0;

            // 1. Vai trò hợp lệ
            Row titleRoleRow = sheet2.createRow(rowIdx++);
            Cell titleRoleCell = titleRoleRow.createCell(0);
            titleRoleCell.setCellValue("1. DANH MỤC VAI TRÒ (ROLE) HỢP LỆ");
            titleRoleCell.setCellStyle(sectionStyle);

            Row roleHRow = sheet2.createRow(rowIdx++);
            roleHRow.createCell(0).setCellValue("Mã Vai Trò (Điền vào Excel)");
            roleHRow.getCell(0).setCellStyle(subHeaderStyle);
            roleHRow.createCell(1).setCellValue("Tên Vai Trò");
            roleHRow.getCell(1).setCellStyle(subHeaderStyle);
            roleHRow.createCell(2).setCellValue("Ghi chú / Quyền hạn");
            roleHRow.getCell(2).setCellStyle(subHeaderStyle);

            String[][] rolesRef = {
                    {"EMPLOYEE", "Nhân viên", "Tạo đơn, chấm công, nộp mục tiêu OKR, xem bảng công"},
                    {"MANAGER", "Cấp Quản lý", "Duyệt đơn cấp dưới, đánh giá OKR nhóm, quản lý ca"},
                    {"HR_ADMIN", "Quản trị Nhân sự", "Quản lý nhân viên, cấu hình ca/lễ, chốt công, thiết lập hệ thống"},
                    {"ADMIN", "Quản trị Toàn quyền", "Toàn quyền quản trị kỹ thuật và phân quyền hệ thống"}
            };
            for (String[] rf : rolesRef) {
                Row r = sheet2.createRow(rowIdx++);
                r.createCell(0).setCellValue(rf[0]);
                r.createCell(1).setCellValue(rf[1]);
                r.createCell(2).setCellValue(rf[2]);
            }

            rowIdx++; // Dòng trống

            // 2. Danh mục Phòng ban / Nhóm hiện có
            Row titleTeamRow = sheet2.createRow(rowIdx++);
            Cell titleTeamCell = titleTeamRow.createCell(0);
            titleTeamCell.setCellValue("2. PHÒNG BAN / NHÓM HIỆN CÓ TRÊN HỆ THỐNG");
            titleTeamCell.setCellStyle(sectionStyle);

            Row teamHRow = sheet2.createRow(rowIdx++);
            teamHRow.createCell(0).setCellValue("Tên Phòng ban / Nhóm");
            teamHRow.getCell(0).setCellStyle(subHeaderStyle);
            teamHRow.createCell(1).setCellValue("Ghi chú");
            teamHRow.getCell(1).setCellStyle(subHeaderStyle);

            List<Team> teams = teamRepository.findAll();
            if (teams.isEmpty()) {
                Row r = sheet2.createRow(rowIdx++);
                r.createCell(0).setCellValue("Sirius");
                r.createCell(1).setCellValue("Nhóm mặc định");
            } else {
                for (Team t : teams) {
                    Row r = sheet2.createRow(rowIdx++);
                    r.createCell(0).setCellValue(t.getName());
                    r.createCell(1).setCellValue("Hệ thống tự nhận diện hoặc tự động tạo mới nếu nhập tên phòng ban mới");
                }
            }

            rowIdx++; // Dòng trống

            // 3. Danh mục Quản lý hiện có
            Row titleMgrRow = sheet2.createRow(rowIdx++);
            Cell titleMgrCell = titleMgrRow.createCell(0);
            titleMgrCell.setCellValue("3. DANH SÁCH QUẢN LÝ (THAM KHẢO CHO CỘT 'MÃ QL TRỰC TIẾP')");
            titleMgrCell.setCellStyle(sectionStyle);

            Row mgrHRow = sheet2.createRow(rowIdx++);
            mgrHRow.createCell(0).setCellValue("Mã Nhân Viên");
            mgrHRow.getCell(0).setCellStyle(subHeaderStyle);
            mgrHRow.createCell(1).setCellValue("Họ và Tên");
            mgrHRow.getCell(1).setCellStyle(subHeaderStyle);
            mgrHRow.createCell(2).setCellValue("Email");
            mgrHRow.getCell(2).setCellStyle(subHeaderStyle);
            mgrHRow.createCell(3).setCellValue("Vai trò");
            mgrHRow.getCell(3).setCellStyle(subHeaderStyle);

            List<User> managers = userRepository.findAll().stream()
                    .filter(u -> !"INACTIVE".equalsIgnoreCase(u.getStatus()))
                    .filter(u -> "MANAGER".equalsIgnoreCase(u.getRole()) || "HR_ADMIN".equalsIgnoreCase(u.getRole()) || "ADMIN".equalsIgnoreCase(u.getRole()))
                    .limit(20)
                    .toList();

            for (User m : managers) {
                Row r = sheet2.createRow(rowIdx++);
                r.createCell(0).setCellValue(m.getEmployeeCode());
                r.createCell(1).setCellValue(m.getFullName());
                r.createCell(2).setCellValue(m.getEmail());
                r.createCell(3).setCellValue(m.getRole());
            }

            for (int i = 0; i < 4; i++) {
                sheet2.autoSizeColumn(i);
                sheet2.setColumnWidth(i, Math.max(sheet2.getColumnWidth(i) + 4 * 256, 22 * 256));
            }

            workbook.write(out);
            return out.toByteArray();
        }
    }

    @Override
    @Transactional
    public EmployeeImportResultDto importEmployees(MultipartFile file, boolean sendActivationEmail) throws Exception {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Vui lòng chọn file Excel để import");
        }

        String filename = file.getOriginalFilename();
        if (filename == null || (!filename.toLowerCase().endsWith(".xlsx") && !filename.toLowerCase().endsWith(".xls"))) {
            throw new IllegalArgumentException("Định dạng file không hợp lệ. Vui lòng tải file Excel (.xlsx hoặc .xls)");
        }

        List<ImportedEmployeeSummary> successList = new ArrayList<>();
        List<ImportErrorDetail> errorList = new ArrayList<>();

        Set<String> processedCodesInBatch = new HashSet<>();
        Set<String> processedEmailsInBatch = new HashSet<>();

        UUID defaultShiftId = shiftResolver.standardShiftId();

        // Chuẩn bị danh sách Quản lý để tra cứu nhanh
        Map<String, User> userByCode = new HashMap<>();
        Map<String, User> userByEmail = new HashMap<>();
        userRepository.findAll().forEach(u -> {
            if (u.getEmployeeCode() != null) userByCode.put(u.getEmployeeCode().toUpperCase().trim(), u);
            if (u.getEmail() != null) userByEmail.put(u.getEmail().toLowerCase().trim(), u);
        });

        // Chuẩn bị danh sách Team để tra cứu nhanh
        Map<String, Team> teamByName = new HashMap<>();
        teamRepository.findAll().forEach(t -> {
            if (t.getName() != null) teamByName.put(t.getName().toLowerCase().trim(), t);
        });

        UUID fallbackManagerId = userByCode.containsKey("05ACT") ? userByCode.get("05ACT").getId() : null;

        int totalDataRows = 0;

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null) {
                throw new IllegalArgumentException("File Excel không có dữ liệu (sheet rỗng)");
            }

            int lastRowNum = sheet.getLastRowNum();

            // Nhận diện linh hoạt thứ tự các cột từ header (dòng 0)
            Row headerRow = sheet.getRow(0);
            int colCode = 0, colName = 1, colEmail = 2, colPhone = 3, colTeam = 4, colPos = 5, colRole = 6, colMgr = 7, colDate = 8, colPass = 9;
            if (headerRow != null) {
                for (int c = headerRow.getFirstCellNum(); c < headerRow.getLastCellNum(); c++) {
                    String h = getCellString(headerRow.getCell(c)).toLowerCase().trim();
                    if (h.contains("mã nv") || h.contains("mã nhân viên") || h.equals("code") || h.equals("employee_code")) colCode = c;
                    else if (h.contains("họ và tên") || h.contains("họ tên") || h.equals("name") || h.equals("fullname")) colName = c;
                    else if (h.contains("email")) colEmail = c;
                    else if (h.contains("điện thoại") || h.contains("phone") || h.contains("sđt") || h.contains("sdt")) colPhone = c;
                    else if (h.contains("phòng ban") || h.contains("nhóm") || h.contains("team") || h.contains("department")) colTeam = c;
                    else if (h.contains("chức danh") || h.contains("vị trí") || h.contains("position") || h.contains("title")) colPos = c;
                    else if (h.contains("vai trò") || h.contains("role")) colRole = c;
                    else if (h.contains("quản lý") || h.contains("ql") || h.contains("manager")) colMgr = c;
                    else if (h.contains("ngày vào") || h.contains("ngày gia nhập") || h.contains("join") || h.contains("hire")) colDate = c;
                    else if (h.contains("mật khẩu") || h.contains("password") || h.contains("pass")) colPass = c;
                }
            }

            for (int r = 1; r <= lastRowNum; r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) {
                    continue;
                }

                totalDataRows++;
                int rowNumber = r + 1; // Số dòng thực tế trên Excel (bắt đầu từ dòng 2)

                String rawCode = colCode >= 0 ? getCellString(row.getCell(colCode)) : "";
                String fullName = colName >= 0 ? getCellString(row.getCell(colName)) : "";
                String email = colEmail >= 0 ? getCellString(row.getCell(colEmail)) : "";
                String phone = colPhone >= 0 ? getCellString(row.getCell(colPhone)) : "";
                String teamName = colTeam >= 0 ? getCellString(row.getCell(colTeam)) : "";
                String positionName = colPos >= 0 ? getCellString(row.getCell(colPos)) : "";
                String roleStr = colRole >= 0 ? getCellString(row.getCell(colRole)) : "";
                String managerCode = colMgr >= 0 ? getCellString(row.getCell(colMgr)) : "";
                LocalDate joinedDate = colDate >= 0 ? parseDate(row.getCell(colDate)) : LocalDate.now();
                String rawPassword = colPass >= 0 ? getCellString(row.getCell(colPass)) : "";

                // 1. Kiểm tra Họ và Tên
                if (fullName.isBlank()) {
                    errorList.add(new ImportErrorDetail(rowNumber, rawCode, fullName, email, "Họ và tên bắt buộc không được để trống"));
                    continue;
                }

                // 2. Kiểm tra Email
                if (email.isBlank()) {
                    errorList.add(new ImportErrorDetail(rowNumber, rawCode, fullName, email, "Email bắt buộc không được để trống"));
                    continue;
                }
                String normalizedEmail = email.toLowerCase().trim();
                if (!EMAIL_PATTERN.matcher(normalizedEmail).matches()) {
                    errorList.add(new ImportErrorDetail(rowNumber, rawCode, fullName, email, "Định dạng email không hợp lệ: " + email));
                    continue;
                }
                if (processedEmailsInBatch.contains(normalizedEmail)) {
                    errorList.add(new ImportErrorDetail(rowNumber, rawCode, fullName, email, "Email trùng lặp với dòng khác trong file Excel"));
                    continue;
                }
                User existingActiveUserByEmail = userByEmail.get(normalizedEmail);
                if (existingActiveUserByEmail != null && !"INACTIVE".equalsIgnoreCase(existingActiveUserByEmail.getStatus())) {
                    errorList.add(new ImportErrorDetail(rowNumber, rawCode, fullName, email,
                            "Email đã tồn tại cho nhân viên đang hoạt động (" + existingActiveUserByEmail.getFullName()
                                    + " - " + existingActiveUserByEmail.getEmployeeCode() + ")"));
                    continue;
                }

                // 3. Kiểm tra Mã nhân viên
                String finalCode;
                if (!rawCode.isBlank()) {
                    String normCode = rawCode.toUpperCase().trim();
                    if (processedCodesInBatch.contains(normCode)) {
                        errorList.add(new ImportErrorDetail(rowNumber, rawCode, fullName, email, "Mã nhân viên trùng lặp trong file Excel: " + normCode));
                        continue;
                    }
                    if (userByCode.containsKey(normCode)) {
                        User existingByCode = userByCode.get(normCode);
                        errorList.add(new ImportErrorDetail(rowNumber, rawCode, fullName, email,
                                "Mã nhân viên " + normCode + " đã tồn tại trên hệ thống (" + existingByCode.getFullName() + ")"));
                        continue;
                    }
                    finalCode = normCode;
                } else {
                    finalCode = generateUniqueCode(processedCodesInBatch, userByCode);
                }

                // 4. Xác định Phòng ban / Nhóm
                UUID teamId = null;
                String finalTeamName = teamName.isBlank() ? "Sirius" : teamName.trim();
                String teamKey = finalTeamName.toLowerCase();
                if (teamByName.containsKey(teamKey)) {
                    Team existingTeam = teamByName.get(teamKey);
                    teamId = existingTeam.getId();
                    finalTeamName = existingTeam.getName();
                } else {
                    // Tự động tạo mới Team nếu chưa có
                    try {
                        Team newTeam = Team.builder()
                                .name(finalTeamName)
                                .isSpecialApproval(false)
                                .build();
                        newTeam = teamRepository.save(newTeam);
                        teamId = newTeam.getId();
                        teamByName.put(teamKey, newTeam);
                    } catch (Exception ex) {
                        log.warn("Không tạo được team mới: {}", finalTeamName, ex);
                        if (!teamByName.isEmpty()) {
                            Team first = teamByName.values().iterator().next();
                            teamId = first.getId();
                            finalTeamName = first.getName();
                        }
                    }
                }

                // 5. Xác định Vai trò (Role)
                String finalRole = normalizeRole(roleStr);

                // 6. Xác định Chức danh (Position)
                String finalPosition = positionName.isBlank() ? "Chuyên viên" : positionName.trim();

                // 7. Xác định Quản lý trực tiếp
                UUID managerId = fallbackManagerId;
                String managerDisplayName = "Nguyễn Thanh Tùng (05ACT)";
                if (!managerCode.isBlank() && !managerCode.equalsIgnoreCase(finalCode)) {
                    String normMgrCode = managerCode.toUpperCase().trim();
                    User specifiedMgr = userByCode.get(normMgrCode);
                    if (specifiedMgr != null && !"INACTIVE".equalsIgnoreCase(specifiedMgr.getStatus()) && !specifiedMgr.getEmployeeCode().equalsIgnoreCase(finalCode)) {
                        managerId = specifiedMgr.getId();
                        managerDisplayName = specifiedMgr.getFullName() + " (" + specifiedMgr.getEmployeeCode() + ")";
                    }
                }

                // 8. Mật khẩu khởi tạo
                String finalPassword = (rawPassword != null && rawPassword.trim().length() >= 6)
                        ? rawPassword.trim()
                        : generateSecureRandomPassword();

                // 9. Khởi tạo và Lưu User
                User newUser = User.builder()
                        .employeeCode(finalCode)
                        .fullName(fullName.trim())
                        .email(normalizedEmail)
                        .phone(phone.isBlank() ? null : phone.trim())
                        .passwordHash(passwordEncoder.encode(finalPassword))
                        .role(finalRole)
                        .positionName(finalPosition)
                        .teamId(teamId)
                        .shiftId(defaultShiftId)
                        .managerId(managerId)
                        .status("ACTIVE")
                        .mustChangePassword(true)
                        .faceEnrolled(false)
                        .hireDate(joinedDate)
                        .joinedDate(joinedDate)
                        .build();

                User savedUser = userRepository.save(newUser);

                // Cập nhật bộ nhớ tra cứu nội bộ
                processedCodesInBatch.add(finalCode);
                processedEmailsInBatch.add(normalizedEmail);
                userByCode.put(finalCode, savedUser);
                userByEmail.put(normalizedEmail, savedUser);

                // Cộng bù sổ phép theo thâm niên
                try {
                    leaveAccrualService.backfillForOnboarding(savedUser);
                } catch (Exception ex) {
                    log.warn("Lỗi cộng bù phép cho {}: {}", savedUser.getEmployeeCode(), ex.getMessage());
                }

                // Gửi thông báo chuông in-app
                try {
                    notificationDispatcher.dispatch(
                            "ONBOARDING",
                            savedUser.getId(),
                            "Chào mừng thành viên mới đến với Ascend Tech!",
                            "Tài khoản của bạn đã được khởi tạo thành công. Mã nhân viên: "
                                    + savedUser.getEmployeeCode() + ". Vui lòng đổi mật khẩu ở lần đăng nhập đầu tiên.",
                            "ONBOARDING",
                            "LOW",
                            "/login",
                            "onboard:" + savedUser.getId()
                    );
                } catch (Exception ignored) {}

                // Gửi email kích hoạt nếu được yêu cầu
                boolean emailSent = false;
                String emailStatusMessage = "Chưa gửi email (tùy chọn gửi email bị tắt)";
                if (sendActivationEmail) {
                    if (emailService.isMailDeliverable()) {
                        emailSent = true;
                        emailStatusMessage = "Đang gửi tự động qua Gmail";
                        final String sendToEmail = savedUser.getEmail();
                        final String sendToName = savedUser.getFullName();
                        final String sendToCode = savedUser.getEmployeeCode();
                        final String sendToPass = finalPassword;
                        CompletableFuture.runAsync(() -> {
                            try {
                                emailService.sendAccountActivationEmail(sendToEmail, sendToName, sendToCode, sendToPass);
                            } catch (Exception ex) {
                                log.error("Lỗi gửi email kích hoạt cho {}: {}", sendToEmail, ex.getMessage());
                            }
                        });
                    } else {
                        emailStatusMessage = "SMTP chưa cấu hình kết nối Gmail doanh nghiệp";
                    }
                }

                successList.add(ImportedEmployeeSummary.builder()
                        .employeeCode(finalCode)
                        .fullName(savedUser.getFullName())
                        .email(savedUser.getEmail())
                        .phone(savedUser.getPhone())
                        .teamName(finalTeamName)
                        .positionName(finalPosition)
                        .role(finalRole)
                        .managerCode(managerCode.isBlank() ? "05ACT" : managerCode.toUpperCase().trim())
                        .managerName(managerDisplayName)
                        .joinedDate(joinedDate.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")))
                        .defaultPassword(finalPassword)
                        .emailSent(emailSent)
                        .emailStatusMessage(emailStatusMessage)
                        .build());
            }
        }

        // Lưu Audit Log
        try {
            AuditLog logEntry = AuditLog.builder()
                    .action("IMPORT_EMPLOYEES_EXCEL")
                    .entityName("USER")
                    .userId(CurrentUser.userId())
                    .reason("Import danh sách nhân viên từ file Excel: " + filename)
                    .newValue("Thành công: " + successList.size() + "/" + totalDataRows + ", Lỗi: " + errorList.size())
                    .build();
            logEntry.setCreatedAt(LocalDateTime.now());
            auditLogRepository.save(logEntry);
        } catch (Exception ex) {
            log.warn("Không lưu được audit log import: {}", ex.getMessage());
        }

        return EmployeeImportResultDto.builder()
                .totalRows(totalDataRows)
                .successCount(successList.size())
                .errorCount(errorList.size())
                .successList(successList)
                .errorList(errorList)
                .build();
    }

    private boolean isRowEmpty(Row row) {
        if (row == null) return true;
        for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {
            Cell cell = row.getCell(c);
            if (cell != null && cell.getCellType() != CellType.BLANK && !getCellString(cell).isBlank()) {
                return false;
            }
        }
        return true;
    }

    private String getCellString(Cell cell) {
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                if (DateUtil.isCellDateFormatted(cell)) {
                    yield cell.getLocalDateTimeCellValue().toLocalDate().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
                } else {
                    double val = cell.getNumericCellValue();
                    if (val == Math.floor(val)) {
                        yield String.valueOf((long) val);
                    }
                    yield String.valueOf(val);
                }
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> {
                try {
                    yield cell.getStringCellValue().trim();
                } catch (Exception e) {
                    try {
                        double v = cell.getNumericCellValue();
                        yield (v == Math.floor(v)) ? String.valueOf((long) v) : String.valueOf(v);
                    } catch (Exception ex) {
                        yield "";
                    }
                }
            }
            default -> "";
        };
    }

    private LocalDate parseDate(Cell cell) {
        if (cell != null && cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            try {
                return cell.getLocalDateTimeCellValue().toLocalDate();
            } catch (Exception ignored) {}
        }
        String text = getCellString(cell);
        if (text.isBlank()) return LocalDate.now();

        List<DateTimeFormatter> formatters = List.of(
                DateTimeFormatter.ofPattern("dd/MM/yyyy"),
                DateTimeFormatter.ofPattern("d/M/yyyy"),
                DateTimeFormatter.ofPattern("yyyy-MM-dd"),
                DateTimeFormatter.ofPattern("dd-MM-yyyy")
        );
        for (DateTimeFormatter dtf : formatters) {
            try {
                return LocalDate.parse(text, dtf);
            } catch (Exception ignored) {}
        }
        return LocalDate.now();
    }

    private String normalizeRole(String input) {
        if (input == null || input.isBlank()) return "EMPLOYEE";
        String upper = input.toUpperCase().trim();
        if (upper.contains("ADMIN") || upper.contains("QUẢN TRỊ") || upper.contains("QUAN TRI")) {
            return "ADMIN";
        }
        if (upper.contains("HR") || upper.contains("NHÂN SỰ") || upper.contains("NHAN SU")) {
            return "HR_ADMIN";
        }
        if (upper.contains("MANAGER") || upper.contains("QUẢN LÝ") || upper.contains("QUAN LY") || upper.contains("TRƯỞNG") || upper.contains("TRUONG")) {
            return "MANAGER";
        }
        return "EMPLOYEE";
    }

    private String generateUniqueCode(Set<String> batchCodes, Map<String, User> existingUsers) {
        for (int i = 0; i < 1000; i++) {
            String candidate = "ASC" + (1000 + RANDOM.nextInt(9000));
            if (!batchCodes.contains(candidate) && !existingUsers.containsKey(candidate)) {
                return candidate;
            }
        }
        return "ASC" + System.currentTimeMillis() % 100000;
    }

    private String generateSecureRandomPassword() {
        String upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        String lower = "abcdefghjkmnpqrstuvwxyz";
        String digits = "23456789";
        String special = "@#$!%*";
        StringBuilder sb = new StringBuilder();
        sb.append(upper.charAt(RANDOM.nextInt(upper.length())));
        sb.append(lower.charAt(RANDOM.nextInt(lower.length())));
        sb.append(digits.charAt(RANDOM.nextInt(digits.length())));
        sb.append(special.charAt(RANDOM.nextInt(special.length())));
        String allChars = upper + lower + digits + special;
        for (int i = 0; i < 4; i++) {
            sb.append(allChars.charAt(RANDOM.nextInt(allChars.length())));
        }
        return "Act@" + sb.toString();
    }
}
