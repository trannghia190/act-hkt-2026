package com.act.pulse.modules.auth.service;

import com.act.pulse.modules.auth.dto.EmployeeImportResultDto;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

public interface EmployeeImportService {

    /**
     * Tạo file mẫu Excel (.xlsx) chuẩn Ascend Tech chứa các cột dữ liệu mẫu và danh mục tham chiếu.
     */
    byte[] generateTemplate() throws IOException;

    /**
     * Đọc và import dữ liệu nhân viên từ file Excel (.xlsx hoặc .xls).
     *
     * @param file File upload
     * @param sendActivationEmail Có tự động gửi email kích hoạt & mật khẩu tạm hay không
     * @return Kết quả import gồm số lượng thành công, danh sách tài khoản đã cấp và chi tiết lỗi
     */
    EmployeeImportResultDto importEmployees(MultipartFile file, boolean sendActivationEmail) throws Exception;
}
