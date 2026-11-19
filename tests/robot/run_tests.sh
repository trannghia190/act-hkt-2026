#!/usr/bin/env bash
# ==============================================================================
# ACT-HKT-2026: Automated Robot Framework Test Runner
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REPORT_DIR="${SCRIPT_DIR}/reports"

echo "======================================================================"
echo " Starting ACT-HKT-2026 Robot Framework Automated Test Suite"
echo "======================================================================"
echo " Project Root : ${PROJECT_ROOT}"
echo " Test Suites  : ${SCRIPT_DIR}/suites"
echo " Report Dir   : ${REPORT_DIR}"
echo "======================================================================"

mkdir -p "${REPORT_DIR}"

# Run Robot Framework
python3 -m robot \
    --outputdir "${REPORT_DIR}" \
    --name "ACT_Pulse_Full_System_Verification" \
    --log log.html \
    --report report.html \
    "${SCRIPT_DIR}/suites"

EXIT_CODE=$?

echo "======================================================================"
if [ ${EXIT_CODE} -eq 0 ]; then
    echo " ALL AUTOMATED TESTS PASSED SUCCESSFULLY!"
else
    echo " SOME TESTS FAILED (Exit Code: ${EXIT_CODE})"
fi
echo " HTML Report : ${REPORT_DIR}/report.html"
echo " HTML Log    : ${REPORT_DIR}/log.html"
echo "======================================================================"

exit ${EXIT_CODE}
