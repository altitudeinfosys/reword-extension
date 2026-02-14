#!/usr/bin/env bash
set -euo pipefail

OUT="reword-extension.zip"

# Clean previous build
rm -f "$OUT"

# Package extension, excluding dev/non-extension files
zip -r "$OUT" . \
  -x ".git/*" \
  -x ".DS_Store" \
  -x "test.html" \
  -x "build.sh" \
  -x "PLAN.md" \
  -x "STORE_LISTING.md" \
  -x "privacy-policy.html" \
  -x "*.zip" \
  -x ".gitignore"

SIZE=$(du -h "$OUT" | cut -f1)
echo ""
echo "Created $OUT ($SIZE)"
echo ""
echo "Contents:"
unzip -l "$OUT" | awk 'NR>3 && /\// || /\.[a-z]/ {print "  " $4}'
