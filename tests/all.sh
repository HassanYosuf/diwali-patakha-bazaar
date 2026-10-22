#!/bin/sh
# Every test suite, once each. Needs the local Supabase stack running (npm --prefix tests run db:start).
cd "$(dirname "$0")/.." || exit 1
fail=0
run() { name=$1; pattern=$2; shift 2
  out=$("$@" 2>&1); st=$?
  echo "== $name: $(printf '%s\n' "$out" | sed 's/\x1b\[[0-9;]*m//g' | grep -E "$pattern" | tail -1)"
  [ $st = 0 ] || { fail=1; printf '%s\n' "$out" | tail -30; }
}
run database  "^Result|^Files="  npx --prefix tests supabase test db --workdir .
run functions "passed"           deno test --allow-env --allow-net supabase/functions
run js        "^ℹ (pass|fail)"   node --test "tests/js/*.test.mjs"
run game      "passed"           python3 tests/web/run.py
run admin     "passed"           python3 tests/web/run.py --local
[ $fail = 0 ] && echo "ALL GREEN" || echo "SOMETHING FAILED"
exit $fail
