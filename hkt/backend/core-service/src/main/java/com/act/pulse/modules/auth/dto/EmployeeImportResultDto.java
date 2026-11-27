package com.act.pulse.modules.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeImportResultDto {

    private int totalRows;
    private int successCount;
    private int errorCount;

    @Builder.Default
    private List<ImportedEmployeeSummary> successList = new ArrayList<>();

    @Builder.Default
    private List<ImportErrorDetail> errorList = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImportedEmployeeSummary {
        private String employeeCode;
        private String fullName;
        private String email;
        private String phone;
        private String teamName;
        private String positionName;
        private String role;
        private String managerCode;
        private String managerName;
        private String joinedDate;
        private String defaultPassword;
        private boolean emailSent;
        private String emailStatusMessage;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImportErrorDetail {
        private int rowNumber;
        private String employeeCode;
        private String fullName;
        private String email;
        private String errorMessage;
    }
}
