#!/bin/sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://api:3000}"
API_PREFIX="${API_PREFIX:-api/v1}"
BASE="$API_BASE_URL/$API_PREFIX"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

require_contains() {
  file="$1"
  expected="$2"
  if ! grep -q "$expected" "$file"; then
    echo "Response/body did not contain: $expected" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

json_get() {
  file="$1"
  path="$2"
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); const path=process.argv[2].split('.'); let cur=data; for (const key of path) cur=cur?.[key]; if (cur === undefined || cur === null) process.exit(2); process.stdout.write(String(cur));" "$file" "$path"
}

echo "== Schema validate =="
npx prisma validate --schema /app/tutor-api/prisma/schema.prisma

echo "== Database schema checks =="
psql -v ON_ERROR_STOP=1 -c "select current_database() as database, current_schema() as schema;"
psql -v ON_ERROR_STOP=1 -c "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('users','user_credentials','email_tokens','tutor_profiles','payments','class_contracts','reviews','audit_logs') order by table_name;"
psql -v ON_ERROR_STOP=1 -c "select typname from pg_type where typname in ('UserStatus','ProductType','PaymentStatus','ClassStatus') order by typname;"

echo "== API health output =="
curl -fsS "$API_BASE_URL/healthz" | tee /tmp/healthz.json
echo
require_contains /tmp/healthz.json '"status":"ok"'

echo "== API ready output =="
curl -fsS "$API_BASE_URL/readyz" | tee /tmp/readyz.json
echo
require_contains /tmp/readyz.json '"db":"up"'

EMAIL="apiio-$(date +%H%M%S)@gmail.com"
PASSWORD="apiio-pass-12345"

echo "== cURL validation input/output =="
invalid_code="$(curl -sS -o /tmp/invalid-register.json -w "%{http_code}" \
  -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  --data '{"email":"not-gmail@yahoo.com","password":"short"}')"
cat /tmp/invalid-register.json
echo
[ "$invalid_code" = "400" ] || fail "expected invalid register to return 400, got $invalid_code"
require_contains /tmp/invalid-register.json '"code":"VALIDATION_ERROR"'

echo "== cURL register (email + password) output =="
reg_code="$(curl -sS -o /tmp/register.json -w "%{http_code}" \
  -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  --data "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
cat /tmp/register.json
echo
[ "$reg_code" = "201" ] || fail "expected register to return 201, got $reg_code"
require_contains /tmp/register.json '"verification_required":true'
require_contains /tmp/register.json '"dev_verification_link"'
VERIFY_LINK="$(json_get /tmp/register.json dev_verification_link)"
VERIFY_TOKEN="$(printf '%s' "$VERIFY_LINK" | sed -n 's/.*token=\([^&]*\).*/\1/p')"

echo "== cURL login before verify rejected (EMAIL_NOT_VERIFIED) =="
early_code="$(curl -sS -o /tmp/login-early.json -w "%{http_code}" \
  -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  --data "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
[ "$early_code" = "403" ] || fail "expected login before verify to return 403, got $early_code"
require_contains /tmp/login-early.json '"code":"EMAIL_NOT_VERIFIED"'

echo "== cURL email verify output =="
verify_code="$(curl -sS -o /tmp/verify.json -w "%{http_code}" \
  -X POST "$BASE/auth/email/verify" \
  -H "Content-Type: application/json" \
  --data "{\"token\":\"$VERIFY_TOKEN\"}")"
cat /tmp/verify.json
echo
[ "$verify_code" = "201" ] || fail "expected email verify to return 201, got $verify_code"
require_contains /tmp/verify.json '"verified":true'

echo "== cURL login output =="
login_code="$(curl -sS -o /tmp/login.json -w "%{http_code}" \
  -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  --data "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
cat /tmp/login.json
echo
[ "$login_code" = "201" ] || fail "expected login to return 201, got $login_code"
require_contains /tmp/login.json '"access_token"'
require_contains /tmp/login.json '"consent_required":true'
# Refresh token chỉ nằm trong cookie HttpOnly kt_refresh, KHÔNG lộ ra body (R-05).
if grep -q '"refresh_token"' /tmp/login.json; then fail "login body must not expose refresh_token (cookie HttpOnly only)"; fi

ACCESS_TOKEN="$(json_get /tmp/login.json access_token)"

echo "== cURL authenticated /auth/me output =="
me_code="$(curl -sS -o /tmp/auth-me.json -w "%{http_code}" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "$BASE/auth/me")"
cat /tmp/auth-me.json
echo
[ "$me_code" = "200" ] || fail "expected /auth/me to return 200, got $me_code"
require_contains /tmp/auth-me.json '"status":"pending_consent"'

echo "== Database write checks =="
psql -v ON_ERROR_STOP=1 -c "select count(*) as users from users;"
psql -v ON_ERROR_STOP=1 -c "select type, consumed_at is not null as consumed from email_tokens order by created_at desc limit 1;"

echo "OK: schema, database, API input validation, cURL output, register/verify/login write/read flow verified."
