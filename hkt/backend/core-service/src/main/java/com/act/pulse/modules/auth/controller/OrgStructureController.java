package com.act.pulse.modules.auth.controller;

import com.act.pulse.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Builder;
import lombok.Data;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/org")
@Tag(name = "1. Organization Structure API", description = "Quản lý cơ cấu phòng ban, nhóm và sơ đồ tổ chức")
public class OrgStructureController {

    @Data
    @Builder
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
    public static class DepartmentNode {
        private String id;
        private String code;
        private String name;
        private List<TeamNode> teams;
    }

    @GetMapping("/tree")
    @Operation(summary = "Lấy cây sơ đồ tổ chức công ty (Org Tree S41)")
    public ApiResponse<List<DepartmentNode>> getOrgTree() {
        List<DepartmentNode> departments = List.of(
            DepartmentNode.builder()
                .id("a0000000-0000-0000-0000-000000000001")
                .code("DEV")
                .name("Khối Kỹ Thuật & Phát Triển Phần Mềm")
                .teams(List.of(
                    TeamNode.builder()
                        .id("b0000000-0000-0000-0000-000000000001")
                        .name("Sirius")
                        .leaderName("Nguyễn Thanh Tùng")
                        .memberCount(8)
                        .isSpecialApproval(false)
                        .members(List.of("Nguyễn Thanh Tùng", "Trần Văn A", "Lê Văn B"))
                        .build(),
                    TeamNode.builder()
                        .id("b0000000-0000-0000-0000-000000000003")
                        .name("Optimus")
                        .leaderName("Vũ Văn Luận")
                        .memberCount(6)
                        .isSpecialApproval(false)
                        .members(List.of("Vũ Văn Luận", "Phạm Văn C"))
                        .build(),
                    TeamNode.builder()
                        .id("b0000000-0000-0000-0000-000000000006")
                        .name("CA (Special 2-step Approval)")
                        .leaderName("Anh Hiệp")
                        .memberCount(5)
                        .isSpecialApproval(true)
                        .members(List.of("Anh Hiệp", "Nguyễn Văn D"))
                        .build(),
                    TeamNode.builder()
                        .id("b0000000-0000-0000-0000-000000000007")
                        .name("Mobile (Special 2-step Approval)")
                        .leaderName("Tim")
                        .memberCount(7)
                        .isSpecialApproval(true)
                        .members(List.of("Tim", "Hoàng Văn E"))
                        .build()
                ))
                .build(),
            DepartmentNode.builder()
                .id("a0000000-0000-0000-0000-000000000003")
                .code("HR")
                .name("Phòng Nhân Sự & Chính Sách")
                .teams(List.of(
                    TeamNode.builder()
                        .id("b0000000-0000-0000-0000-000000000010")
                        .name("HR Operations")
                        .leaderName("Nguyễn Thị Thu Hà")
                        .memberCount(4)
                        .isSpecialApproval(false)
                        .members(List.of("Nguyễn Thị Thu Hà", "Đỗ Thị F"))
                        .build()
                ))
                .build()
        );

        return ApiResponse.ok(departments, "Lấy sơ đồ tổ chức thành công");
    }
}
