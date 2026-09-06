#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QR_DIR="$ROOT_DIR/qrs"

if ! command -v qrencode >/dev/null 2>&1; then
	printf 'Error: qrencode is required but was not found in PATH.\n' >&2
	exit 1
fi

mkdir -p "$QR_DIR"
find "$QR_DIR" -maxdepth 1 -type f -name 'table-*.png' -delete

printf 'Generating signed diner links...\n'
generator_output="$(cd "$ROOT_DIR" && npm run generate-qr --workspace @d3/api)"
generated=0

while IFS= read -r line; do
	case "$line" in
		*"Diner Link    : "*)
			url="${line#*Diner Link    : }"
			table_number="${url#*table=}"
			table_number="${table_number%%&*}"
			qr_path="$QR_DIR/table-${table_number}.png"
			qrencode -l H -m 4 -s 10 -o "$qr_path" "$url"
			printf 'Created %s\n' "$qr_path"
			generated=$((generated + 1))
			;;
	esac
done <<< "$generator_output"

if [[ "$generated" -eq 0 ]]; then
	printf 'Error: QR generator produced no diner links.\n' >&2
	exit 1
fi

printf 'Created %d QR code(s) in %s\n' "$generated" "$QR_DIR"

