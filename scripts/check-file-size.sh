#!/usr/bin/env bash
set -euo pipefail

limit=1048576
base="${1:-}"
found=0

if [[ -z "$base" ]]; then
  echo "Usage: check-file-size.sh <base-sha>"
  exit 1
fi

while IFS= read -r -d '' file; do
  [[ -f "$file" ]] || continue
  size=$(wc -c < "$file" | tr -d ' ')
  if (( size > limit )); then
    echo "$file is $size bytes"
    found=1
  fi
done < <(git diff --name-only --diff-filter=A -z "$base" HEAD)

if (( found != 0 )); then
  echo "A file added in this pull request is over 1 MB."
  exit 1
fi
