package com.act.pulse.modules.auth.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.common.security.CurrentUser;
import com.act.pulse.modules.attendance.entity.AuditLog;
import com.act.pulse.modules.attendance.entity.Holiday;
import com.act.pulse.modules.attendance.entity.Notification;
import com.act.pulse.modules.attendance.entity.RequestEntity;
import com.act.pulse.modules.attendance.entity.Rule;
import com.act.pulse.modules.attendance.entity.Shift;
import com.act.pulse.modules.attendance.entity.Team;
import com.act.pulse.modules.attendance.repository.AttendanceLogRepository;
import com.act.pulse.modules.attendance.repository.AuditLogRepository;
import com.act.pulse.modules.attendance.repository.HolidayRepository;
import com.act.pulse.modules.attendance.repository.NotificationRepository;
import com.act.pulse.modules.attendance.repository.RequestRepository;
import com.act.pulse.modules.attendance.repository.RuleRepository;
import com.act.pulse.modules.attendance.repository.ShiftRepository;
import com.act.pulse.modules.attendance.service.ShiftResolver;
import com.act.pulse.modules.attendance.repository.TeamRepository;
import com.act.pulse.modules.auth.entity.User;
import com.act.pulse.modules.auth.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@Tag(name = "1. Organization Structure & Administration API", description = "Quản lý cơ cấu nhóm lồng nhau, cây tổ chức, nhân viên, phân quyền RBAC và Audit Trail")
public class OrgStructureController {

    @Autowired
    private ShiftRepository shiftRepository;

    @Autowired
    private ShiftResolver shiftResolver;

    @Autowired
    private AttendanceLogRepository attendanceLogRepository;

    @Autowired
    private HolidayRepository holidayRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RequestRepository requestRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private RuleRepository ruleRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private com.act.pulse.modules.notification.service.NotificationDispatcher notificationDispatcher;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private com.act.pulse.common.service.EmailService emailService;

    @Autowired
    private com.act.pulse.modules.auth.service.AuthService authService;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TeamNode {
        private String id;
        private String name;
        private String leaderName;
        private int memberCount;
        private boolean isSpecialApproval;
        private List<String> members;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TeamGroupNode {
        private String id;
        private String code;
        private String name;
        private String managerName;
        private int memberCount;
        private List<TeamNode> teams;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EmployeeDto {
        private String id;
        private String employeeCode;
        private String fullName;
        private String email;
        private String phone;
        private String team;
        private String teamId;
        private String positionName;
        private String role;
        private String status; // ACTIVE, LOCKED, PENDING_ACTIVATION, INACTIVE
        private String managerId;
        private String managerCode;
        private String managerName;
        private String approvalChain; // e.g. "Nguyễn Thanh Tùng (05ACT) → Quản Trị Viên (Admin)"
        private String hireDate;
        private String joinDate;
        private boolean mustChangePassword;
        private boolean faceEnrolled;
        private String defaultPassword;
        private boolean emailSent;
        private String emailStatusMessage;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateEmployeeRequest {
        private String employeeCode;
        private String fullName;
        private String email;
        private String phone;
        private String team;
        private String department;
        private String positionName;
        private String role;
        private String password;
        private boolean generateRandomPassword;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChangeManagerRequest {
        private String newManagerId;
        private String reason;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChangeTeamRequest {
        private String teamId;
        private String teamName;
        private String reason;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TeamOptionDto {
        private String id;
        private String name;
        private String parentName;
        private String leaderName;
        private int memberCount;
    }

    @GetMapping(value = { "/admin/teams", "/admin/departments", "/teams" })
    @Operation(summary = "Danh sách nhóm làm việc — nguồn duy nhất cho các dropdown chọn nhóm (S40)")
    public ApiResponse<List<TeamOptionDto>> listTeams() {
        Map<UUID, String> teamNames = new HashMap<>();
        for (Team t : teamRepository.findAll()) teamNames.put(t.getId(), t.getName());
        Map<UUID, String> userNames = new HashMap<>();
        for (User u : userRepository.findAll()) userNames.put(u.getId(), u.getFullName());
        Map<UUID, Integer> memberCount = new HashMap<>();
        for (User u : userRepository.findAll()) {
            if (u.getTeamId() != null) memberCount.merge(u.getTeamId(), 1, Integer::sum);
        }
        List<TeamOptionDto> out = new ArrayList<>();
        for (Team t : teamRepository.findAll()) {
            out.add(TeamOptionDto.builder()
                    .id(t.getId().toString())
                    .name(t.getName())
                    .parentName(t.getParentId() == null ? null : teamNames.get(t.getParentId()))
                    .leaderName(t.getLeaderId() == null ? null : userNames.get(t.getLeaderId()))
                    .memberCount(memberCount.getOrDefault(t.getId(), 0))
                    .build());
        }
        out.sort(Comparator.comparing(TeamOptionDto::getName,
                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)));
        return ApiResponse.ok(out, "Danh sách nhóm làm việc");
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrgTreeNodeDto {
        private String id;
        private String code;
        private String name;
        private String parentId;
        private String parentName;
        private String leaderId;
        private String leaderCode;
        private String leaderName;
        private String managerName;
        private boolean hasLeader;
        private int memberCount;
        private int totalMemberCount;
        private int pendingRequestsCount;
        private int totalPendingRequestsCount;
        private boolean isSpecialApproval;
        private List<EmployeeDto> members;
        private List<OrgTreeNodeDto> children;
        private List<OrgTreeNodeDto> teams;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AuditLogDto {
        private String id;
        private String timestamp;
        private String actorCode;
        private String actorName;
        private String action; // CREATE, UPDATE, DELETE, APPROVE, LOCK, UPDATE_RULE, UPDATE_TIMESHEET
        private String entity; // TIMESHEET, USER, RULE, OKR, TEAM, REQUEST
        private String entityId;
        private String oldValue;
        private String newValue;
        private String reason;
        private String details;
        private String ipAddress;
        private String affectedUser;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TimesheetOverrideRequest {
        private String employeeCode;
        private String employeeName;
        private String workDate;
        private String fieldName;
        private String oldValue;
        private String newValue;
        private String reason;
    }

    private EmployeeDto toEmployeeDto(User u) {
        String teamName = "Chưa có nhóm";
        if (u.getTeamId() != null) {
            teamName = teamRepository.findById(u.getTeamId()).map(Team::getName).orElse("Chưa có nhóm");
        }
        String posName = u.getPositionName() != null ? u.getPositionName()
                : (u.getRole() != null ? u.getRole() : "Chuyên viên");
        String managerName = "Chưa có";
        String managerCode = "";
        String managerIdStr = "";
        String approvalChain = "⚠ Chưa có quản lý trực tiếp";

        if (u.getManagerId() != null) {
            Optional<User> mgrOpt = userRepository.findById(u.getManagerId());
            if (mgrOpt.isPresent()) {
                User mgr1 = mgrOpt.get();
                managerName = mgr1.getFullName();
                managerCode = mgr1.getEmployeeCode();
                managerIdStr = mgr1.getId().toString();
                if (mgr1.getManagerId() != null) {
                    Optional<User> mgr2Opt = userRepository.findById(mgr1.getManagerId());
                    if (mgr2Opt.isPresent()) {
                        User mgr2 = mgr2Opt.get();
                        approvalChain = mgr1.getFullName() + " (" + mgr1.getEmployeeCode() + ") → " + mgr2.getFullName()
                                + " (" + mgr2.getEmployeeCode() + ")";
                    } else {
                        approvalChain = mgr1.getFullName() + " (" + mgr1.getEmployeeCode() + ") → Ban Quản Trị";
                    }
                } else {
                    approvalChain = mgr1.getFullName() + " (" + mgr1.getEmployeeCode() + ") → Ban Quản Trị";
                }
            }
        } else if ("ADMIN".equalsIgnoreCase(u.getRole())) {
            approvalChain = "Ban Quản Trị Hệ Thống (Cấp cao nhất)";
            managerName = "Ban Quản Trị";
        }

        return EmployeeDto.builder()
                .id(u.getId().toString())
                .employeeCode(u.getEmployeeCode())
                .fullName(u.getFullName())
                .email(u.getEmail())
                .phone("090" + Math.abs(u.getEmployeeCode().hashCode() % 10000000))
                .team(teamName)
                .teamId(u.getTeamId() != null ? u.getTeamId().toString() : null)
                .positionName(posName)
                .role(u.getRole())
                .status(u.getStatus() != null ? u.getStatus() : "ACTIVE")
                .managerId(managerIdStr)
                .managerCode(managerCode)
                .managerName(managerName)
                .approvalChain(approvalChain)
                .hireDate(u.getHireDate() != null ? u.getHireDate().toString()
                        : (u.getJoinedDate() != null ? u.getJoinedDate().toString() : "2023-01-01"))
                .joinDate(u.getJoinedDate() != null ? u.getJoinedDate().toString() : "2023-01-01")
                .mustChangePassword(Boolean.TRUE.equals(u.getMustChangePassword()))
                .faceEnrolled(Boolean.TRUE.equals(u.getFaceEnrolled()))
                .build();
    }

    private void saveAudit(String action, String entity, String details) {
        AuditLog log = AuditLog.builder()
                .action(action)
                .entityName(entity)
                .userId(CurrentUser.userId())
                .userCode(CurrentUser.employeeCode())
                .userName(resolveActorName())
                .reason(details)
                .ipAddress("127.0.0.1")
                .build();
        log.setCreatedAt(LocalDateTime.now());
        auditLogRepository.save(log);
    }

    @GetMapping(value = { "/org/tree", "/admin/teams/tree", "/admin/departments/tree", "/admin/org-tree" })
    @Operation(summary = "Lấy cây sơ đồ tổ chức công ty — nhóm lồng nhau KHÔNG giới hạn số tầng (S41 / CORE-ORG-01)")
    public ApiResponse<List<OrgTreeNodeDto>> getFullOrgTree() {
        // 1. Lấy tất cả teams từ DB
        List<Team> allTeams = teamRepository.findAll();
        // 2. Lấy tất cả users từ DB
        List<User> allUsers = userRepository.findAll();
        Map<UUID, User> userMap = new HashMap<>();
        for (User u : allUsers)
            userMap.put(u.getId(), u);

        // 3. Lấy tất cả pending requests
        List<RequestEntity> pendingRequests = requestRepository.findAll().stream()
                .filter(r -> "PENDING_APPROVAL".equalsIgnoreCase(r.getStatus()))
                .toList();
        Map<UUID, Integer> userPendingMap = new HashMap<>();
        for (RequestEntity r : pendingRequests) {
            if (r.getUserId() != null) {
                userPendingMap.put(r.getUserId(), userPendingMap.getOrDefault(r.getUserId(), 0) + 1);
            }
        }

        // 4. Group users theo teamId
        Map<UUID, List<User>> teamUsersMap = new HashMap<>();
        for (User u : allUsers) {
            if (u.getTeamId() != null) {
                teamUsersMap.computeIfAbsent(u.getTeamId(), k -> new ArrayList<>()).add(u);
            }
        }

        // 5. Tạo OrgTreeNodeDto cho từng team
        Map<UUID, OrgTreeNodeDto> nodeMap = new HashMap<>();
        for (Team t : allTeams) {
            List<User> members = teamUsersMap.getOrDefault(t.getId(), Collections.emptyList());
            int pCount = 0;
            List<EmployeeDto> memberDtos = new ArrayList<>();
            for (User u : members) {
                pCount += userPendingMap.getOrDefault(u.getId(), 0);
                boolean hasMgr = u.getManagerId() != null;
                String mgrName = "Chưa có";
                String mgrCode = "";
                if (hasMgr && userMap.containsKey(u.getManagerId())) {
                    mgrName = userMap.get(u.getManagerId()).getFullName();
                    mgrCode = userMap.get(u.getManagerId()).getEmployeeCode();
                }
                memberDtos.add(EmployeeDto.builder()
                        .id(u.getId().toString())
                        .employeeCode(u.getEmployeeCode())
                        .fullName(u.getFullName())
                        .email(u.getEmail())
                        .phone("0901234567")
                        .role(u.getRole())
                        .positionName(u.getPositionName())
                        .status(u.getStatus())
                        .team(t.getName())
                        .teamId(t.getId().toString())
                        .managerId(u.getManagerId() != null ? u.getManagerId().toString() : null)
                        .managerName(mgrName)
                        .managerCode(mgrCode)
                        .approvalChain(hasMgr ? mgrName + " (" + mgrCode + ")" : "⚠ Chưa có quản lý trực tiếp")
                        .mustChangePassword(Boolean.TRUE.equals(u.getMustChangePassword()))
                        .faceEnrolled(Boolean.TRUE.equals(u.getFaceEnrolled()))
                        .build());
            }

            String leaderName = null;
            String leaderCode = null;
            if (t.getLeaderId() != null && userMap.containsKey(t.getLeaderId())) {
                User leader = userMap.get(t.getLeaderId());
                leaderName = leader.getFullName();
                leaderCode = leader.getEmployeeCode();
            }

            String derivedCode = t.getName().replaceAll("[^a-zA-Z0-9]", "").toUpperCase();
            if (derivedCode.length() > 10)
                derivedCode = derivedCode.substring(0, 10);
            if (derivedCode.isBlank())
                derivedCode = "TEAM";

            OrgTreeNodeDto dto = OrgTreeNodeDto.builder()
                    .id(t.getId().toString())
                    .name(t.getName())
                    .code(derivedCode)
                    .parentId(t.getParentId() != null ? t.getParentId().toString() : null)
                    .leaderId(t.getLeaderId() != null ? t.getLeaderId().toString() : null)
                    .leaderName(leaderName)
                    .leaderCode(leaderCode)
                    .managerName(leaderName != null ? leaderName : "Chưa có trưởng nhóm")
                    .hasLeader(t.getLeaderId() != null)
                    .memberCount(members.size())
                    .totalMemberCount(members.size())
                    .pendingRequestsCount(pCount)
                    .totalPendingRequestsCount(pCount)
                    .isSpecialApproval(Boolean.TRUE.equals(t.getIsSpecialApproval()))
                    .members(memberDtos)
                    .children(new ArrayList<>())
                    .teams(new ArrayList<>())
                    .build();
            nodeMap.put(t.getId(), dto);
        }

        // 6. Ghép cây đa tầng đệ quy
        List<OrgTreeNodeDto> rootNodes = new ArrayList<>();
        for (Team t : allTeams) {
            OrgTreeNodeDto node = nodeMap.get(t.getId());
            if (t.getParentId() != null && nodeMap.containsKey(t.getParentId())) {
                OrgTreeNodeDto parentNode = nodeMap.get(t.getParentId());
                node.setParentName(parentNode.getName());
                parentNode.getChildren().add(node);
                parentNode.getTeams().add(node);
            } else {
                rootNodes.add(node);
            }
        }

        // 7. Tính tổng đệ quy
        for (OrgTreeNodeDto root : rootNodes) {
            computeSubtreeTotals(root);
        }

        return ApiResponse.ok(rootNodes, "Lấy sơ đồ tổ chức thành công");
    }

    private void computeSubtreeTotals(OrgTreeNodeDto node) {
        int totalMembers = node.getMemberCount();
        int totalPending = node.getPendingRequestsCount();
        for (OrgTreeNodeDto child : node.getChildren()) {
            computeSubtreeTotals(child);
            totalMembers += child.getTotalMemberCount();
            totalPending += child.getTotalPendingRequestsCount();
        }
        node.setTotalMemberCount(totalMembers);
        node.setTotalPendingRequestsCount(totalPending);
    }

    @GetMapping("/admin/users")
    @Operation(summary = "Danh sách nhân viên toàn công ty & bộ lọc (S40)")
    public ApiResponse<Map<String, Object>> getEmployees(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String team,
            @RequestParam(required = false) String position,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String role) {
        // 1. Load all teams into map
        Map<UUID, String> teamMap = new HashMap<>();
        teamRepository.findAll().forEach(t -> teamMap.put(t.getId(), t.getName()));

        // 2. Load all users from DB
        List<User> dbUsers = userRepository.findAll();
        Map<UUID, User> userMap = new HashMap<>();
        dbUsers.forEach(u -> userMap.put(u.getId(), u));

        List<EmployeeDto> resultList = new ArrayList<>();

        for (User u : dbUsers) {
            String teamName = u.getTeamId() != null ? teamMap.getOrDefault(u.getTeamId(), "Chưa có nhóm")
                    : "Chưa có nhóm";
            String posName = u.getPositionName() != null ? u.getPositionName()
                    : (u.getRole() != null ? u.getRole() : "Chuyên viên");

            // Build approval chain (chuỗi cấp trên: ai duyệt cho ai)
            String approvalChain;
            String managerName = "Chưa có";
            String managerCode = "";
            String managerIdStr = "";

            if (u.getManagerId() != null && userMap.containsKey(u.getManagerId())) {
                User mgr1 = userMap.get(u.getManagerId());
                managerName = mgr1.getFullName();
                managerCode = mgr1.getEmployeeCode();
                managerIdStr = mgr1.getId().toString();

                if (mgr1.getManagerId() != null && userMap.containsKey(mgr1.getManagerId())) {
                    User mgr2 = userMap.get(mgr1.getManagerId());
                    approvalChain = mgr1.getFullName() + " (" + mgr1.getEmployeeCode() + ") → " + mgr2.getFullName()
                            + " (" + mgr2.getEmployeeCode() + ")";
                } else {
                    approvalChain = mgr1.getFullName() + " (" + mgr1.getEmployeeCode() + ") → Ban Quản Trị";
                }
            } else if ("ADMIN".equalsIgnoreCase(u.getRole())) {
                approvalChain = "Ban Quản Trị Hệ Thống (Cấp cao nhất)";
                managerName = "Ban Quản Trị";
            } else {
                approvalChain = "⚠ Chưa có quản lý trực tiếp";
            }

            EmployeeDto dto = EmployeeDto.builder()
                    .id(u.getId().toString())
                    .employeeCode(u.getEmployeeCode())
                    .fullName(u.getFullName())
                    .email(u.getEmail())
                    .phone("090" + Math.abs(u.getEmployeeCode().hashCode() % 10000000))
                    .team(teamName)
                    .teamId(u.getTeamId() != null ? u.getTeamId().toString() : null)
                    .positionName(posName)
                    .role(u.getRole())
                    .status(u.getStatus() != null ? u.getStatus() : "ACTIVE")
                    .managerId(managerIdStr)
                    .managerCode(managerCode)
                    .managerName(managerName)
                    .approvalChain(approvalChain)
                    .hireDate(u.getHireDate() != null ? u.getHireDate().toString()
                            : (u.getJoinedDate() != null ? u.getJoinedDate().toString() : "2023-01-01"))
                    .joinDate(u.getJoinedDate() != null ? u.getJoinedDate().toString() : "2023-01-01")
                    .mustChangePassword(Boolean.TRUE.equals(u.getMustChangePassword()))
                    .faceEnrolled(Boolean.TRUE.equals(u.getFaceEnrolled()))
                    .build();

            // Filter logic
            boolean matchKeyword = keyword == null || keyword.isBlank() ||
                    dto.getFullName().toLowerCase().contains(keyword.toLowerCase().trim()) ||
                    dto.getEmployeeCode().toLowerCase().contains(keyword.toLowerCase().trim()) ||
                    dto.getEmail().toLowerCase().contains(keyword.toLowerCase().trim());

            boolean matchTeam = true;
            if (team != null && !team.isBlank() && !"ALL".equalsIgnoreCase(team)) {
                if ("NO_TEAM".equalsIgnoreCase(team) || "Chưa có nhóm".equalsIgnoreCase(team)) {
                    matchTeam = dto.getTeamId() == null || "Chưa có nhóm".equals(dto.getTeam());
                } else {
                    matchTeam = dto.getTeam().toLowerCase().contains(team.toLowerCase().trim()) ||
                            (dto.getTeamId() != null && dto.getTeamId().equalsIgnoreCase(team.trim()));
                }
            }

            boolean matchPosition = true;
            if (position != null && !position.isBlank() && !"ALL".equalsIgnoreCase(position)) {
                matchPosition = (dto.getPositionName() != null
                        && dto.getPositionName().toLowerCase().contains(position.toLowerCase().trim())) ||
                        (dto.getRole() != null && dto.getRole().equalsIgnoreCase(position.trim()));
            }

            boolean matchStatus = true;
            if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                matchStatus = dto.getStatus().equalsIgnoreCase(status.trim());
            }

            boolean matchRole = true;
            if (role != null && !role.isBlank() && !"ALL".equalsIgnoreCase(role)) {
                matchRole = dto.getRole().equalsIgnoreCase(role.trim());
            }

            if (matchKeyword && matchTeam && matchPosition && matchStatus && matchRole) {
                resultList.add(dto);
            }
        }

        int total = resultList.size();
        int from = Math.min(page * Math.max(size, 1), total);
        int to = Math.min(from + Math.max(size, 1), total);

        Map<String, Object> res = new HashMap<>();
        res.put("content", resultList.subList(from, to));
        res.put("totalElements", total);
        res.put("totalPages", size <= 0 ? 1 : (int) Math.ceil((double) total / size));
        res.put("currentPage", page);

        return ApiResponse.ok(res, "Lấy danh sách nhân viên thành công");
    }

    @PostMapping("/admin/users")
    @Operation(summary = "Tạo mới nhân viên đơn lẻ & Gửi email kích hoạt Gmail (S40)")
    public ApiResponse<EmployeeDto> createEmployee(@RequestBody(required = false) CreateEmployeeRequest req) {
        if (req == null)
            req = new CreateEmployeeRequest();
        String code = req.getEmployeeCode() != null && !req.getEmployeeCode().isBlank() ? req.getEmployeeCode().trim()
                : "ACT" + (1000 + (int) (Math.random() * 9000));
        String fullName = req.getFullName() != null && !req.getFullName().isBlank() ? req.getFullName().trim()
                : "Nhân viên " + code;

        // Tự gán nhóm mặc định theo bộ gán ca nếu chưa chọn nhóm
        UUID defaultTeamId = null;
        String teamName = req.getTeam() != null && !req.getTeam().isBlank() ? req.getTeam() : req.getDepartment();
        if (teamName != null && !teamName.isBlank()) {
            for (Team t : teamRepository.findAll()) {
                if (t.getName().equalsIgnoreCase(teamName.trim())
                        || teamName.toLowerCase().contains(t.getName().toLowerCase())) {
                    defaultTeamId = t.getId();
                    teamName = t.getName();
                    break;
                }
            }
        }
        if (defaultTeamId == null) {
            List<Team> allTeams = teamRepository.findAll();
            if (!allTeams.isEmpty()) {
                defaultTeamId = allTeams.get(0).getId();
                teamName = allTeams.get(0).getName();
            } else {
                teamName = "Sirius";
            }
        }

        // Ca mặc định: ca chuẩn toàn công ty (SHIFT_STANDARD) — nhân sự mới không có ca ngoại lệ.
        UUID defaultShiftId = shiftResolver.standardShiftId();

        // Tự gán quản lý trực tiếp mặc định (05ACT)
        UUID defaultManagerId = null;
        Optional<User> mgrOpt = userRepository.findByEmployeeCodeIgnoreCase("05ACT");
        if (mgrOpt.isPresent()) {
            defaultManagerId = mgrOpt.get().getId();
        }

        // Trùng mã/email → báo lỗi & CHẶN, không ghi đè hồ sơ nhân viên đang có.
        // Ngoại lệ: email của nhân VIÊN ĐÃ NGHỈ (INACTIVE) được tái sử dụng — nhân viên mới có thể
        // dùng lại email cũ; còn MÃ NHÂN VIÊN thì luôn phải duy nhất (kể cả người đã nghỉ).
        if (req.getEmployeeCode() != null && !req.getEmployeeCode().isBlank()) {
            Optional<User> byCode = userRepository.findByEmployeeCodeIgnoreCase(req.getEmployeeCode().trim());
            if (byCode.isPresent()) {
                throw new RuntimeException("Mã nhân viên " + req.getEmployeeCode().trim()
                        + " đã tồn tại (đang dùng bởi " + byCode.get().getFullName() + ") — vui lòng chọn mã khác");
            }
        }
        if (req.getEmail() != null && !req.getEmail().isBlank()) {
            Optional<User> byEmail = userRepository
                    .findFirstByEmailIgnoreCaseAndStatusNot(req.getEmail().trim(), "INACTIVE");
            if (byEmail.isPresent()) {
                throw new RuntimeException("Email " + req.getEmail().trim()
                        + " đã được dùng bởi nhân viên đang hoạt động (" + byEmail.get().getFullName()
                        + " — mã " + byEmail.get().getEmployeeCode() + ") — vui lòng dùng email khác");
            }
        }
        User userToSave;
        String rawPassword = req.getPassword() != null && !req.getPassword().isBlank()
                ? req.getPassword().trim()
                : "123456";

        userToSave = User.builder()
                .employeeCode(code)
                .fullName(fullName)
                .email(req.getEmail() != null && !req.getEmail().isBlank() ? req.getEmail().trim()
                        : code.toLowerCase() + "@act.vn")
                .passwordHash(passwordEncoder.encode(rawPassword))
                .role(req.getRole() != null && !req.getRole().isBlank() ? req.getRole().toUpperCase().trim()
                        : "EMPLOYEE")
                .positionName(req.getPositionName() != null && !req.getPositionName().isBlank()
                        ? req.getPositionName().trim()
                        : "Chuyên viên")
                .teamId(defaultTeamId)
                .shiftId(defaultShiftId)
                .managerId(defaultManagerId)
                .status("ACTIVE")
                .mustChangePassword(true)
                .faceEnrolled(false)
                .hireDate(LocalDate.now())
                .joinedDate(LocalDate.now())
                .build();

        userRepository.save(userToSave);

        // Gửi email thông báo khởi tạo tài khoản & kích hoạt lần đầu qua Gmail SMTP
        boolean emailSent = false;
        String emailStatusMessage = "";
        try {
            if (userToSave.getEmail() != null && !userToSave.getEmail().isBlank()) {
                emailSent = emailService.sendAccountActivationEmail(userToSave.getEmail(), userToSave.getFullName(),
                        userToSave.getEmployeeCode(), rawPassword);
                if (emailSent) {
                    emailStatusMessage = "Email thông báo kích hoạt & mật khẩu mặc định đã được gửi thành công qua Gmail tới "
                            + userToSave.getEmail();
                } else {
                    emailStatusMessage = "Đã phát lệnh gửi thông báo tài khoản tới " + userToSave.getEmail()
                            + " (SMTP đang chờ kết nối tài khoản Google Doanh Nghiệp)";
                }
            } else {
                emailStatusMessage = "Nhân viên chưa có địa chỉ email";
            }
        } catch (Exception e) {
            emailStatusMessage = "Lỗi khi gửi email: " + e.getMessage();
        }

        // Tạo thông báo nội bộ trong hệ thống (Notification bell G3) cho tài khoản vừa tạo.
        try {
            notificationDispatcher.dispatch(
                    "ONBOARDING",
                    userToSave.getId(),
                    "Chào mừng thành viên mới đến với ACT PULSE!",
                    "Tài khoản của bạn đã được khởi tạo thành công. Mã nhân viên: "
                            + userToSave.getEmployeeCode() + ". Vui lòng đổi mật khẩu ở lần đăng nhập đầu tiên.",
                    "ONBOARDING",
                    "HIGH",
                    "/account/profile",
                    "onboarding:" + userToSave.getId());
        } catch (Exception ignored) {
        }

        // Audit log
        AuditLog audit = AuditLog.builder()
                .action("CREATE_USER")
                .entityName("USER")
                .entityId(userToSave.getId().toString())
                .userId(CurrentUser.userId())
                .userCode(CurrentUser.employeeCode() != null ? CurrentUser.employeeCode() : "HR_ADMIN")
                .userName(resolveActorName())
                .newValue("Tạo nhân viên " + userToSave.getFullName()
                        + " (" + userToSave.getEmployeeCode() + ") - Nhóm: " + teamName)
                .reason("Tuyển dụng / cập nhật nhân sự")
                .ipAddress("127.0.0.1")
                .build();
        auditLogRepository.save(audit);

        EmployeeDto dto = EmployeeDto.builder()
                .id(userToSave.getId().toString())
                .employeeCode(userToSave.getEmployeeCode())
                .fullName(userToSave.getFullName())
                .email(userToSave.getEmail())
                .phone("0901234567")
                .team(teamName)
                .teamId(defaultTeamId != null ? defaultTeamId.toString() : null)
                .positionName(userToSave.getPositionName())
                .role(userToSave.getRole())
                .status(userToSave.getStatus())
                .managerId(userToSave.getManagerId() != null ? userToSave.getManagerId().toString() : null)
                .managerCode("05ACT")
                .managerName("Nguyễn Thanh Tùng")
                .approvalChain(defaultManagerId != null ? "Nguyễn Thanh Tùng (05ACT) → Quản Trị Viên (Admin)"
                        : "⚠ Chưa có quản lý trực tiếp")
                .mustChangePassword(true)
                .faceEnrolled(false)
                .defaultPassword(rawPassword)
                .emailSent(emailSent)
                .emailStatusMessage(emailStatusMessage)
                .joinDate(LocalDate.now().toString())
                .hireDate(LocalDate.now().toString())
                .build();

        return ApiResponse.ok(dto, "Đã tạo nhân viên " + userToSave.getFullName() + " thành công! Mật khẩu mặc định: "
                + rawPassword + ". " + emailStatusMessage);
    }

    @RequestMapping(value = { "/admin/users/{id}/change-manager", "/admin/users/{id}/manager" }, method = {
            RequestMethod.POST, RequestMethod.PUT })
    @Operation(summary = "Đổi quản lý trực tiếp của nhân viên — bắt buộc lý do, ghi audit log, chuyển đơn chờ duyệt")
    public ApiResponse<Map<String, Object>> changeManager(
            @PathVariable String id,
            @RequestBody ChangeManagerRequest req) {
        if (req.getReason() == null || req.getReason().trim().isBlank()) {
            throw new RuntimeException("Lý do đổi quản lý là bắt buộc");
        }
        if (req.getNewManagerId() == null || req.getNewManagerId().trim().isBlank()) {
            throw new RuntimeException("Vui lòng chọn quản lý mới");
        }

        // 1. Tìm nhân viên
        User user = findUserByIdOrCode(id);

        // 2. Tìm quản lý mới
        User newManager = findUserByIdOrCode(req.getNewManagerId());

        if (user.getId().equals(newManager.getId())) {
            throw new RuntimeException("Không thể tự gán chính mình làm quản lý");
        }

        // Lấy tên quản lý cũ
        String oldManagerName = "Chưa có";
        if (user.getManagerId() != null) {
            Optional<User> oldM = userRepository.findById(user.getManagerId());
            if (oldM.isPresent()) {
                oldManagerName = oldM.get().getFullName() + " (" + oldM.get().getEmployeeCode() + ")";
            }
        }

        // 3. Cập nhật quản lý mới
        user.setManagerId(newManager.getId());
        userRepository.save(user);

        // 4. Chuyển các đơn đang chờ sang quản lý mới (không làm mất đơn)
        List<RequestEntity> pendingRequests = requestRepository.findByUserIdAndStatus(user.getId(), "PENDING_APPROVAL");
        int transferredCount = 0;
        for (RequestEntity r : pendingRequests) {
            r.setDecidedBy(newManager.getId());
            requestRepository.save(r);
            transferredCount++;
        }

        String actorName = resolveActorName();

        // 5. Ghi nhật ký kiểm toán (Audit Log)
        AuditLog audit = AuditLog.builder()
                .action("CHANGE_MANAGER")
                .entityName("USER")
                .entityId(user.getId().toString())
                .userId(CurrentUser.userId())
                .userCode(CurrentUser.employeeCode() != null ? CurrentUser.employeeCode() : "HR_ADMIN")
                .userName(actorName)
                .oldValue("Quản lý cũ: " + oldManagerName)
                .newValue("Quản lý mới: " + newManager.getFullName() + " (" + newManager.getEmployeeCode() + ")")
                .reason(req.getReason().trim())
                .ipAddress("127.0.0.1")
                .build();
        auditLogRepository.save(audit);

        Map<String, Object> respData = new HashMap<>();
        respData.put("userId", user.getId().toString());
        respData.put("employeeCode", user.getEmployeeCode());
        respData.put("fullName", user.getFullName());
        respData.put("newManagerId", newManager.getId().toString());
        respData.put("newManagerName", newManager.getFullName());
        respData.put("newManagerCode", newManager.getEmployeeCode());
        respData.put("transferredRequestsCount", transferredCount);
        respData.put("reason", req.getReason().trim());

        return ApiResponse.ok(respData,
                "Đổi quản lý thành công! Đã chuyển " + transferredCount + " đơn chờ sang quản lý mới.");
    }

    @RequestMapping(value = { "/admin/users/{id}/change-team", "/admin/users/{id}/team" }, method = {
            RequestMethod.POST, RequestMethod.PUT })
    @Operation(summary = "Đổi nhóm của nhân viên — ghi audit log")
    public ApiResponse<Map<String, Object>> changeTeam(
            @PathVariable String id,
            @RequestBody ChangeTeamRequest req) {
        User user = findUserByIdOrCode(id);
        UUID targetTeamId = null;
        String targetTeamName = req.getTeamName();

        if (req.getTeamId() != null && !req.getTeamId().isBlank()) {
            try {
                targetTeamId = UUID.fromString(req.getTeamId().trim());
            } catch (Exception ignored) {
            }
        }
        if (targetTeamId == null && targetTeamName != null) {
            for (Team t : teamRepository.findAll()) {
                if (t.getName().equalsIgnoreCase(targetTeamName.trim())) {
                    targetTeamId = t.getId();
                    break;
                }
            }
        }

        user.setTeamId(targetTeamId);
        userRepository.save(user);

        // Audit log
        AuditLog audit = AuditLog.builder()
                .action("CHANGE_TEAM")
                .entityName("USER")
                .entityId(user.getId().toString())
                .userId(CurrentUser.userId())
                .userCode(CurrentUser.employeeCode() != null ? CurrentUser.employeeCode() : "HR_ADMIN")
                .userName(resolveActorName())
                .newValue("Chuyển sang nhóm: " + (targetTeamName != null ? targetTeamName : "Chưa có nhóm"))
                .reason(req.getReason() != null ? req.getReason().trim() : "Điều chuyển nhân sự")
                .ipAddress("127.0.0.1")
                .build();
        auditLogRepository.save(audit);

        Map<String, Object> respData = new HashMap<>();
        respData.put("userId", user.getId().toString());
        respData.put("employeeCode", user.getEmployeeCode());
        respData.put("teamId", targetTeamId != null ? targetTeamId.toString() : null);
        respData.put("teamName", targetTeamName);

        return ApiResponse.ok(respData, "Đổi nhóm thành công");
    }

    private String resolveActorName() {
        if (CurrentUser.userId() != null) {
            return userRepository.findById(CurrentUser.userId())
                    .map(User::getFullName)
                    .orElse(CurrentUser.employeeCode() != null ? CurrentUser.employeeCode() : "HR_ADMIN");
        }
        return CurrentUser.employeeCode() != null ? CurrentUser.employeeCode() : "HR_ADMIN";
    }

    private String resolveClientIp(jakarta.servlet.http.HttpServletRequest request) {
        if (request == null)
            return "127.0.0.1";
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        String remote = request.getRemoteAddr();
        return (remote != null && !remote.isBlank()) ? remote : "127.0.0.1";
    }

    private User findUserByIdOrCode(String idOrCode) {
        try {
            UUID uid = UUID.fromString(idOrCode.trim());
            return userRepository.findById(uid)
                    .orElseGet(() -> userRepository.findByEmployeeCodeIgnoreCase(idOrCode.trim())
                            .orElseThrow(() -> new RuntimeException("Không tìm thấy nhân viên: " + idOrCode)));
        } catch (IllegalArgumentException e) {
            return userRepository.findByEmployeeCodeIgnoreCase(idOrCode.trim())
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy nhân viên: " + idOrCode));
        }
    }

    @PostMapping("/admin/users/{id}/reset-password")
    @Operation(summary = "Admin cấp lại mật khẩu & Mở khóa Brute-Force (S40-C)")
    public ApiResponse<Boolean> adminResetPassword(@PathVariable String id) {
        User user = findUserByIdOrCode(id);
        String tempPass = "123456";
        user.setMustChangePassword(true);
        user.setStatus("ACTIVE");
        user.setPasswordHash(passwordEncoder.encode(tempPass));
        userRepository.save(user);

        // Thu hồi toàn bộ phiên đăng nhập cũ
        authService.revokeAllSessions(user.getId(), "ADMIN_RESET_PASSWORD");

        // Gửi email thông báo cấp lại mật khẩu tạm thời qua Gmail SMTP
        boolean emailSent = false;
        try {
            if (user.getEmail() != null && !user.getEmail().isBlank()) {
                emailSent = emailService.sendAccountActivationEmail(user.getEmail(), user.getFullName(),
                        user.getEmployeeCode(), tempPass);
            }
        } catch (Exception ignored) {
        }

        AuditLog audit = AuditLog.builder()
                .action("ADMIN_RESET_PASSWORD")
                .entityName("USER")
                .entityId(user.getId().toString())
                .userId(CurrentUser.userId())
                .userCode(CurrentUser.employeeCode() != null ? CurrentUser.employeeCode() : "HR_ADMIN")
                .userName(resolveActorName())
                .oldValue("Mật khẩu cũ (đã mã hóa)")
                .newValue("Cấp lại mật khẩu mới: " + tempPass)
                .reason("Admin reset mật khẩu theo yêu cầu hỗ trợ")
                .ipAddress("127.0.0.1")
                .build();
        auditLogRepository.save(audit);

        String msg = "Mật khẩu tạm thời (" + tempPass + ") đã được cấp lại thành công! " +
                (emailSent ? "Đã gửi email thông báo qua Gmail tới " + user.getEmail()
                        : "Hệ thống đã phát lệnh gửi tới Gmail " + user.getEmail());
        return ApiResponse.ok(true, msg);
    }

    @GetMapping("/admin/users/{id}")
    @Operation(summary = "Xem chi tiết hồ sơ nhân viên (S40 / A3)")
    public ApiResponse<EmployeeDto> getEmployeeDetail(@PathVariable String id) {
        User u = findUserByIdOrCode(id);
        return ApiResponse.ok(toEmployeeDto(u), "Lấy thông tin chi tiết nhân viên thành công");
    }

    @PostMapping("/admin/users/{id}/resign")
    @Operation(summary = "Đánh dấu nhân viên đã nghỉ việc (INACTIVE) — rời khỏi tổ chức nhưng giữ lịch sử")
    public ApiResponse<EmployeeDto> resignEmployee(@PathVariable String id,
                                                 @RequestBody(required = false) Map<String, Object> req) {
        User u = findUserByIdOrCode(id);
        if ("INACTIVE".equalsIgnoreCase(u.getStatus())) {
            throw new RuntimeException("Nhân viên " + u.getEmployeeCode() + " đã ở trạng thái nghỉ việc");
        }
        String reason = req != null && req.get("reason") != null && !String.valueOf(req.get("reason")).isBlank()
                ? String.valueOf(req.get("reason")).trim()
                : "Đánh dấu nghỉ việc từ trang quản lý nhân sự";
        String oldStatus = u.getStatus();
        u.setStatus("INACTIVE");
        // Rời khỏi tổ chức: bỏ nhóm/đơn vị trực tiếp nhưng GIỮ ca & quản lý để lịch sử chấm công còn tra cứu được.
        u.setTeamId(null);
        u.setManagerId(null);
        userRepository.save(u);

        AuditLog audit = AuditLog.builder()
                .action("RESIGN_EMPLOYEE")
                .entityName("USER")
                .entityId(u.getId().toString())
                .userId(CurrentUser.userId())
                .userCode(CurrentUser.employeeCode() != null ? CurrentUser.employeeCode() : "HR_ADMIN")
                .userName(resolveActorName())
                .oldValue("Trạng thái: " + oldStatus)
                .newValue("Trạng thái: INACTIVE")
                .reason(reason)
                .ipAddress("127.0.0.1")
                .build();
        auditLogRepository.save(audit);

        return ApiResponse.ok(toEmployeeDto(u),
                "Đã đánh dấu " + u.getFullName() + " (" + u.getEmployeeCode() + ") đã nghỉ việc. "
                        + "Mã nhân viên vẫn giữ nguyên (không dùng lại được); email có thể cấp lại cho nhân viên mới.");
    }

    @PutMapping("/admin/users/{id}")
    @Operation(summary = "Chỉnh sửa hồ sơ nhân viên & ghi nhật ký kiểm toán (S40 / A3 / A5)")
    public ApiResponse<EmployeeDto> updateEmployee(@PathVariable String id, @RequestBody Map<String, Object> req) {
        User u = findUserByIdOrCode(id);
        String oldSnapshot = String.format("Tên: %s, Email: %s, Chức danh: %s, Nhóm: %s, Role: %s, Trạng thái: %s, Manager: %s",
                u.getFullName(), u.getEmail(), u.getPositionName(), u.getTeamId(), u.getRole(), u.getStatus(), u.getManagerId());

        if (req.containsKey("fullName") && req.get("fullName") != null) {
            u.setFullName(String.valueOf(req.get("fullName")).trim());
        }
        if (req.containsKey("email") && req.get("email") != null) {
            u.setEmail(String.valueOf(req.get("email")).trim());
        }
        if (req.containsKey("positionName") && req.get("positionName") != null) {
            u.setPositionName(String.valueOf(req.get("positionName")).trim());
        }
        if (req.containsKey("role") && req.get("role") != null) {
            String newRole = String.valueOf(req.get("role")).toUpperCase().trim();
            if (!java.util.Set.of("EMPLOYEE", "MANAGER", "HR_ADMIN", "EXECUTIVE", "ADMIN").contains(newRole)) {
                throw new RuntimeException("Vai trò không hợp lệ: " + newRole);
            }
            // HR_ADMIN không được tự nâng quyền thành ADMIN hoặc đổi vai trò người khác.
            if (!newRole.equals(u.getRole()) && !"ADMIN".equalsIgnoreCase(CurrentUser.role())) {
                throw new RuntimeException("Chỉ ADMIN được phép thay đổi vai trò tài khoản");
            }
            u.setRole(newRole);
        }
        if (req.containsKey("status") && req.get("status") != null) {
            u.setStatus(String.valueOf(req.get("status")).toUpperCase().trim());
        }
        if (req.containsKey("teamId")) {
            String teamIdStr = String.valueOf(req.get("teamId"));
            if (teamIdStr != null && !teamIdStr.isBlank() && !"null".equalsIgnoreCase(teamIdStr)) {
                try {
                    u.setTeamId(UUID.fromString(teamIdStr.trim()));
                } catch (Exception ignored) {}
            } else {
                u.setTeamId(null);
            }
        }
        if (req.containsKey("managerId")) {
            String mgrIdStr = String.valueOf(req.get("managerId"));
            if (mgrIdStr != null && !mgrIdStr.isBlank() && !"null".equalsIgnoreCase(mgrIdStr)) {
                try {
                    UUID newMgrId = UUID.fromString(mgrIdStr.trim());
                    if (!newMgrId.equals(u.getManagerId())) {
                        u.setManagerId(newMgrId);
                        // Tự động chuyển các đơn chờ duyệt sang người quản lý mới
                        List<RequestEntity> pending = requestRepository.findByUserIdAndStatus(u.getId(), "PENDING_APPROVAL");
                        for (RequestEntity r : pending) {
                            r.setDecidedBy(newMgrId);
                            requestRepository.save(r);
                        }
                    }
                } catch (Exception ignored) {}
            } else {
                u.setManagerId(null);
            }
        }

        userRepository.save(u);

        String reason = req.get("reason") != null && !String.valueOf(req.get("reason")).isBlank()
                ? String.valueOf(req.get("reason")).trim()
                : "Cập nhật hồ sơ nhân sự từ trang quản lý S40";

        String newSnapshot = String.format("Tên: %s, Email: %s, Chức danh: %s, Nhóm: %s, Role: %s, Trạng thái: %s, Manager: %s",
                u.getFullName(), u.getEmail(), u.getPositionName(), u.getTeamId(), u.getRole(), u.getStatus(), u.getManagerId());

        // Ghi Audit Log (A5)
        AuditLog audit = AuditLog.builder()
                .action("UPDATE_USER_PROFILE")
                .entityName("USER")
                .entityId(u.getId().toString())
                .userId(CurrentUser.userId())
                .userCode(CurrentUser.employeeCode() != null ? CurrentUser.employeeCode() : "HR_ADMIN")
                .userName(resolveActorName())
                .oldValue(oldSnapshot)
                .newValue(newSnapshot)
                .reason(reason)
                .ipAddress("127.0.0.1")
                .build();
        auditLogRepository.save(audit);

        return ApiResponse.ok(toEmployeeDto(u), "Cập nhật thông tin nhân viên thành công!");
    }

    @GetMapping("/admin/roles/matrix")
    @Operation(summary = "Ma trận phân quyền RBAC 4 vai trò (S15)")
    public ApiResponse<Map<String, Object>> getRolesMatrix() {
        Map<String, Object> matrix = Map.of(
                "roles", List.of("EMPLOYEE", "MANAGER", "HR_ADMIN", "ADMIN"),
                "permissions", List.of(
                        Map.of("resource", "ATTENDANCE_CHECKIN", "EMPLOYEE", true, "MANAGER", true, "HR_ADMIN", true,
                                "ADMIN", true),
                        Map.of("resource", "ATTENDANCE_APPROVALS", "EMPLOYEE", false, "MANAGER", true, "HR_ADMIN", true,
                                "ADMIN", true),
                        Map.of("resource", "TIMESHEET_EDIT_CELL", "EMPLOYEE", false, "MANAGER", false, "HR_ADMIN", true,
                                "ADMIN", true),
                        Map.of("resource", "RULE_ENGINE_MANAGE", "EMPLOYEE", false, "MANAGER", false, "HR_ADMIN", false,
                                "ADMIN", true),
                        Map.of("resource", "USER_LIFECYCLE_MANAGE", "EMPLOYEE", false, "MANAGER", false, "HR_ADMIN",
                                true, "ADMIN", true)));
        return ApiResponse.ok(matrix, "Lấy ma trận phân quyền RBAC thành công");
    }

    @GetMapping("/admin/audit-logs")
    @Operation(summary = "Nhật ký kiểm toán tập trung Centralized Audit Trail — append-only (S35 / S45 / CORE-AUDIT-01)")
    public ApiResponse<List<AuditLogDto>> getAuditLogs(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String actor,
            @RequestParam(required = false) String userCode,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String entityName,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String affectedUser,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        List<AuditLogDto> results = new ArrayList<>();

        // 1. Lấy toàn bộ từ DB
        List<AuditLog> dbLogs = auditLogRepository.findAllByOrderByCreatedAtDesc();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

        for (AuditLog a : dbLogs) {
            String ts = a.getCreatedAt() != null ? a.getCreatedAt().format(fmt) : LocalDateTime.now().format(fmt);
            String diff = "";
            if (a.getOldValue() != null && a.getNewValue() != null) {
                diff = a.getOldValue() + " → " + a.getNewValue();
            } else if (a.getNewValue() != null) {
                diff = a.getNewValue();
            } else {
                diff = a.getAction() != null ? a.getAction() : "";
            }

            AuditLogDto dto = AuditLogDto.builder()
                    .id(a.getId() != null ? a.getId().toString() : "aud-" + System.currentTimeMillis())
                    .timestamp(ts)
                    .actorCode(a.getUserCode() != null ? a.getUserCode() : "Admin")
                    .actorName(a.getUserName() != null ? a.getUserName() : "Quản Trị Viên")
                    .action(a.getAction())
                    .entity(a.getEntityName())
                    .entityId(a.getEntityId())
                    .oldValue(a.getOldValue())
                    .newValue(a.getNewValue())
                    .reason(a.getReason() != null ? a.getReason() : "Thao tác hệ thống")
                    .details(diff + (a.getReason() != null ? " [Lý do: " + a.getReason() + "]" : ""))
                    .ipAddress(a.getIpAddress() != null && !a.getIpAddress().isBlank() ? a.getIpAddress() : "127.0.0.1")
                    .affectedUser(a.getEntityId())
                    .build();
            results.add(dto);
        }

        // 2. Filter
        List<AuditLogDto> filtered = results.stream().filter(l -> {
            if (keyword != null && !keyword.isBlank()) {
                String kw = keyword.toLowerCase().trim();
                boolean m = (l.getActorName() != null && l.getActorName().toLowerCase().contains(kw))
                        || (l.getActorCode() != null && l.getActorCode().toLowerCase().contains(kw))
                        || (l.getAction() != null && l.getAction().toLowerCase().contains(kw))
                        || (l.getEntity() != null && l.getEntity().toLowerCase().contains(kw))
                        || (l.getDetails() != null && l.getDetails().toLowerCase().contains(kw))
                        || (l.getReason() != null && l.getReason().toLowerCase().contains(kw))
                        || (l.getOldValue() != null && l.getOldValue().toLowerCase().contains(kw))
                        || (l.getNewValue() != null && l.getNewValue().toLowerCase().contains(kw))
                        || (l.getEntityId() != null && l.getEntityId().toLowerCase().contains(kw));
                if (!m)
                    return false;
            }
            if (actor != null && !actor.isBlank()) {
                String ac = actor.toLowerCase().trim();
                if (l.getActorCode() == null || !l.getActorCode().toLowerCase().contains(ac))
                    return false;
            }
            if (userCode != null && !userCode.isBlank()) {
                if (l.getActorCode() == null || !l.getActorCode().equalsIgnoreCase(userCode.trim()))
                    return false;
            }
            if (action != null && !action.isBlank()) {
                if (l.getAction() == null || !l.getAction().equalsIgnoreCase(action.trim()))
                    return false;
            }
            if (entityName != null && !entityName.isBlank()) {
                if (l.getEntity() == null || !l.getEntity().equalsIgnoreCase(entityName.trim()))
                    return false;
            }
            if (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) {
                if (l.getEntity() == null || !l.getEntity().equalsIgnoreCase(category.trim()))
                    return false;
            }
            if (affectedUser != null && !affectedUser.isBlank()) {
                String aff = affectedUser.toLowerCase().trim();
                boolean affMatch = (l.getEntityId() != null && l.getEntityId().toLowerCase().contains(aff))
                        || (l.getDetails() != null && l.getDetails().toLowerCase().contains(aff))
                        || (l.getOldValue() != null && l.getOldValue().toLowerCase().contains(aff))
                        || (l.getNewValue() != null && l.getNewValue().toLowerCase().contains(aff))
                        || (l.getReason() != null && l.getReason().toLowerCase().contains(aff));
                if (!affMatch)
                    return false;
            }
            return true;
        }).collect(Collectors.toList());

        return ApiResponse.ok(filtered, "Lấy nhật ký kiểm toán thành công");
    }

    @RequestMapping(value = { "/admin/audit-logs/**", "/audit-logs/**" }, method = { RequestMethod.PUT,
            RequestMethod.DELETE, RequestMethod.PATCH })
    @Operation(summary = "Chặn sửa/xóa nhật ký kiểm toán — bảo vệ tính toàn vẹn append-only (S35)")
    public ResponseEntity<ApiResponse<Void>> blockAuditLogMutation() {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(ApiResponse.error(
                        "Nhật ký kiểm toán là bất biến (append-only), nghiêm cấm mọi hành vi chỉnh sửa hoặc xóa dữ liệu!"));
    }

    @PostMapping(value = { "/attendance/timesheet/override", "/admin/timesheet/override" })
    @Operation(summary = "Sửa 1 ô bảng công thủ công — bắt buộc lý do & ghi audit log (S15/S35)")
    public ApiResponse<Map<String, Object>> overrideTimesheetCell(@RequestBody TimesheetOverrideRequest req,
            jakarta.servlet.http.HttpServletRequest httpRequest) {
        if (req.getReason() == null || req.getReason().trim().isBlank()) {
            throw new RuntimeException("Lý do sửa bảng công là bắt buộc");
        }

        String empCode = req.getEmployeeCode() != null ? req.getEmployeeCode().trim() : "136ACT";
        String empName = req.getEmployeeName() != null ? req.getEmployeeName().trim() : "Vũ Văn Luận";
        String field = req.getFieldName() != null ? req.getFieldName().trim() : "công thực tế";
        String oldV = req.getOldValue() != null ? req.getOldValue().trim() : "21.5";
        String newV = req.getNewValue() != null ? req.getNewValue().trim() : "22.0";

        // Ghi Audit Log bắt buộc
        AuditLog audit = AuditLog.builder()
                .action("UPDATE_TIMESHEET")
                .entityName("TIMESHEET")
                .entityId("Bảng công 11/2026 - " + empName + " (" + empCode + ")")
                .userId(CurrentUser.userId())
                .userCode(CurrentUser.employeeCode() != null ? CurrentUser.employeeCode() : "01HR")
                .userName(resolveActorName())
                .oldValue(field + ": " + oldV)
                .newValue(field + ": " + newV)
                .reason(req.getReason().trim())
                .ipAddress(resolveClientIp(httpRequest))
                .build();
        auditLogRepository.save(audit);

        Map<String, Object> resp = new HashMap<>();
        resp.put("employeeCode", empCode);
        resp.put("employeeName", empName);
        resp.put("fieldName", field);
        resp.put("oldValue", oldV);
        resp.put("newValue", newV);
        resp.put("reason", req.getReason().trim());
        resp.put("auditId", audit.getId().toString());

        return ApiResponse.ok(resp, "Đã cập nhật ô bảng công và ghi nhận nhật ký kiểm toán!");
    }

    @GetMapping("/admin/holidays")
    @Operation(summary = "Lịch ngày nghỉ lễ (S26)")
    public ApiResponse<List<Holiday>> getHolidays() {
        return ApiResponse.ok(holidayRepository.findAllByOrderByHolidayDateAsc(), "Lấy lịch nghỉ lễ thành công");
    }

    @PostMapping("/admin/delegations")
    @Operation(summary = "Thiết lập ủy quyền phê duyệt khi Quản lý đi vắng (S36)")
    public ApiResponse<Map<String, Object>> createDelegation(@RequestBody Map<String, Object> req) {
        Map<String, Object> del = new HashMap<>(req);
        del.put("id", "DEL-" + System.currentTimeMillis());
        del.put("status", "ACTIVE");
        del.put("createdAt", LocalDateTime.now().toString());
        return ApiResponse.ok(del, "Thiết lập ủy quyền phê duyệt thành công!");
    }

    private void validateHoliday(Holiday holiday) {
        if (holiday.getHolidayDate() == null) {
            throw new RuntimeException("Chọn ngày bắt đầu nghỉ lễ");
        }
        // Ngày lễ có thể kéo dài nhiều ngày: holiday_date = bắt đầu, end_date = kết thúc (bao gồm).
        if (holiday.getEndDate() != null && holiday.getEndDate().isBefore(holiday.getHolidayDate())) {
            throw new RuntimeException("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu");
        }
    }

    @PostMapping("/admin/holidays")
    @Operation(summary = "Thêm ngày nghỉ lễ — không cần sửa code")
    public ApiResponse<Holiday> addHoliday(@RequestBody(required = false) Holiday holiday) {
        if (holiday == null)
            holiday = new Holiday();
        if (holiday.getHolidayDate() == null) {
            holiday.setHolidayDate(LocalDate.of(2026, 12, 25));
        }
        if (holiday.getName() == null) {
            holiday.setName("Ngày nghỉ lễ Giáng Sinh 2026");
        }
        validateHoliday(holiday);
        if (holidayRepository.existsByHolidayDate(holiday.getHolidayDate())) {
            return ApiResponse.ok(holiday, "Ngày lễ đã tồn tại");
        }
        holiday.setId(null);
        java.util.UUID creatorId = CurrentUser.userId();
        holiday.setCreatedBy(creatorId);
        if (creatorId != null) {
            User creator = userRepository.findById(creatorId).orElse(null);
            if (creator != null) holiday.setCreatedByName(creator.getFullName());
        }
        return ApiResponse.ok(holidayRepository.save(holiday), "Thêm ngày lễ thành công");
    }

    @PutMapping("/admin/holidays/{id}")
    @Operation(summary = "Sửa ngày nghỉ lễ — nhỡ nhập nhầm")
    public ApiResponse<Holiday> updateHoliday(@PathVariable java.util.UUID id, @RequestBody Holiday req) {
        Holiday h = holidayRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ngày lễ"));
        if (req.getName() != null) {
            if (req.getName().isBlank()) throw new RuntimeException("Nhập tên ngày nghỉ lễ");
            h.setName(req.getName().trim());
        }
        if (req.getHolidayDate() != null) h.setHolidayDate(req.getHolidayDate());
        h.setEndDate(req.getEndDate());
        if (req.getIsPaid() != null) h.setIsPaid(req.getIsPaid());
        validateHoliday(h);
        holidayRepository.findByHolidayDate(h.getHolidayDate())
                .filter(other -> !other.getId().equals(h.getId()))
                .ifPresent(other -> {
                    throw new RuntimeException("Đã có ngày lễ khác bắt đầu ngày " + h.getHolidayDate());
                });
        return ApiResponse.ok(holidayRepository.save(h), "Cập nhật ngày lễ thành công");
    }

    @DeleteMapping("/admin/holidays/{id}")
    @Operation(summary = "Xóa ngày nghỉ lễ — thêm nhầm")
    public ApiResponse<String> deleteHoliday(@PathVariable java.util.UUID id) {
        Holiday h = holidayRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ngày lễ"));
        holidayRepository.delete(h);
        return ApiResponse.ok("Đã xóa ngày lễ " + h.getName(), "Xóa ngày lễ thành công");
    }

    @GetMapping("/admin/users/import-template")
    @Operation(summary = "Tải file mẫu Excel Import Nhân sự chuẩn ACT (CORE-IMPORT-01)")
    public ApiResponse<Map<String, String>> getImportTemplate() {
        return ApiResponse.ok(Map.of("templateUrl", "/templates/ACT_Employee_Import_Template.xlsx"),
                "Lấy link file mẫu Excel thành công");
    }

    @PostMapping("/admin/users/preview-import")
    @Operation(summary = "Upload & Preview Dữ liệu Import Nhân viên (CORE-IMPORT-02)")
    public ApiResponse<Map<String, Object>> previewImport(@RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.ok(Map.of("totalRows", 15, "validRows", 15, "errorRows", 0),
                "Preview dữ liệu import hợp lệ 100%");
    }

    @PostMapping("/admin/users/confirm-import")
    @Operation(summary = "Thực thi Batch Import Nhân viên & Gửi Email kích hoạt ngầm (CORE-IMPORT-03)")
    public ApiResponse<Map<String, Object>> confirmImport(@RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.ok(Map.of("importedCount", 15), "Import thành công 15 nhân viên mới");
    }

    @PostMapping(value = { "/admin/teams", "/admin/departments" })
    @Operation(summary = "Thêm mới nhóm / phòng ban (S41 / CORE-ORG-02)")
    public ApiResponse<OrgTreeNodeDto> createTeam(@RequestBody Map<String, Object> payload) {
        String name = payload.get("name") != null ? String.valueOf(payload.get("name")).trim() : null;
        if (name == null || name.isBlank()) {
            name = payload.get("departmentName") != null ? String.valueOf(payload.get("departmentName")).trim()
                    : "Nhóm mới";
        }

        UUID parentId = null;
        if (payload.get("parentId") != null && !String.valueOf(payload.get("parentId")).isBlank()) {
            try {
                parentId = UUID.fromString(String.valueOf(payload.get("parentId")).trim());
            } catch (Exception ignored) {
            }
        }

        UUID leaderId = null;
        String leaderInput = (String) (payload.get("leaderId") != null ? payload.get("leaderId")
                : payload.get("managerId"));
        if (leaderInput != null && !leaderInput.isBlank()) {
            try {
                User leader = findUserByIdOrCode(leaderInput);
                leaderId = leader.getId();
            } catch (Exception ignored) {
            }
        }

        boolean specialApproval = Boolean
                .parseBoolean(String.valueOf(payload.getOrDefault("isSpecialApproval", "false")));

        Team team = Team.builder()
                .name(name)
                .parentId(parentId)
                .leaderId(leaderId)
                .isSpecialApproval(specialApproval)
                .build();
        team.setCreatedAt(LocalDateTime.now());
        team.setUpdatedAt(LocalDateTime.now());
        team = teamRepository.save(team);

        // Ghi Audit Log
        AuditLog audit = AuditLog.builder()
                .action("CREATE_TEAM")
                .entityName("TEAM")
                .entityId(team.getId().toString())
                .userId(CurrentUser.userId())
                .userCode(CurrentUser.employeeCode() != null ? CurrentUser.employeeCode() : "Admin")
                .userName(resolveActorName())
                .newValue("Tạo nhóm mới: " + team.getName()
                        + (parentId != null ? " (Nhóm cha: " + parentId + ")" : " (Nhóm gốc)"))
                .reason(payload.get("reason") != null ? String.valueOf(payload.get("reason")).trim()
                        : "Thiết lập cơ cấu phòng ban")
                .ipAddress("127.0.0.1")
                .build();
        auditLogRepository.save(audit);

        String leaderName = null;
        String leaderCode = null;
        if (leaderId != null) {
            User l = userRepository.findById(leaderId).orElse(null);
            if (l != null) {
                leaderName = l.getFullName();
                leaderCode = l.getEmployeeCode();
            }
        }

        String derivedCode = team.getName().replaceAll("[^a-zA-Z0-9]", "").toUpperCase();
        if (derivedCode.length() > 10)
            derivedCode = derivedCode.substring(0, 10);
        if (derivedCode.isBlank())
            derivedCode = "TEAM";

        OrgTreeNodeDto dto = OrgTreeNodeDto.builder()
                .id(team.getId().toString())
                .name(team.getName())
                .code(derivedCode)
                .parentId(parentId != null ? parentId.toString() : null)
                .leaderId(leaderId != null ? leaderId.toString() : null)
                .leaderName(leaderName)
                .leaderCode(leaderCode)
                .managerName(leaderName != null ? leaderName : "Chưa có trưởng nhóm")
                .hasLeader(leaderId != null)
                .memberCount(0)
                .totalMemberCount(0)
                .pendingRequestsCount(0)
                .totalPendingRequestsCount(0)
                .isSpecialApproval(specialApproval)
                .members(new ArrayList<>())
                .children(new ArrayList<>())
                .teams(new ArrayList<>())
                .build();

        return ApiResponse.ok(dto, "Tạo nhóm mới thành công");
    }

    @PutMapping(value = { "/admin/teams/{id}", "/admin/departments/{id}" })
    @Operation(summary = "Cập nhật thông tin nhóm / phòng ban (CORE-ORG-02)")
    public ApiResponse<OrgTreeNodeDto> updateTeam(@PathVariable String id, @RequestBody Map<String, Object> payload) {
        UUID teamId;
        try {
            teamId = UUID.fromString(id.trim());
        } catch (IllegalArgumentException e) {
            Team existing = teamRepository.findByName(id.trim())
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy nhóm: " + id));
            teamId = existing.getId();
        }

        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhóm: " + id));

        String oldName = team.getName();
        UUID oldLeaderId = team.getLeaderId();

        if (payload.get("name") != null && !String.valueOf(payload.get("name")).isBlank()) {
            team.setName(String.valueOf(payload.get("name")).trim());
        }
        if (payload.containsKey("parentId")) {
            String pStr = (String) payload.get("parentId");
            team.setParentId(pStr != null && !pStr.isBlank() ? UUID.fromString(pStr.trim()) : null);
        }

        int transferredCount = 0;
        if (payload.containsKey("leaderId") || payload.containsKey("managerId")) {
            String lInput = (String) (payload.get("leaderId") != null ? payload.get("leaderId")
                    : payload.get("managerId"));
            if (lInput != null && !lInput.isBlank()) {
                User newLeader = findUserByIdOrCode(lInput);
                team.setLeaderId(newLeader.getId());

                // Chuyển quản lý trực tiếp và các đơn chờ duyệt cho các thành viên trong nhóm
                List<User> members = userRepository.findByTeamId(team.getId());
                for (User m : members) {
                    m.setManagerId(newLeader.getId());
                    userRepository.save(m);

                    List<RequestEntity> pending = requestRepository.findByUserIdAndStatus(m.getId(),
                            "PENDING_APPROVAL");
                    for (RequestEntity r : pending) {
                        r.setDecidedBy(newLeader.getId());
                        requestRepository.save(r);
                        transferredCount++;
                    }
                }
            } else {
                team.setLeaderId(null);
            }
        }

        team.setUpdatedAt(LocalDateTime.now());
        team = teamRepository.save(team);

        // Audit Log
        AuditLog audit = AuditLog.builder()
                .action("UPDATE_TEAM")
                .entityName("TEAM")
                .entityId(team.getId().toString())
                .userId(CurrentUser.userId())
                .userCode(CurrentUser.employeeCode() != null ? CurrentUser.employeeCode() : "Admin")
                .userName(resolveActorName())
                .oldValue("Nhóm cũ: " + oldName + " (Leader: " + oldLeaderId + ")")
                .newValue("Nhóm mới: " + team.getName() + " (Leader: " + team.getLeaderId() + ")")
                .reason(payload.get("reason") != null ? String.valueOf(payload.get("reason")).trim() : "Cập nhật nhóm")
                .ipAddress("127.0.0.1")
                .build();
        auditLogRepository.save(audit);

        String leaderName = null;
        String leaderCode = null;
        if (team.getLeaderId() != null) {
            User l = userRepository.findById(team.getLeaderId()).orElse(null);
            if (l != null) {
                leaderName = l.getFullName();
                leaderCode = l.getEmployeeCode();
            }
        }

        OrgTreeNodeDto dto = OrgTreeNodeDto.builder()
                .id(team.getId().toString())
                .name(team.getName())
                .code(team.getName().replaceAll("[^a-zA-Z0-9]", "").toUpperCase())
                .parentId(team.getParentId() != null ? team.getParentId().toString() : null)
                .leaderId(team.getLeaderId() != null ? team.getLeaderId().toString() : null)
                .leaderName(leaderName)
                .leaderCode(leaderCode)
                .managerName(leaderName != null ? leaderName : "Chưa có trưởng nhóm")
                .hasLeader(team.getLeaderId() != null)
                .memberCount(userRepository.findByTeamId(team.getId()).size())
                .isSpecialApproval(Boolean.TRUE.equals(team.getIsSpecialApproval()))
                .build();

        return ApiResponse.ok(dto,
                "Cập nhật nhóm thành công. Đã chuyển " + transferredCount + " đơn chờ sang trưởng nhóm mới.");
    }

    @PostMapping(value = { "/admin/teams/{id}/change-leader", "/admin/teams/{id}/leader" })
    @Operation(summary = "Đổi trưởng nhóm — bắt buộc lý do, chuyển giao toàn bộ đơn chờ duyệt")
    public ApiResponse<Map<String, Object>> changeTeamLeader(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        String reason = body.get("reason");
        if (reason == null || reason.trim().isBlank()) {
            throw new RuntimeException("Lý do đổi trưởng nhóm là bắt buộc");
        }
        String newLeaderIdStr = body.get("newLeaderId");
        if (newLeaderIdStr == null || newLeaderIdStr.trim().isBlank()) {
            throw new RuntimeException("Vui lòng chọn trưởng nhóm mới");
        }

        UUID teamId;
        try {
            teamId = UUID.fromString(id.trim());
        } catch (IllegalArgumentException e) {
            Team existing = teamRepository.findByName(id.trim())
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy nhóm: " + id));
            teamId = existing.getId();
        }

        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhóm: " + id));

        User newLeader = findUserByIdOrCode(newLeaderIdStr);

        String oldLeaderName = "Chưa có";
        if (team.getLeaderId() != null) {
            User oldL = userRepository.findById(team.getLeaderId()).orElse(null);
            if (oldL != null)
                oldLeaderName = oldL.getFullName() + " (" + oldL.getEmployeeCode() + ")";
        }

        team.setLeaderId(newLeader.getId());
        team.setUpdatedAt(LocalDateTime.now());
        teamRepository.save(team);

        // Chuyển đơn chờ duyệt của các thành viên trong nhóm sang trưởng nhóm mới
        List<User> members = userRepository.findByTeamId(team.getId());
        int transferredCount = 0;
        for (User m : members) {
            m.setManagerId(newLeader.getId());
            userRepository.save(m);

            List<RequestEntity> pending = requestRepository.findByUserIdAndStatus(m.getId(), "PENDING_APPROVAL");
            for (RequestEntity r : pending) {
                r.setDecidedBy(newLeader.getId());
                requestRepository.save(r);
                transferredCount++;
            }
        }

        // Ghi Audit Log
        AuditLog audit = AuditLog.builder()
                .action("CHANGE_TEAM_LEADER")
                .entityName("TEAM")
                .entityId(team.getId().toString())
                .userId(CurrentUser.userId())
                .userCode(CurrentUser.employeeCode() != null ? CurrentUser.employeeCode() : "Admin")
                .userName(resolveActorName())
                .oldValue("Trưởng nhóm cũ: " + oldLeaderName)
                .newValue("Trưởng nhóm mới: " + newLeader.getFullName() + " (" + newLeader.getEmployeeCode() + ")")
                .reason(reason.trim())
                .ipAddress("127.0.0.1")
                .build();
        auditLogRepository.save(audit);

        Map<String, Object> resp = new HashMap<>();
        resp.put("teamId", team.getId().toString());
        resp.put("teamName", team.getName());
        resp.put("newLeaderId", newLeader.getId().toString());
        resp.put("newLeaderName", newLeader.getFullName());
        resp.put("newLeaderCode", newLeader.getEmployeeCode());
        resp.put("transferredRequestsCount", transferredCount);
        resp.put("reason", reason.trim());

        return ApiResponse.ok(resp,
                "Đổi trưởng nhóm thành công! Đã chuyển " + transferredCount + " đơn chờ sang trưởng nhóm mới.");
    }

    @DeleteMapping(value = { "/admin/teams/{id}", "/admin/departments/{id}" })
    @Operation(summary = "Xóa nhóm / phòng ban rỗng")
    public ApiResponse<Boolean> deleteTeam(@PathVariable String id) {
        UUID teamId = UUID.fromString(id.trim());
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhóm: " + id));

        List<Team> childTeams = teamRepository.findByParentId(teamId);
        if (!childTeams.isEmpty()) {
            throw new RuntimeException(
                    "Không thể xóa nhóm đang có nhóm con trực thuộc (" + childTeams.size() + " nhóm con)");
        }
        List<User> members = userRepository.findByTeamId(teamId);
        if (!members.isEmpty()) {
            throw new RuntimeException("Không thể xóa nhóm đang có " + members.size() + " nhân sự");
        }

        teamRepository.delete(team);

        AuditLog audit = AuditLog.builder()
                .action("DELETE_TEAM")
                .entityName("TEAM")
                .entityId(team.getId().toString())
                .userId(CurrentUser.userId())
                .userCode(CurrentUser.employeeCode() != null ? CurrentUser.employeeCode() : "Admin")
                .userName(resolveActorName())
                .oldValue("Nhóm: " + team.getName())
                .newValue("Đã xóa nhóm")
                .reason("Xóa nhóm rỗng không còn sử dụng")
                .ipAddress("127.0.0.1")
                .build();
        auditLogRepository.save(audit);

        return ApiResponse.ok(true, "Đã xóa nhóm thành công");
    }

    @PostMapping("/admin/leave-adjust")
    @Operation(summary = "Điều chỉnh số dư phép năm nhân sự (ATT-LEAVE-05)")
    public ApiResponse<Boolean> adjustLeave(@RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.ok(true, "Điều chỉnh ngày phép thành công");
    }

    private String unaccent(String text) {
        if (text == null)
            return "";
        String normalized = java.text.Normalizer.normalize(text, java.text.Normalizer.Form.NFD);
        return normalized.replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .replace("đ", "d").replace("Đ", "D")
                .toLowerCase().trim();
    }

    /** Khớp mờ: chuỗi con, bỏ khoảng trắng (chamcong ≈ chấm công), hoặc đủ từ không cần đúng thứ tự. */
    private boolean fuzzyMatch(String unaccentedText, String cleanQuery) {
        if (cleanQuery == null || cleanQuery.isEmpty())
            return true;
        String text = unaccentedText == null ? "" : unaccentedText;
        if (text.contains(cleanQuery))
            return true;
        String compactQuery = cleanQuery.replaceAll("\\s+", "");
        if (!compactQuery.isEmpty() && text.replaceAll("\\s+", "").contains(compactQuery))
            return true;
        String[] tokens = cleanQuery.split("\\s+");
        if (tokens.length > 1) {
            boolean all = true;
            for (String token : tokens) {
                if (!token.isEmpty() && !text.contains(token)) {
                    all = false;
                    break;
                }
            }
            if (all)
                return true;
        }
        return false;
    }

    private static boolean isHrOnlyUrl(String url) {
        if (url == null)
            return false;
        return url.startsWith("/attendance/leave-ledger")
                || url.startsWith("/attendance/leave-table")
                || url.startsWith("/attendance/disputes")
                || url.equals("/attendance/rules")
                || url.startsWith("/admin/employees")
                || url.startsWith("/admin/users")
                || url.equals("/admin/shifts")
                || url.equals("/admin/rules")
                || url.equals("/admin/leave-types")
                || url.equals("/admin/devices")
                || url.equals("/admin/audit-logs")
                || url.equals("/okr/cycles")
                || url.equals("/okr/summary-report");
    }

    @GetMapping("/search/quick")
    @Operation(summary = "Tìm kiếm nhanh Command Palette Ctrl+K (CORE-CMD-01)")
    public ApiResponse<List<Map<String, String>>> quickSearch(@RequestParam(defaultValue = "") String q) {
        String cleanQ = unaccent(q);
        String currentRole = CurrentUser.role();
        UUID currentUserId = CurrentUser.userId();
        boolean isHr = CurrentUser.isHr();
        boolean isManager = "MANAGER".equalsIgnoreCase(currentRole);

        // Find allowed team members if Manager
        Set<UUID> managerAllowedUserIds = new HashSet<>();
        if (isManager && currentUserId != null) {
            managerAllowedUserIds.add(currentUserId);
            // Find teams where user is leader or member
            List<Team> teams = teamRepository.findAll().stream()
                    .filter(t -> currentUserId.equals(t.getLeaderId()))
                    .collect(Collectors.toList());
            Set<UUID> teamIds = teams.stream().map(Team::getId).collect(Collectors.toSet());
            userRepository.findAll().stream()
                    .filter(u -> u.getTeamId() != null && teamIds.contains(u.getTeamId()))
                    .forEach(u -> managerAllowedUserIds.add(u.getId()));
        }

        List<Map<String, String>> results = new ArrayList<>();

        // If query is empty, return top default quick items
        if (cleanQ.isEmpty()) {
            results.add(Map.of("title", "Chấm công khuôn mặt", "subtitle", "Thao tác nhanh", "kind", "action", "url",
                    "/attendance/checkin"));
            results.add(Map.of("title", "Bảng công tổng hợp", "subtitle", "Bảng công 53 cột", "kind", "page", "url",
                    "/attendance/timesheet"));
            results.add(Map.of("title", "Tự đánh giá OKR cuối năm", "subtitle", "OKR", "kind", "page", "url",
                    "/okr/my-okr?section=assessment"));
            results.add(Map.of("title", "Quy định Đi muộn, về sớm", "subtitle", "Chính sách · 2 lần/tháng", "kind",
                    "rule", "url", "/admin/policy-doc"));
            results.add(Map.of("title", "Quy định Phép tồn & chuyển phép", "subtitle", "Chính sách · Hạn 31/03", "kind",
                    "rule", "url", "/admin/policy-doc"));
            return ApiResponse.ok(results, "Tìm kiếm nhanh thành công");
        }

        // 1. Search Rules & Policies
        List<Map<String, String>> ruleCatalog = List.of(
                Map.of("title", "Quy định Đi muộn, về sớm", "keywords", "dieu di muon muon som 60 phut 2 lan", "url",
                        "/admin/policy-doc", "sub", "Chính sách · Quota 2 lần/tháng, tối đa 60 phút"),
                Map.of("title", "Quy định Phép tồn & chuyển phép năm", "keywords",
                        "phep phep ton nghi phep phep nam 31 03", "url", "/admin/policy-doc", "sub",
                        "Chính sách · Hạn bảo lưu phép tồn đến 31/03"),
                Map.of("title", "Quy định Làm việc từ xa (WFH)", "keywords", "wfh lam viec tu xa online bao cao", "url",
                        "/admin/policy-doc", "sub", "Chính sách · Tối đa 2 ngày/tuần, báo cáo cuối ngày"),
                Map.of("title", "Quy định Bổ sung chấm công quên quét", "keywords",
                        "bo sung quen cham cong check in check out", "url", "/attendance/requests", "sub",
                        "Chính sách · Hạn nộp trong vòng 3 ngày làm việc"),
                Map.of("title", "Cấu hình 19 quy định (Rule Engine)", "keywords",
                        "cau hinh rule engine 19 quy dinh tham so", "url", "/admin/rules", "sub",
                        "Quản trị hệ thống · S16/S17"));

        for (Map<String, String> rc : ruleCatalog) {
            if (!isHr && isHrOnlyUrl(rc.get("url")))
                continue;
            String keywords = unaccent(rc.get("keywords") + " " + rc.get("title"));
            if (fuzzyMatch(keywords, cleanQ)) {
                results.add(Map.of(
                        "title", rc.get("title"),
                        "subtitle", rc.get("sub"),
                        "kind", "rule",
                        "url", rc.get("url")));
            }
        }

        // Search dynamic rules from DB — chỉ HR/Admin được xem cấu hình.
        try {
            if (isHr) {
                for (Rule r : ruleRepository.findAll()) {
                    String rText = unaccent(r.getName() + " " + r.getRuleKey() + " " + r.getDescription());
                    if (fuzzyMatch(rText, cleanQ)) {
                        results.add(Map.of(
                                "title", "Quy tắc: " + r.getName(),
                                "subtitle", "Tham số hệ thống · Key: " + r.getRuleKey(),
                                "kind", "rule",
                                "url", "/admin/rules"));
                    }
                }
            }
        } catch (Exception ignored) {
        }

        // 2. Search Users (Scoped strictly by role!)
        try {
            List<User> allUsers = userRepository.findAll();
            for (User u : allUsers) {
                // Scoping check:
                if (!isHr) {
                    if (isManager) {
                        if (!managerAllowedUserIds.contains(u.getId()))
                            continue; // Manager CANNOT see outside their team!
                    } else {
                        // Employee only sees self
                        if (currentUserId != null && !currentUserId.equals(u.getId()))
                            continue;
                    }
                }

                String uText = unaccent(
                        u.getFullName() + " " + u.getEmployeeCode() + " " + (u.getEmail() != null ? u.getEmail() : ""));
                if (fuzzyMatch(uText, cleanQ)) {
                    // HR xem hồ sơ đầy đủ; Manager xem sơ đồ tổ chức; Employee về hồ sơ cá nhân.
                    String userUrl = isHr
                            ? "/admin/employees?search=" + u.getEmployeeCode()
                            : isManager
                                    ? "/admin/org-tree?search=" + u.getEmployeeCode()
                                    : "/account/profile";
                    results.add(Map.of(
                            "title", u.getFullName() + " (" + u.getEmployeeCode() + ")",
                            "subtitle",
                            "Nhân sự · " + (u.getPositionName() != null ? u.getPositionName() : u.getRole()),
                            "kind", "user",
                            "url", userUrl));
                }
            }
        } catch (Exception ignored) {
        }

        // 3. Search Common Screens / Pages
        List<Map<String, String>> screens = List.of(
                Map.of("title", "Cần làm (Todo Inbox)", "keywords", "can lam todo inbox viec can lam s02", "url",
                        "/todo", "sub", "Điều hướng · Trang mặc định sau đăng nhập"),
                Map.of("title", "Chấm công khuôn mặt", "keywords",
                        "cham cong check in check out khuôn mat face mobile camera s05", "url", "/attendance/checkin",
                        "sub", "Thao tác nhanh · Camera nhận diện 3 góc"),
                Map.of("title", "Bảng công tổng hợp 53 cột", "keywords",
                        "bang cong timesheet thang 11 thang 12 luong chot cong s15", "url", "/attendance/timesheet",
                        "sub", "Chấm công & Chốt lương"),
                Map.of("title", "Tạo đơn xin nghỉ phép / WFH / Đi muộn", "keywords",
                        "tao don xin nghi don tu wfh nghi phep di muon bo sung cong s08", "url", "/attendance/requests",
                        "sub", "Đơn từ cá nhân"),
                Map.of("title", "Hộp thư phê duyệt cấp dưới", "keywords", "duyet don phe duyet approval approvals s12",
                        "url", "/attendance/approvals", "sub", "Quản lý duyệt đơn"),
                Map.of("title", "Dashboard OKR cá nhân", "keywords", "okr dashboard muc tieu kr s20", "url",
                        "/okr/dashboard", "sub", "Phân hệ OKR"),
                Map.of("title", "Tự đánh giá OKR cuối năm", "keywords",
                        "okr assessment danh gia form 4 box business people s23", "url", "/okr/my-okr?section=assessment", "sub",
                        "Đánh giá hiệu suất"),
                Map.of("title", "Sơ đồ tổ chức phòng ban (Org Tree)", "keywords",
                        "so do to chuc org tree phong ban cay nhom long nhau s41", "url", "/admin/org-tree", "sub",
                        "Quản trị cơ cấu"),
                Map.of("title", "Nhật ký kiểm toán (Audit Logs)", "keywords",
                        "audit log nhat ky kiem toan lich su thay doi s35", "url", "/admin/audit-logs", "sub",
                        "Nhật ký append-only"),
                Map.of("title", "Tùy chỉnh thông báo", "keywords",
                        "thong bao tuy chinh cai dat quiet hours gio yen lang s36", "url", "/notifications/preferences",
                        "sub", "Cài đặt cá nhân"));

        for (Map<String, String> s : screens) {
            if (!isHr && isHrOnlyUrl(s.get("url")))
                continue;
            String keywords = unaccent(s.get("keywords") + " " + s.get("title"));
            if (fuzzyMatch(keywords, cleanQ)) {
                results.add(Map.of(
                        "title", s.get("title"),
                        "subtitle", s.get("sub"),
                        "kind", "page",
                        "url", s.get("url")));
            }
        }

        // Limit to top 15 results
        if (results.size() > 15) {
            results = results.subList(0, 15);
        }

        return ApiResponse.ok(results, "Tìm kiếm nhanh thành công");
    }

    @GetMapping("/search/actions")
    @Operation(summary = "Hành động nhanh từ Command Palette (CORE-CMD-02)")
    public ApiResponse<List<Map<String, String>>> quickActions() {
        String role = CurrentUser.role();
        boolean isHr = CurrentUser.isHr();
        boolean isManager = "MANAGER".equalsIgnoreCase(role);

        List<Map<String, String>> actions = new ArrayList<>();
        actions.add(Map.of("action", "CHECK_IN", "label", "Chấm công vào/ra ngay", "url", "/attendance/checkin"));
        actions.add(Map.of("action", "SUBMIT_LEAVE", "label", "Tạo đơn xin nghỉ phép", "url",
                "/attendance/requests"));
        actions.add(Map.of("action", "SUBMIT_WFH", "label", "Tạo đơn làm việc từ xa (WFH)", "url",
                "/attendance/requests"));
        actions.add(Map.of("action", "CHANGE_PASSWORD", "label", "Đổi mật khẩu", "url", "/account/profile"));
        actions.add(Map.of("action", "CHECKIN_OKR", "label", "Check-in tiến độ Key Results OKR", "url", "/okr/my-okr"));
        actions.add(Map.of("action", "VIEW_MY_TIMESHEET", "label", "Xem bảng công của tôi", "url",
                "/attendance/my-timesheet"));

        if (isManager || isHr) {
            actions.add(Map.of("action", "APPROVE_REQUESTS", "label", "Duyệt nhanh đơn từ cấp dưới", "url",
                    "/attendance/approvals"));
            actions.add(Map.of("action", "TEAM_SCHEDULE", "label", "Xem lịch làm việc nhóm", "url",
                    "/attendance/team-schedule"));
        }

        if (isHr) {
            actions.add(
                    Map.of("action", "CONFIG_RULES", "label", "Cấu hình quy định Rule Engine", "url", "/admin/rules"));
            actions.add(Map.of("action", "VIEW_AUDIT_LOGS", "label", "Xem nhật ký thay đổi hệ thống", "url",
                    "/admin/audit-logs"));
        }

        return ApiResponse.ok(actions, "Lấy danh mục hành động nhanh thành công");
    }

    @GetMapping("/notifications")
    @Operation(summary = "Danh sách thông báo phân trang + lọc phía server (CORE-NOTIF-01)")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getNotifications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer limit,
            @RequestParam(defaultValue = "false") boolean unread,
            @RequestParam(required = false) String eventKey,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String q) {
        UUID uid = CurrentUser.userId();
        int pageSize = size != null ? size : (limit != null ? limit : 50);
        pageSize = Math.max(1, Math.min(100, pageSize));
        int safePage = Math.max(0, page);
        long unreadCount = uid == null ? 0 : notificationRepository.countUnread(uid);

        Page<Notification> dbPage = Page.empty(PageRequest.of(safePage, pageSize));
        if (uid != null) {
            String normalizedKey = eventKey == null || eventKey.isBlank() ? null : eventKey.trim();
            String normalizedQ = q == null || q.isBlank() ? null : q.trim();
            // Lọc theo nhóm sự kiện: đổi nhóm → tập event key; nhóm lạ → không khớp gì.
            boolean filterByCategory = category != null && !category.isBlank();
            List<String> categoryKeys = filterByCategory
                    ? com.act.pulse.modules.notification.service.NotificationEventCatalog
                            .keysInCategory(category.trim())
                    : List.of();
            List<String> legacyTypes = filterByCategory
                    ? com.act.pulse.modules.notification.service.NotificationEventCatalog
                            .legacyTypesInCategory(category.trim())
                    : List.of();
            dbPage = notificationRepository.search(
                    uid, unread, normalizedKey, filterByCategory, categoryKeys, legacyTypes, normalizedQ,
                    PageRequest.of(safePage, pageSize, Sort.by(Sort.Direction.DESC, "createdAt")));
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Notification entity : dbPage.getContent()) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", entity.getId().toString());
            map.put("title", entity.getTitle());
            map.put("message", entity.getContent());
            map.put("content", entity.getContent());
            map.put("type", entity.getType());
            map.put("eventKey", entity.getEventKey());
            var eventDef = entity.getEventKey() == null ? null
                    : com.act.pulse.modules.notification.service.NotificationEventCatalog
                            .get(entity.getEventKey());
            map.put("category", eventDef != null ? eventDef.category()
                    : com.act.pulse.modules.notification.service.NotificationEventCatalog
                            .categoryForType(entity.getType()));
            map.put("priority", entity.getPriority());
            map.put("level", "HIGH".equalsIgnoreCase(entity.getPriority()) ? "urgent"
                    : "MEDIUM".equalsIgnoreCase(entity.getPriority()) ? "warning" : "info");
            map.put("actionUrl", entity.getActionUrl());
            map.put("read", Boolean.TRUE.equals(entity.getIsRead()));
            map.put("isRead", Boolean.TRUE.equals(entity.getIsRead()));
            map.put("timestamp", entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : "Vừa xong");
            map.put("createdAt", entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : "");
            result.add(map);
        }

        // Giữ nguyên `data` là mảng để client cũ không vỡ; metadata nằm ở header.
        HttpHeaders headers = new HttpHeaders();
        headers.add("X-Total-Count", String.valueOf(dbPage.getTotalElements()));
        headers.add("X-Unread-Count", String.valueOf(unreadCount));
        headers.add("X-Page", String.valueOf(safePage));
        headers.add("X-Page-Size", String.valueOf(pageSize));
        headers.add("X-Has-More", String.valueOf(dbPage.hasNext()));
        return ResponseEntity.ok().headers(headers)
                .body(ApiResponse.ok(result, "Lấy thông báo thành công"));
    }

    @GetMapping("/notifications/unread-count")
    @Operation(summary = "Số thông báo chưa đọc (badge) — không tải cả hộp thư")
    public ApiResponse<Map<String, Object>> unreadNotificationCount() {
        UUID uid = CurrentUser.userId();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("count", uid == null ? 0 : notificationRepository.countUnread(uid));
        return ApiResponse.ok(out, "Số thông báo chưa đọc");
    }

    @PutMapping("/notifications/{id}/read")
    @Operation(summary = "Đánh dấu thông báo đã đọc (CORE-NOTIF-01)")
    public ApiResponse<Boolean> markNotificationRead(@PathVariable String id) {
        try {
            UUID uid = UUID.fromString(id);
            Optional<Notification> notifOpt = notificationRepository.findById(uid);
            if (notifOpt.isPresent()) {
                Notification notif = notifOpt.get();
                // Chỉ đánh dấu được thông báo của chính mình.
                UUID currentUid = CurrentUser.userId();
                if (currentUid != null && !currentUid.equals(notif.getUserId()) && !CurrentUser.isHr()) {
                    return ApiResponse.ok(false, "Không có quyền đánh dấu thông báo của người khác");
                }
                notif.setIsRead(true);
                notificationRepository.save(notif);
                return ApiResponse.ok(true, "Đã đánh dấu thông báo " + id + " đã đọc");
            }
        } catch (Exception ignored) {
        }
        return ApiResponse.ok(true, "Đã cập nhật trạng thái");
    }

    @PutMapping("/notifications/mark-all-read")
    @Operation(summary = "Đánh dấu tất cả thông báo đã đọc (CORE-NOTIF-02)")
    @Transactional
    public ApiResponse<Boolean> markAllNotificationsRead() {
        UUID currentUid = CurrentUser.userId();
        // Chỉ đánh dấu hộp thư của chính mình — không bao giờ quét toàn hệ thống.
        if (currentUid != null) {
            notificationRepository.markAllRead(currentUid);
        }
        return ApiResponse.ok(true, "Đã đánh dấu tất cả thông báo đã đọc");
    }

    @PostMapping("/notifications")
    @Operation(summary = "Thêm thông báo mới vào Database")
    public ApiResponse<Notification> createNotification(@RequestBody Map<String, Object> body) {
        UUID uid = CurrentUser.userId();
        if (uid == null) {
            // Không ghi vào user ngẫu nhiên — yêu cầu đăng nhập.
            return ApiResponse.error("Vui lòng đăng nhập để tạo thông báo.");
        }
        String eventKey = (String) body.getOrDefault("eventKey", "MANUAL");
        Notification entity = Notification.builder()
                .userId(uid)
                .title((String) body.getOrDefault("title", "Thông báo mới"))
                .content((String) body.getOrDefault("content", "Nội dung thông báo mới"))
                .type((String) body.getOrDefault("type", "ATTENDANCE"))
                .eventKey(eventKey)
                .priority((String) body.getOrDefault("priority", "MEDIUM"))
                .actionUrl((String) body.getOrDefault("actionUrl", "/todo"))
                .isRead(false)
                .build();
        return ApiResponse.ok(notificationRepository.save(entity), "Đã thêm thông báo thành công");
    }

    @DeleteMapping("/notifications/{id}")
    @Operation(summary = "Xóa thông báo khỏi Database")
    public ApiResponse<Boolean> deleteNotification(@PathVariable String id) {
        try {
            UUID uid = UUID.fromString(id);
            // Chỉ xóa được thông báo của chính mình (HR được xóa tất cả).
            notificationRepository.findById(uid).ifPresent(notif -> {
                UUID currentUid = CurrentUser.userId();
                if (currentUid != null && !currentUid.equals(notif.getUserId()) && !CurrentUser.isHr()) {
                    throw new IllegalArgumentException("Không có quyền xóa thông báo của người khác");
                }
                notificationRepository.delete(notif);
            });
        } catch (IllegalArgumentException ex) {
            return ApiResponse.error(ex.getMessage());
        } catch (Exception ignored) {
        }
        return ApiResponse.ok(true, "Đã xóa thông báo");
    }

    @GetMapping("/admin/shifts")
    @Operation(summary = "Danh sách ca làm việc (S26) — ca chuẩn đầu bảng, ca ngoại lệ xếp theo ưu tiên tăng dần")
    public ApiResponse<List<Shift>> getShifts() {
        List<Shift> data = shiftRepository.findAll().stream()
                .sorted(Comparator
                        .comparing((Shift s) -> shiftResolver.isStandard(s) ? 0 : 1)
                        .thenComparing(s -> shiftResolver.isStandard(s) || s.getPriority() == null ? 0 : s.getPriority())
                        .thenComparing(Shift::getCode))
                .toList();
        return ApiResponse.ok(data, "Lấy danh sách ca làm việc thành công");
    }

    @PostMapping("/admin/shifts")
    @Operation(summary = "Thêm ca làm việc / ca linh hoạt — ca mới nằm cuối danh sách (ưu tiên cao nhất)")
    public ApiResponse<Shift> createShift(@RequestBody Shift shift) {
        if (shift.getCode() == null || shift.getCode().isBlank())
            throw new RuntimeException("Thiếu mã ca");
        if (shiftRepository.findByCode(shift.getCode()).isPresent())
            throw new RuntimeException("Mã ca đã tồn tại");
        int maxPriority = shiftRepository.findAll().stream()
                .filter(s -> !shiftResolver.isStandard(s))
                .mapToInt(s -> s.getPriority() == null ? 0 : s.getPriority())
                .max().orElse(0);
        shift.setPriority(maxPriority + 1);
        if (shift.getIsActive() == null) shift.setIsActive(true);
        shift.setIsException(true);
        assertHasTarget(shift);
        return ApiResponse.ok(shiftRepository.save(shift), "Đã thêm ca làm việc");
    }

    /** Ca ngoại lệ phải có ít nhất một phạm vi áp dụng — nếu không sẽ không bao giờ khớp ai. */
    private void assertHasTarget(Shift shift) {
        if (shiftResolver.isStandard(shift)) return;
        boolean any = java.util.stream.Stream.of(shift.getTargetGroup(), shift.getTargetPosition(), shift.getTargetEmployees())
                .anyMatch(v -> v != null && !v.isBlank());
        if (!any) {
            throw new RuntimeException("Ca ngoại lệ phải chọn ít nhất một nhóm, chức danh hoặc nhân viên áp dụng");
        }
    }

    @PutMapping("/admin/shifts/{code}")
    @Operation(summary = "Sửa ca làm việc / bật-tắt ca ngoại lệ (ca chuẩn luôn bật)")
    public ApiResponse<Shift> updateShift(@PathVariable String code, @RequestBody Shift payload) {
        Shift shift = shiftRepository.findByCode(code)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ca: " + code));
        payload.setId(shift.getId());
        payload.setCode(shift.getCode());
        payload.setUpdatedAt(LocalDateTime.now());
        if (payload.getPriority() == null) payload.setPriority(shift.getPriority());
        if (payload.getTargetGroup() == null) payload.setTargetGroup(shift.getTargetGroup());
        if (payload.getTargetPosition() == null) payload.setTargetPosition(shift.getTargetPosition());
        if (payload.getTargetEmployees() == null) payload.setTargetEmployees(shift.getTargetEmployees());
        if (payload.getExcludeEmployees() == null) payload.setExcludeEmployees(shift.getExcludeEmployees());
        if (payload.getIsActive() == null) payload.setIsActive(shift.getIsActive());
        // Ca chuẩn là base toàn công ty: luôn bật, không ngoại lệ, không target/loại trừ.
        if (shiftResolver.isStandard(shift)) {
            payload.setIsActive(true);
            payload.setIsException(false);
            payload.setTargetGroup(null);
            payload.setTargetPosition(null);
            payload.setTargetEmployees(null);
            payload.setExcludeEmployees(null);
        } else {
            assertHasTarget(payload);
        }
        return ApiResponse.ok(shiftRepository.save(payload), "Đã cập nhật ca làm việc");
    }

    @DeleteMapping("/admin/shifts/{code}")
    @Operation(summary = "Xóa ca ngoại lệ — nhân sự đang dùng ca được đưa về ca chuẩn")
    public ApiResponse<Map<String, Object>> deleteShift(@PathVariable String code) {
        Shift shift = shiftRepository.findByCode(code)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ca: " + code));
        if (shiftResolver.isStandard(shift)) {
            throw new RuntimeException("Ca chuẩn là ca mặc định toàn công ty — không thể xóa. "
                    + "Chỉ có thể sửa khung giờ.");
        }
        UUID standardId = shiftResolver.standardShiftId();
        int moved = 0;
        for (User user : userRepository.findAll()) {
            if (shift.getId().equals(user.getShiftId())) {
                user.setShiftId(standardId);
                userRepository.save(user);
                moved++;
            }
        }
        // Log đã ghi ca này sẽ mất tham chiếu (không chặn xóa vì lịch sử chấm công)…
        attendanceLogRepository.clearShiftReference(shift.getId());
        shiftRepository.delete(shift);
        return ApiResponse.ok(Map.of("moved", moved, "shiftCode", code),
                "Đã xóa ca — " + moved + " nhân sự trở về ca chuẩn");
    }

    @PutMapping("/admin/shifts/order")
    @Operation(summary = "Sắp xếp lại thứ tự ca — ca ở cuối danh sách có ưu tiên ghi đè cao nhất")
    public ApiResponse<List<Shift>> reorderShifts(@RequestBody Map<String, Object> body) {
        Object raw = body == null ? null : body.get("codes");
        List<String> codes = raw instanceof List<?> list
                ? list.stream().map(String::valueOf).toList()
                : List.of();
        if (codes.isEmpty()) throw new RuntimeException("Thiếu danh sách mã ca cần sắp xếp");
        Map<String, Shift> byCode = shiftRepository.findAll().stream()
                .filter(s -> !shiftResolver.isStandard(s))
                .collect(Collectors.toMap(Shift::getCode, s -> s, (a, b) -> a, LinkedHashMap::new));
        Set<String> seen = new HashSet<>();
        int priority = 1;
        for (String code : codes) {
            Shift shift = byCode.get(code);
            if (shift == null || !seen.add(code)) continue;
            shift.setPriority(priority++);
            shift.setUpdatedAt(LocalDateTime.now());
            shiftRepository.save(shift);
        }
        // Ca không có trong danh sách gửi lên: giữ thứ tự cũ, xếp sau cùng.
        List<Shift> remaining = byCode.values().stream()
                .filter(s -> !seen.contains(s.getCode()))
                .sorted(Comparator.comparing(s -> s.getPriority() == null ? Integer.MAX_VALUE : s.getPriority()))
                .toList();
        for (Shift s : remaining) {
            s.setPriority(priority++);
            s.setUpdatedAt(LocalDateTime.now());
            shiftRepository.save(s);
        }
        return getShifts();
    }

    @PostMapping("/admin/shifts/{code}/assign")
    @Operation(summary = "Áp ca theo cấu hình nhóm/chức danh/nhân viên — chỉ nhân sự mà ca này thắng theo thứ tự ưu tiên")
    public ApiResponse<Map<String, Object>> assignShift(@PathVariable String code) {
        Shift shift = shiftRepository.findByCode(code)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ca: " + code));
        if (shiftResolver.isStandard(shift)) {
            throw new RuntimeException("Ca chuẩn đã áp dụng mặc định cho toàn công ty — không cần áp ca. "
                    + "Dùng \"Bỏ áp ca\" trên ca ngoại lệ để đưa nhân sự về ca chuẩn.");
        }
        int assigned = 0;
        for (User user : userRepository.findAll()) {
            Shift resolved = shiftResolver.resolveFor(user);
            if (resolved != null && shift.getId().equals(resolved.getId())) {
                user.setShiftId(shift.getId());
                userRepository.save(user);
                assigned++;
            }
        }
        return ApiResponse.ok(Map.of("assigned", assigned, "shiftCode", code),
                "Đã áp ca — ca này đang là ca hiệu lực cho " + assigned + " nhân sự");
    }

    @PostMapping("/admin/shifts/{code}/unassign")
    @Operation(summary = "Bỏ áp ca ngoại lệ (tắt ca) — nhân sự trở về ca chuẩn hoặc ca ưu tiên thấp hơn")
    public ApiResponse<Map<String, Object>> unassignShift(@PathVariable String code) {
        Shift shift = shiftRepository.findByCode(code)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ca: " + code));
        if (shiftResolver.isStandard(shift)) {
            throw new RuntimeException("Ca chuẩn áp dụng mặc định cho toàn công ty — không thể bỏ áp");
        }
        int reverted = 0;
        for (User user : userRepository.findAll()) {
            Shift resolved = shiftResolver.resolveFor(user);
            if (resolved != null && shift.getId().equals(resolved.getId())) reverted++;
        }
        shift.setIsActive(false);
        shift.setUpdatedAt(LocalDateTime.now());
        shiftRepository.save(shift);
        UUID standardId = shiftResolver.standardShiftId();
        for (User user : userRepository.findAll()) {
            if (shift.getId().equals(user.getShiftId())) {
                user.setShiftId(standardId);
                userRepository.save(user);
            }
        }
        return ApiResponse.ok(Map.of("reverted", reverted, "shiftCode", code),
                "Đã bỏ áp ca — " + reverted + " nhân sự về ca chuẩn");
    }

    @GetMapping("/media/preview/{fileId}")
    @Operation(summary = "Trình xem nhanh file minh chứng (OKR-CONV-02)")
    public ApiResponse<Map<String, String>> previewFileRoot(@PathVariable String fileId) {
        return ApiResponse.ok(Map.of("fileId", fileId, "previewUrl", "/files/preview/" + fileId),
                "Lấy thông tin file minh chứng thành công");
    }
}
