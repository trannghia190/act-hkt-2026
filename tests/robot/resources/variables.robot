*** Settings ***
Documentation    Global Test Variables and Configuration for ACT-HKT 2026

*** Variables ***
${CORE_BASE_URL}          http://localhost:8080/api/v1
${AI_BASE_URL}            http://localhost:8000
${FRONTEND_URL}           http://localhost:3000

# User Personas
${ADMIN_CODE}             Admin
${ADMIN_PASS}             Admin
${ADMIN_ROLE}             ADMIN

${HR_CODE}                01HR
${HR_PASS}                Act@2026
${HR_ROLE}                HR_ADMIN

${MGR_CODE}               05ACT
${MGR_PASS}               Act@2026
${MGR_ROLE}               MANAGER

${EMP_CODE}               136ACT
${EMP_PASS}               Act@2026
${EMP_ROLE}               EMPLOYEE

# Standard HTTP Headers
&{COMMON_HEADERS}         Content-Type=application/json
