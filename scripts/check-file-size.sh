#!/usr/bin/env bash
set -euo pipefail

limit=1048576
found=0

while IFS= read -r -d '' file; do
  size=$(wc -c < "$file" | tr -d ' ')
  if (( size > limit )); then
    echo "$file is $size bytes"
    found=1
  fi
done < <(git ls-files -z)

if (( found != 0 )); then
  echo "A file is over 1 MB."
  exit 1
fi
