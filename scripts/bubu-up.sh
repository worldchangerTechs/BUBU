#!/data/data/com.termux/files/usr/bin/bash
# BUBU UP — Termux:Widget shortcut: boots local LLM + WhatsApp + HUD with one tap.
# Triggers while it runs (both work):
#   VOICE: new Termux session -> cd ~/BUBU && npm run voice   (mic via Termux:API)
#   TEXT:  new Termux session -> cd ~/BUBU && npm run bubu -- "read my messages"
# Install:
#   mkdir -p ~/.shortcuts
#   cp ~/BUBU/scripts/bubu-up.sh ~/.shortcuts/"BUBU UP.sh"
#   chmod +x ~/.shortcuts/"BUBU UP.sh"
# Configure (optional, before tapping):
#   export BUBU_LLM_MODEL="$HOME/models/bubu.gguf"
#   export BUBU_TEXT=1   # interactive "bubu>" prompt inside the UP terminal instead
PROJECT_DIR="${PROJECT_DIR:-$HOME/BUBU}"

if [[ ! -d "$PROJECT_DIR" ]]; then
	termux-toast "Bubu project directory not found: $PROJECT_DIR" 2>/dev/null || \
		echo "Bubu project directory not found: $PROJECT_DIR" >&2
	exit 1
fi

cd "$PROJECT_DIR" || exit 1
termux-wake-lock 2>/dev/null || true
exec npm run up
