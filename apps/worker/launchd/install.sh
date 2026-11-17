#!/bin/zsh
# Instala el worker como agente de launchd del usuario: arranca al iniciar sesión y se reinicia si se cae.
# Deshacer: ./uninstall.sh
set -euo pipefail

LABEL="com.personalhub.worker"
WORKER_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$HOME/.local/bin/node"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/hub-worker.log"

[[ -x "$NODE" ]] || { echo "No encuentro Node en $NODE"; exit 1; }
[[ -f "$WORKER_DIR/.env" ]] || { echo "Falta $WORKER_DIR/.env"; exit 1; }

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>--env-file=.env</string>
    <string>src/index.ts</string>
  </array>
  <key>WorkingDirectory</key><string>$WORKER_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$HOME/.local/bin:/usr/bin:/bin</string>
    <key>TZ</key><string>Europe/Madrid</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>60</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Worker instalado. Registro: $LOG"
launchctl print "gui/$(id -u)/$LABEL" | grep -E "state|pid" | head -3
