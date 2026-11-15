#!/usr/bin/env sh
# Builds the page, copies it into solution/ and packs the managed and unmanaged zips into out/.
# Needs Node and the Power Platform CLI (`pac`). Same steps as build-solution.ps1.
set -eu
cd "$(dirname "$0")/.."
node scripts/solution.mjs check
npm run build
node scripts/check-dist.mjs
node scripts/solution.mjs stage
mkdir -p out
for kind in managed unmanaged; do
  name="$(node scripts/solution.mjs name "$kind")"
  pac solution pack --zipfile "out/$name" --folder solution/src --packagetype "$(printf '%s' "$kind" | sed 's/^./\U&/')" --errorlevel Warning
  echo "Packed out/$name"
done
