#!/usr/bin/env bash
# Run an image the way Kubernetes "restricted" would (non-root, no capabilities, no privilege escalation,
# read-only root filesystem) and check that it serves.
#   scripts/docker-smoke.sh archipen
#   scripts/docker-smoke.sh archipen-render --render
# Runs twice: with a writable /tmp, and without one, to prove the image doesn't need it.
set -euo pipefail

img=${1:?usage: docker-smoke.sh <image> [--render]}
render=${2:-}
port=${SMOKE_PORT:-18080}
root=$(cd "$(dirname "$0")/.." && pwd)

user=$(docker image inspect -f '{{.Config.User}}' "$img")
uid=${user%%:*}
if ! [[ $uid =~ ^[0-9]+$ ]] || [ "$uid" = 0 ]; then
  echo "✗ $img: USER must be a numeric, non-zero UID (got '${user}')" >&2
  exit 1
fi
echo "✓ $img: USER $user"

check() {
  local label=$1; shift
  local id
  id=$(docker run -d --read-only --cap-drop ALL --security-opt no-new-privileges "$@" \
    -e BASE_PATH=/x -p "127.0.0.1:$port:8080" "$img")
  trap 'docker rm -f "$id" >/dev/null 2>&1 || true' RETURN

  local ok=
  for _ in $(seq 1 50); do
    if curl -fs -o /dev/null "http://127.0.0.1:$port/x/${render:+healthz}"; then ok=1; break; fi
    sleep 0.2
  done
  if [ -z "$ok" ]; then
    echo "✗ $img ($label): not serving" >&2
    docker logs "$id" >&2 || true
    return 1
  fi

  if [ -z "$render" ]; then
    local headers
    headers=$(curl -fsSI "http://127.0.0.1:$port/x/")
    for want in "frame-ancestors 'none'" "script-src 'self'" "X-Frame-Options: DENY"; do
      if ! grep -qiF "$want" <<<"$headers"; then
        echo "✗ $img ($label): response lacks \"$want\"" >&2
        echo "$headers" >&2
        return 1
      fi
    done
  fi

  if [ -n "$render" ]; then
    local code
    code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
      --data-binary "@$root/examples/minimal.archipen.json" "http://127.0.0.1:$port/x/export?format=png")
    if [ "$code" != 200 ]; then
      echo "✗ $img ($label): PNG export returned $code" >&2
      docker logs "$id" >&2 || true
      return 1
    fi
  fi
  echo "✓ $img ($label)"
}

check "read-only root, writable /tmp" --tmpfs /tmp
check "read-only root, no /tmp"
