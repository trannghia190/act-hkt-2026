package com.act.pulse.modules.auth.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Converter between float[] embedding and PostgreSQL pgvector (vector(512)).
 * Prevents Hibernate from falling back to Java ObjectInputStream serialization.
 */
@Converter
public class PgVectorConverter implements AttributeConverter<float[], Object> {

    @Override
    public Object convertToDatabaseColumn(float[] attribute) {
        if (attribute == null) return null;
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < attribute.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(attribute[i]);
        }
        sb.append("]");
        try {
            Class<?> pgClass = Class.forName("org.postgresql.util.PGobject");
            Object obj = pgClass.getDeclaredConstructor().newInstance();
            pgClass.getMethod("setType", String.class).invoke(obj, "vector");
            pgClass.getMethod("setValue", String.class).invoke(obj, sb.toString());
            return obj;
        } catch (Exception e) {
            return sb.toString();
        }
    }

    @Override
    public float[] convertToEntityAttribute(Object dbData) {
        if (dbData == null) return null;
        String s = dbData.toString().trim();
        if (s.startsWith("[")) s = s.substring(1);
        if (s.endsWith("]")) s = s.substring(0, s.length() - 1);
        if (s.isBlank()) return new float[0];
        String[] parts = s.split(",");
        float[] arr = new float[parts.length];
        for (int i = 0; i < parts.length; i++) {
            arr[i] = Float.parseFloat(parts[i].trim());
        }
        return arr;
    }
}
