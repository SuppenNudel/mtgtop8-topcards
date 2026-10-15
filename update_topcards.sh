#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
exec >> "$SCRIPT_DIR/update_topcards.log" 2>&1

LOCK_FILE="/tmp/mtgtop8_topcards_update.lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    echo "[$(date -Iseconds)] Another update is already running; exiting."
    exit 1
fi

PYTHON_BIN="${PYTHON_BIN:-/home/rohmce/myenv/bin/python}"
PYTHON_UNBUFFERED="1"

if [[ ! -x "$PYTHON_BIN" ]]; then
    echo "[$(date -Iseconds)] Python interpreter not found or not executable: $PYTHON_BIN" >&2
    exit 127
fi

formats=("pauper" "pioneer" "standard" "modern" "legacy")

echo "[$(date -Iseconds)] Starting topcards update run"

for format in "${formats[@]}"; do
    # Capitalize first letter
    filename="$(tr '[:lower:]' '[:upper:]' <<< ${format:0:1})${format:1}.json"

    echo "[$(date -Iseconds)] Running format=${format} output=${filename}"
    PYTHONUNBUFFERED="$PYTHON_UNBUFFERED" "$PYTHON_BIN" -u mtgtop8_topcards_analysis_json.py \
        --format "$format" \
        --last-page 0 \
        --output "$filename"
    echo "[$(date -Iseconds)] Finished format=${format}"

    if ! git diff --quiet -- "$filename"; then
        git add "$filename"
        git commit -m "Update ${filename} [auto]"
        git push
        echo "[$(date -Iseconds)] Committed and pushed ${filename}"
    else
        echo "[$(date -Iseconds)] No changes for ${filename}"
    fi
done

echo "[$(date -Iseconds)] Update run complete"
