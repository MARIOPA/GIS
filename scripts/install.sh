#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
node -e 'if(Number(process.versions.node.split(".")[0])<24)throw new Error("Se necesita Node 24 o posterior")'
npm ci --cache /tmp/torrents-npm-cache --no-audit --no-fund
bash scripts/install-lidar.sh
npm run build
bash scripts/prepare-pilot.sh
