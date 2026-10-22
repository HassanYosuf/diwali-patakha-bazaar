#!/bin/sh
# Every test suite. Needs the local Supabase stack running (npm --prefix tests run db:start).
cd "$(dirname "$0")/.." || exit 1
fail=0
echo "== database";   npx --prefix tests supabase test db --workdir . 2>&1 | grep -E "^Files=|^Result" || fail=1
echo "== functions";  deno test --allow-env --allow-net supabase/functions 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "passed|failed" | tail -1
deno test --allow-env --allow-net supabase/functions >/dev/null 2>&1 || fail=1
echo "== brands.js";  node --test "tests/js/*.test.mjs" 2>&1 | grep -E "^ℹ (pass|fail)"; node --test "tests/js/*.test.mjs" >/dev/null 2>&1 || fail=1
echo "== game";       python3 tests/web/run.py 2>&1 | tail -1; python3 tests/web/run.py >/dev/null 2>&1 || fail=1
echo "== admin";      python3 tests/web/run.py --local 2>&1 | tail -1; python3 tests/web/run.py --local >/dev/null 2>&1 || fail=1
[ $fail = 0 ] && echo "ALL GREEN" || echo "SOMETHING FAILED"
exit $fail
