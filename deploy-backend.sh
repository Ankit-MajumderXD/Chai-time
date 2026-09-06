#!/usr/bin/env bash
# Publishes the SpacetimeDB module to Maincloud — the backend half of a deploy.
# The Netlify site is deployed separately (git push -> Netlify). Run this whenever
# spacetimedb/ has changed, BEFORE (or right after) the site redeploys.
#
#   bash deploy-backend.sh
#
set -euo pipefail

DB="chai-time-r7mf4"

echo "==> who am I"
spacetime login show || { echo "Not logged in. Run: spacetime login"; exit 1; }

echo
echo "==> publishing module to Maincloud (additive hot-swap, keeps existing data)"
spacetime publish "$DB" --server maincloud --yes

echo
echo "==> verifying the new schema landed"
spacetime sql "$DB" --server maincloud "SELECT id FROM room_title LIMIT 1" >/dev/null 2>&1 \
  && echo "   room_title table        ... OK" \
  || echo "   room_title table        ... MISSING (publish did not take)"

spacetime sql "$DB" --server maincloud "SELECT style FROM roast_line_library LIMIT 1" >/dev/null 2>&1 \
  && echo "   roast_line_library.style ... OK" \
  || echo "   roast_line_library.style ... MISSING"

echo
echo "Done. Hard-refresh the deployed site (Cmd/Ctrl+Shift+R) and everything should work."
