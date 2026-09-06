#!/data/data/com.termux/files/usr/bin/bash
# Copy this file to ~/.shortcuts/ and make it executable with: chmod +x voice-command.sh
# Set this per device because widget scripts run from ~/.shortcuts/.
PROJECT_DIR="${PROJECT_DIR:-$HOME/bubu}"

if [[ ! -d "$PROJECT_DIR" ]]; then
	termux-toast "Bubu project directory not found: $PROJECT_DIR" 2>/dev/null || \
		echo "Bubu project directory not found: $PROJECT_DIR" >&2
	exit 1
fi

cd "$PROJECT_DIR" || exit 1
exec node src/voiceTrigger.js
