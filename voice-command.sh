#!/data/data/com.termux/files/usr/bin/bash
# BUBU voice widget: ONE tap = one wake session.
# Say "hello" (or anything) once, then keep talking — BUBU greets you and
# keeps listening for follow-up commands in the SAME session until you say
# "stop" / "that's all" / "done" or go quiet for ~15 seconds.
# Copy this file to ~/.shortcuts/ and make it executable with: chmod +x voice-command.sh
# Set this per device because widget scripts run from ~/.shortcuts/.
# Tries ~/BUBU first (this repo), then falls back to ~/bubu.
if [[ -n "$PROJECT_DIR" && -d "$PROJECT_DIR" ]]; then
	:
elif [[ -d "$HOME/BUBU" ]]; then
	PROJECT_DIR="$HOME/BUBU"
else
	PROJECT_DIR="$HOME/bubu"
fi

if [[ ! -d "$PROJECT_DIR" ]]; then
	termux-toast "Bubu project directory not found: $PROJECT_DIR" 2>/dev/null || \
		echo "Bubu project directory not found: $PROJECT_DIR" >&2
	exit 1
fi

cd "$PROJECT_DIR" || exit 1
exec node src/voiceTrigger.js
