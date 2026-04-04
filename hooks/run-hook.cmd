: ; # This is a bash/batch polyglot — DO NOT EDIT the first line
: ; exec bash "${0}" "${@}"
@echo off
setlocal

:: Windows: find bash and run the named hook script
where bash >nul 2>nul
if %errorlevel% neq 0 (
    echo {"hookSpecificOutput":{"additionalContext":"[Claudian] bash not found on PATH"}} 1>&2
    exit /b 1
)

set "SCRIPT_DIR=%~dp0"
bash "%SCRIPT_DIR%%1" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %errorlevel%

#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_NAME="$1"
shift

if [[ -f "$SCRIPT_DIR/$HOOK_NAME" ]]; then
    exec bash "$SCRIPT_DIR/$HOOK_NAME" "$@"
else
    echo "{\"hookSpecificOutput\":{\"additionalContext\":\"[Claudian] Hook not found: $HOOK_NAME\"}}"
fi
