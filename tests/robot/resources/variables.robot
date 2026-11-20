*** Settings ***
Documentation    Global Test Variables and Configuration for ACT-HKT 2026

*** Variables ***
${CORE_BASE_URL}          http://localhost:8080/api/v1
${AI_BASE_URL}            http://localhost:8000
${FRONTEND_URL}           http://localhost:3000

# User Personas
${ADMIN_CODE}             Admin
${ADMIN_PASS}             123456
${ADMIN_ROLE}             ADMIN

${HR_CODE}                01HR
${HR_PASS}                123456
${HR_ROLE}                HR_ADMIN

${MGR_CODE}               05ACT
${MGR_PASS}               123456
${MGR_ROLE}               MANAGER

${EMP_CODE}               136ACT
${EMP_PASS}               123456
${EMP_ROLE}               EMPLOYEE

# Standard HTTP Headers
&{COMMON_HEADERS}         Content-Type=application/json
