#!/usr/bin/env bash
# ==============================================================================
# ACT-HKT 2026 — SCRIPT KHỞI CHẠY HỆ THỐNG CỤC BỘ (LOCAL DEV LAUNCHER)
# Worklife & Performance Management System
# ==============================================================================

set -e

# ANSI Color Codes
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$ROOT_DIR/hkt/deploy/docker/docker-compose.yml"
FRONTEND_DIR="$ROOT_DIR/hkt/frontend"

print_banner() {
  echo -e "${CYAN}${BOLD}"
  echo "  █████╗  ██████╗████████╗     ██╗  ██╗██╗  ██╗████████╗    ██████╗  ██████╗ ██████╗  ██████╗ "
  echo " ██╔══██╗██╔════╝╚══██╔══╝     ██║  ██║██║ ██╔╝╚══██╔══╝    ╚════██╗██╔═████╗╚════██╗██╔════╝ "
  echo " ███████║██║        ██║  █████╗███████║█████╔╝    ██║        █████╔╝██║██╔██║ █████╔╝███████╗ "
  echo " ██╔══██║██║        ██║  ╚════╝██╔══██║██╔═██╗    ██║       ██╔═══╝ ████╔╝██║██╔═══╝ ██╔═══██╗"
  echo " ██║  ██║╚██████╗   ██║        ██║  ██║██║  ██╗   ██║       ███████╗╚██████╔╝███████╗╚██████╔╝"
  echo " ╚═╝  ╚═╝ ╚═════╝   ╚═╝        ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝       ╚══════╝ ╚═════╝ ╚══════╝ ╚═════╝ "
  echo -e "${NC}"
  echo -e "${GREEN}★ HỆ THỐNG QUẢN TRỊ CHUYÊN CẦN, CHẤM CÔNG 5 TẦNG & ĐÁNH GIÁ HIỆU SUẤT OKR ★${NC}"
  echo -e "${PURPLE}Phiên bản: 2026 Enterprise Edition · Sẵn sàng khởi chạy môi trường Local${NC}"
  echo "----------------------------------------------------------------------------------------"
}

check_prerequisites() {
  echo -e "\n${BLUE}▶ 1. Kiểm tra môi trường hệ thống...${NC}"

  # 1.1 Check Docker
  if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Lỗi: Chưa cài đặt Docker trên máy. Vui lòng cài Docker Desktop: https://www.docker.com/${NC}"
    exit 1
  fi

  if ! docker info &> /dev/null; then
    echo -e "${RED}✗ Lỗi: Docker Daemon chưa chạy. Hãy mở Docker Desktop và thử lại.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Docker Daemon: Đang hoạt động.${NC}"

  # 1.2 Check Node & npm
  if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ Lỗi: Chưa tìm thấy Node.js / npm. Vui lòng cài Node.js v18 trở lên.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Node.js $(node -v) & npm $(npm -v): Sẵn sàng.${NC}"
}

prepare_frontend() {
  echo -e "\n${BLUE}▶ 2. Chuẩn bị thư viện Frontend UI...${NC}"
  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo -e "${YELLOW}Thư mục node_modules chưa tồn tại. Đang chạy 'npm install' trong hkt/frontend...${NC}"
    (cd "$FRONTEND_DIR" && npm install)
  else
    echo -e "${GREEN}✓ Thư viện Frontend (node_modules): Đã cài đặt đầy đủ.${NC}"
  fi
}

start_docker_infra() {
  echo -e "\n${BLUE}▶ 3. Khởi chạy cụm hạ tầng Docker Containers...${NC}"
  echo -e "${CYAN}→ Khởi động PostgreSQL 16 (pgvector), Redis 7, Keycloak 24 IAM...${NC}"

  # Step 3.1: Start DB, Cache, IAM
  docker compose -f "$COMPOSE_FILE" up -d postgres redis keycloak

  echo -e "\n${BLUE}▶ 4. Chờ cơ sở dữ liệu sẵn sàng (Healthcheck)...${NC}"
  for i in {1..30}; do
    if docker exec pulse-postgres pg_isready -U postgres -d pulse_db &> /dev/null; then
      echo -e "${GREEN}✓ PostgreSQL Database (pulse_db:5432): Sẵn sàng kết nối.${NC}"
      break
    fi
    echo -ne "."
    sleep 1
  done

  # Step 3.2: Start AI Face Recognition Service first
  echo -e "\n${BLUE}▶ 5. Khởi chạy AI Face Recognition Service (Port 8000)...${NC}"
  docker compose -f "$COMPOSE_FILE" up -d ai-face-service

  echo -e "${CYAN}→ Chờ AI Face Service sẵn sàng...${NC}"
  for i in {1..30}; do
    if curl -s http://localhost:8000/health &> /dev/null || curl -s http://localhost:8000/docs &> /dev/null; then
      echo -e "${GREEN}✓ AI Face Biometric Service (OpenCV YuNet + SFace 128D:8000): Sẵn sàng xử lý.${NC}"
      break
    fi
    echo -ne "."
    sleep 1
  done

  # Step 3.3: Start Core Service (Backend), connecting to AI Face Service via AI_FACE_SERVICE_URL
  echo -e "\n${BLUE}▶ 6. Khởi chạy Backend Core Service API (Port 8080)...${NC}"
  docker compose -f "$COMPOSE_FILE" up -d core-service

  echo -e "${CYAN}→ Chờ Backend Core Service khởi động và kết nối với AI Face Service...${NC}"
  for i in {1..40}; do
    if curl -s http://localhost:8080/api/v1/swagger-ui.html &> /dev/null || curl -s http://localhost:8080/v3/api-docs &> /dev/null; then
      echo -e "${GREEN}✓ Backend Core Service (Spring Boot 3:8080): Sẵn sàng kết nối.${NC}"
      break
    fi
    echo -ne "."
    sleep 1
  done
}

print_dashboard() {
  echo -e "\n========================================================================================"
  echo -e "${GREEN}${BOLD}🎉 TOÀN BỘ HỆ THỐNG ACT-HKT 2026 ĐÃ KHỞI CHẠY THÀNH CÔNG TRÊN LOCAL!${NC}"
  echo -e "========================================================================================"
  echo -e "  🌐 ${BOLD}Giao Diện Web & Mobile PWA (Frontend):${NC}  ${CYAN}http://localhost:3000${NC}"
  echo -e "  ☕ ${BOLD}Backend Core Service API (Spring Boot):${NC}  ${CYAN}http://localhost:8080/api/v1${NC}"
  echo -e "  📚 ${BOLD}Tài Liệu Swagger API Console:${NC}            ${CYAN}http://localhost:8080/swagger-ui.html${NC}"
  echo -e "  🤖 ${BOLD}AI Face Biometric Service (FastAPI):${NC}    ${CYAN}http://localhost:8000/docs${NC}"
  echo -e "  🔐 ${BOLD}Keycloak Identity Server (IAM):${NC}         ${CYAN}http://localhost:8180${NC} (admin / admin)"
  echo -e "  🐘 ${BOLD}PostgreSQL Database (pgvector):${NC}         ${CYAN}localhost:5432${NC} (pulse_db / postgres123)"
  echo -e "  ⚡ ${BOLD}Redis Cache Server:${NC}                     ${CYAN}localhost:16379${NC}"
  echo -e "----------------------------------------------------------------------------------------"
  echo -e "${BOLD}🔑 DANH SÁCH TÀI KHOẢN ĐĂNG NHẬP KIỂM THỬ (TEST ACCOUNTS):${NC}"
  echo -e "  👑 ${BOLD}Admin Hệ Thống:${NC}    Username: ${YELLOW}Admin${NC}      | Password: ${YELLOW}Admin${NC} (Toàn quyền quản trị)"
  echo -e "  👩‍💼 ${BOLD}HR Lead:${NC}           Username: ${YELLOW}01HR${NC}       | Password: ${YELLOW}123456${NC} (Quản trị nhân sự & phép)"
  echo -e "  👔 ${BOLD}Team Lead Manager:${NC} Username: ${YELLOW}05ACT${NC}      | Password: ${YELLOW}123456${NC} (Phê duyệt đơn & OKR)"
  echo -e "  👨‍💻 ${BOLD}Developer / Dev:${NC}   Username: ${YELLOW}136ACT${NC}     | Password: ${YELLOW}123456${NC} (Chấm công & OKR cá nhân)"
  echo -e "  🌱 ${BOLD}Nhân Viên Mới:${NC}     Username: ${YELLOW}2026NEW${NC}    | Password: ${YELLOW}123456${NC} (Test Onboarding S01-A/B)"
  echo -e "========================================================================================"
  echo -e "${YELLOW}Nhấn Ctrl + C để dừng máy chủ Frontend UI khi muốn kết thúc phiên làm việc.${NC}\n"
}

cleanup() {
  echo -e "\n\n${YELLOW}Đang dừng máy chủ Frontend dev server...${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# Execute main workflow
print_banner
check_prerequisites
prepare_frontend
start_docker_infra
print_dashboard

# Start Frontend Vite Dev Server in foreground with auto hot-reload
echo -e "${BLUE}▶ Đang khởi chạy Frontend Vite Server (Cổng 3000)...${NC}"
cd "$FRONTEND_DIR" && npx vite --host 0.0.0.0 --port 3000
