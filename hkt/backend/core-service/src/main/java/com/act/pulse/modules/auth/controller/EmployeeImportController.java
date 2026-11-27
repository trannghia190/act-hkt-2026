package com.act.pulse.modules.auth.controller;

import com.act.pulse.common.response.ApiResponse;
import com.act.pulse.modules.auth.dto.EmployeeImportResultDto;
import com.act.pulse.modules.auth.service.EmployeeImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Slf4j
@RestController
@RequiredArgsConstructor
@Tag(name = "Employee Import", description = "API Import danh sách nhân viên từ file Excel chuẩn Ascend Tech")
public class EmployeeImportController {

    private final EmployeeImportService employeeImportService;

    @GetMapping(value = {"/admin/users/import-template", "/admin/employees/import-template"})
    @Operation(summary = "Tải file mẫu Excel (.xlsx) Import nhân sự kèm danh mục tham chiếu")
    public ResponseEntity<byte[]> downloadTemplate() throws IOException {
        byte[] excelBytes = employeeImportService.generateTemplate();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"AscendTech_Mau_Import_Nhan_Vien.xlsx\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(excelBytes);
    }

    @PostMapping(value = {"/admin/users/import-excel", "/admin/employees/import-excel"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Import danh sách nhân sự từ file Excel (.xlsx, .xls)")
    public ApiResponse<EmployeeImportResultDto> importExcel(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "sendActivationEmail", defaultValue = "false") boolean sendActivationEmail
    ) throws Exception {
        log.info("Bắt đầu xử lý import nhân viên từ Excel: {}, sendActivationEmail: {}", file.getOriginalFilename(), sendActivationEmail);
        EmployeeImportResultDto result = employeeImportService.importEmployees(file, sendActivationEmail);
        return ApiResponse.ok(result, "Xử lý import hoàn tất: " + result.getSuccessCount() + " thành công, " + result.getErrorCount() + " lỗi");
    }
}
