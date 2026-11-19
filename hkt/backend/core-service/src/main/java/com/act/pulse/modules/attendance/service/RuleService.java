package com.act.pulse.modules.attendance.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.act.pulse.modules.attendance.repository.RuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

/**
 * Đọc quy định từ catalog — **không hard-code** giá trị nghiệp vụ trong code
 * (nguyên tắc số 1 của business: mọi quy định phải cấu hình được).
 */
@Service
@RequiredArgsConstructor
public class RuleService {

    private final RuleRepository ruleRepository;
    private final ObjectMapper objectMapper;

    /** @return toàn bộ field của rule; rỗng nếu rule không tồn tại. */
    public Map<String, Object> get(String ruleKey) {
        return ruleRepository.findByRuleKey(ruleKey)
                .map(rule -> {
                    try {
                        return objectMapper.readValue(rule.getCurrentValue(), new TypeReference<>() {
                        });
                    } catch (Exception ex) {
                        return Map.<String, Object>of();
                    }
                })
                .orElseGet(Map::of);
    }

    public boolean getBoolean(String ruleKey, String field, boolean fallback) {
        Object value = get(ruleKey).get(field);
        return value instanceof Boolean b ? b : fallback;
    }

    public int getInt(String ruleKey, String field, int fallback) {
        Object value = get(ruleKey).get(field);
        if (value instanceof Number n) {
            return n.intValue();
        }
        if (value instanceof String s) {
            try {
                return Integer.parseInt(s.trim());
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    public double getDouble(String ruleKey, String field, double fallback) {
        Object value = get(ruleKey).get(field);
        if (value instanceof Number n) {
            return n.doubleValue();
        }
        if (value instanceof String s) {
            try {
                return Double.parseDouble(s.trim());
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    public String getString(String ruleKey, String field, String fallback) {
        Object value = get(ruleKey).get(field);
        return value == null ? fallback : String.valueOf(value);
    }

    public boolean exists(String ruleKey) {
        return ruleRepository.findByRuleKey(ruleKey).isPresent();
    }

    public Optional<String> rawValue(String ruleKey) {
        return ruleRepository.findByRuleKey(ruleKey).map(r -> r.getCurrentValue());
    }
}
