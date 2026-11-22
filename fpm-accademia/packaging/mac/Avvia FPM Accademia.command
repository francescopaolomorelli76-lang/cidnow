#!/bin/bash
# FPM — Accademia Musicale Online · simulazione Mac (docente) + iPad (allievo)
# Doppio clic per avviare. Per chiudere: Ctrl+C o chiudi la finestra del Terminale.
set -euo pipefail
cd "$(dirname "$0")"
APP_DIR="$(pwd)/app"
RUNTIME_DIR="$(pwd)/app/runtime"
NODE_VERSION="v22.23.5"
# Impronte SHA-256 ufficiali (https://nodejs.org/dist/v22.23.5/SHASUMS256.txt)
SHA_ARM64="e7131995759b61a0170b646010d2ad35a5d37b4cb0d471f3e8317eac6f742f3d"
SHA_X64="c53383238206b9ae4db23c5d8a63645e2e753bec8ab51a49cc81939aa64e9422"

echo ""
echo "  FPM — Accademia Musicale Online"
echo "  Avvio della simulazione Mac + iPad…"
echo ""

node_ok() {
  local bin="$1"
  [ -x "$bin" ] || return 1
  local major
  major="$("$bin" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  [ "$major" -ge 22 ]
}

NODE_BIN=""
for candidate in "$RUNTIME_DIR/bin/node" "$(command -v node 2>/dev/null || true)" /opt/homebrew/bin/node /usr/local/bin/node; do
  if [ -n "$candidate" ] && node_ok "$candidate"; then NODE_BIN="$candidate"; break; fi
done

if [ -z "$NODE_BIN" ]; then
  case "$(uname -m)" in
    arm64) ARCH="arm64"; SHA="$SHA_ARM64" ;;
    x86_64) ARCH="x64"; SHA="$SHA_X64" ;;
    *) echo "Processore non supportato: $(uname -m)"; read -r -p "Premi Invio per chiudere"; exit 1 ;;
  esac
  NAME="node-$NODE_VERSION-darwin-$ARCH"
  echo "  Primo avvio: scarico il motore Node.js $NODE_VERSION ufficiale (circa 45 MB, una sola volta)…"
  TMP="$(mktemp -d)"
  if ! curl -fL --progress-bar "https://nodejs.org/dist/$NODE_VERSION/$NAME.tar.gz" -o "$TMP/node.tar.gz"; then
    echo "  Download non riuscito: controlla la connessione a Internet e riprova."
    read -r -p "  Premi Invio per chiudere"; exit 1
  fi
  GOT="$(shasum -a 256 "$TMP/node.tar.gz" | awk '{print $1}')"
  if [ "$GOT" != "$SHA" ]; then
    echo "  Verifica di sicurezza fallita (impronta diversa da quella ufficiale). Interrotto."
    rm -rf "$TMP"; read -r -p "  Premi Invio per chiudere"; exit 1
  fi
  tar -xzf "$TMP/node.tar.gz" -C "$TMP"
  rm -rf "$RUNTIME_DIR"
  mv "$TMP/$NAME" "$RUNTIME_DIR"
  rm -rf "$TMP"
  NODE_BIN="$RUNTIME_DIR/bin/node"
  echo "  Node.js pronto."
fi

# Apre la stanza del docente nel browser appena il server risponde.
(
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null http://localhost:8780/api/health; then
      open "http://localhost:8780"
      exit 0
    fi
    sleep 0.5
  done
) &

exec "$NODE_BIN" "$APP_DIR/server/fpm-server.mjs"
