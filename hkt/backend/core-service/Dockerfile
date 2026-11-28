# Build stage
FROM maven:3.9.8-eclipse-temurin-21-alpine AS builder
WORKDIR /app
COPY pom.xml .
# dependency:go-offline giải version range của Yubico theo SNAPSHOT mới nhất và
# bỏ qua exclusion/dependencyManagement -> chọn nhầm jackson-*-SNAPSHOT.
# dependency:resolve tải đủ dependency cho bước build mà không gặp lỗi đó.
RUN mvn -B dependency:resolve
COPY src ./src
RUN mvn -B clean package -DskipTests

# Run stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
