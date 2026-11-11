#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if command -v python3 >/dev/null 2>&1; then
  PY_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PY_BIN="python"
else
  echo "[ERROR] Python 3.8+ is required but was not found in PATH." >&2
  exit 1
fi

if [[ "${1:-}" == "test" ]]; then
  shift
  exec node "${ROOT_DIR}/tests/verify_e2e.js" "$@"
fi

exec "${PY_BIN}" "${ROOT_DIR}/src/localize.py" "$@"
