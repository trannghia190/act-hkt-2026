package com.act.pulse.modules.attendance.service;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Suy ra loại thiết bị + hệ điều hành + tên thân thiện từ User-Agent.
 * <p>Chỉ dùng để HIỂN THỊ cho HR — không dùng cho phân quyền hay hạn mức.</p>
 */
public final class DeviceUserAgentParser {

    public static final String DESKTOP = "DESKTOP";
    public static final String MOBILE = "MOBILE";
    public static final String TABLET = "TABLET";
    public static final String UNKNOWN = "UNKNOWN";

    public record DeviceInfo(String type, String osVersion, String model) {}

    private DeviceUserAgentParser() {}

    public static DeviceInfo parse(String rawUserAgent) {
        String ua = rawUserAgent == null ? "" : rawUserAgent.trim();
        String l = ua.toLowerCase(Locale.ROOT);
        if (l.isEmpty()) {
            return new DeviceInfo(UNKNOWN, "Web", "Web Device");
        }
        String os = detectOs(l);
        return new DeviceInfo(detectType(l), os, detectBrowser(l) + " trên " + os);
    }

    private static String detectType(String l) {
        // Thứ tự quan trọng: Windows Phone trước Windows, iPad trước Mac,
        // Android tablet trước Android phone, Kindle trước Android.
        if (l.contains("windows phone") || l.contains("iemobile")) return MOBILE;
        if (l.contains("kindle") || l.contains("silk/")) return TABLET;
        if (l.contains("ipad")) return TABLET;
        if (l.contains("iphone") || l.contains("ipod")) return MOBILE;
        if (l.contains("android")) return l.contains("mobile") ? MOBILE : TABLET;
        if (l.contains("tablet pc") || (l.contains("windows") && l.contains("touch"))) return TABLET;
        if (l.contains("blackberry") || l.contains("bb10") || l.contains("opera mini")
                || l.contains("opera mobi") || l.contains("webos")) return MOBILE;
        if (l.contains("windows") || l.contains("macintosh") || l.contains("mac os x")
                || l.contains("cros") || l.contains("linux")) return DESKTOP;
        if (l.contains("mobile")) return MOBILE;
        return UNKNOWN;
    }

    private static String detectOs(String l) {
        if (l.contains("windows phone")) return "Windows Phone";
        if (l.contains("windows nt 10")) return "Windows 10/11";
        if (l.contains("windows nt 6.3")) return "Windows 8.1";
        if (l.contains("windows nt 6.2")) return "Windows 8";
        if (l.contains("windows nt 6.1")) return "Windows 7";
        if (l.contains("windows")) return "Windows";

        Matcher iphone = Pattern.compile("iphone os ([\\d_]+)").matcher(l);
        if (iphone.find()) return "iOS " + iphone.group(1).replace('_', '.');
        if (l.contains("ipad")) {
            Matcher ipad = Pattern.compile("cpu os ([\\d_]+)").matcher(l);
            return ipad.find() ? "iPadOS " + ipad.group(1).replace('_', '.') : "iPadOS";
        }
        Matcher android = Pattern.compile("android ([\\d.]+)").matcher(l);
        if (android.find()) return "Android " + android.group(1);
        if (l.contains("cros")) return "ChromeOS";
        if (l.contains("mac os x") || l.contains("macintosh")) return "macOS";
        if (l.contains("linux")) return "Linux";
        return "Web";
    }

    private static String detectBrowser(String l) {
        if (l.contains("edg/") || l.contains("edga/") || l.contains("edgios/")) return "Edge";
        if (l.contains("opr/") || l.contains("opera")) return "Opera";
        if (l.contains("firefox/") || l.contains("fxios/")) return "Firefox";
        if (l.contains("crios/") || l.contains("chrome/") || l.contains("chromium")) return "Chrome";
        if (l.contains("safari/")) return "Safari";
        return "Trình duyệt";
    }

    /**
     * Loại hiệu lực để hiển thị: ưu tiên giá trị đã lưu, kế đến User-Agent,
     * cuối cùng mới đoán từ tên máy / OS (dữ liệu cũ chưa có hai cột kia).
     */
    public static String effectiveType(String storedType, String userAgent, String deviceModel, String osVersion) {
        if (storedType != null && !storedType.isBlank()) return storedType;
        if (userAgent != null && !userAgent.isBlank()) return parse(userAgent).type();

        String hay = ((deviceModel == null ? "" : deviceModel) + " "
                + (osVersion == null ? "" : osVersion)).toLowerCase(Locale.ROOT);
        if (hay.contains("ipad") || hay.contains("tablet") || hay.contains("máy tính bảng")
                || hay.contains("may tinh bang")) return TABLET;
        if (hay.contains("iphone") || hay.contains("android") || hay.contains("mobile")
                || hay.contains("phone") || hay.contains("điện thoại") || hay.contains("dien thoai")) return MOBILE;
        if (hay.contains("pc") || hay.contains("windows") || hay.contains("mac")
                || hay.contains("linux") || hay.contains("browser") || hay.contains("máy tính")
                || hay.contains("may tinh")) return DESKTOP;
        return UNKNOWN;
    }
}
