#!/usr/bin/env bash
# Deploy the KoliGo API on the server hosting koligoapi.trugroup.cm.
# Run it from the backend/ directory of the checkout the server serves from.
set -euo pipefail

BRANCH="${1:-preprod}"

echo "==> Fetching $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> Installing dependencies"
npm ci --omit=dev || npm install --omit=dev

echo "==> Applying database migrations"
# migrate deploy only replays committed migrations; it never prompts and never
# drops data, unlike `migrate dev`.
#
# The drift migration is a special case: on a database that already grew
# Message, distanceKm and gender by hand, replaying it fails on objects that
# exist. Marking it applied records it without re-running the SQL. Harmless
# when the migration is already recorded.
DRIFT_MIGRATION="20260813235900_sync_schema_drift"
if ! npx prisma migrate deploy; then
  echo "==> migrate deploy failed — marking $DRIFT_MIGRATION as applied and retrying"
  npx prisma migrate resolve --applied "$DRIFT_MIGRATION" || true
  npx prisma migrate deploy
fi
npx prisma generate

echo "==> Building"
npm run build

echo "==> Restarting"
# Adjust to whatever supervises the process on this host.
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart koligo-api --update-env || pm2 start dist/server.js --name koligo-api
elif systemctl list-units --type=service | grep -q koligo; then
  sudo systemctl restart koligo-api
else
  echo "!! No pm2 or systemd unit found — restart the API process manually."
  exit 1
fi

echo "==> Health check"
sleep 3
curl -fsS http://127.0.0.1:"${PORT:-3001}"/health && echo " OK"
