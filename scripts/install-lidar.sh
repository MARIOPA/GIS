#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
if [[ ! -x .venv-lidar/bin/python ]]; then python3 -m venv .venv-lidar; fi
.venv-lidar/bin/python -m pip install --cache-dir /tmp/torrents-pip-cache -r requirements-lidar.lock
.venv-lidar/bin/python -m pip check
