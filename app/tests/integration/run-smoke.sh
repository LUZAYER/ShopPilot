#!/usr/bin/env bash
# Integration test runner — executes the full HTTP smoke test against a
# running dev or production server. Assumes the app is already up at
# $BASE_URL (default http://localhost:3000) and that prisma is seeded.
set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

echo "▶ Running ShopPilot smoke test against $BASE_URL"
cd "$ROOT_DIR"
BASE_URL="$BASE_URL" node smoke-commerce.mjs
echo "✅ Smoke test passed"
