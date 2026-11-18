package com.act.pulse;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * ACT PULSE Core Service
 * "Nhịp đập Nhân sự & Hiệu suất ACT 2026"
 * Chấm Công, Đơn Từ & Quản Trị Mục Tiêu OKR
 */
@SpringBootApplication
@EnableScheduling
public class PulseApplication {

    public static void main(String[] args) {
        SpringApplication.run(PulseApplication.class, args);
    }
}
