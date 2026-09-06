# Bubu

Bubu is a Node.js WhatsApp assistant for Termux on Android. It monitors configured WhatsApp chats for schedule changes, saves upcoming events, creates Android alarms, reads recent messages aloud, and provides voice-triggered SMS, missed-call, contact, and away-mode actions.

## Project Structure

```text
src/
  index.js                 Main WhatsApp process
  whatsapp.js              Baileys connection and messaging
  messageHandler.js        Watched-message history buffer
  extractor.js             Schedule/event extraction
  voiceCommands.js         Voice phrase matching
  voiceRouter.js           Voice command actions
  voiceTrigger.js          One-shot widget entrypoint
  store.js                 Local store.json persistence
  config.js                User-editable chat and reply settings
  termux/                  Termux and Android integrations
    tts.js                 Text-to-speech
    sms.js                 SMS list/send
    callLog.js              Missed calls
    contacts.js             Contact lookup
    speechToText.js         Speech recognition
    alarm.js                Android alarms
```

Edit `src/config.js` to set `WATCHED_CHATS` and the away auto-reply text. The WhatsApp session is stored in `auth_info/`; runtime data is stored in `store.json`.

## Run Offline Tests

From the project directory:

```sh
npm run test:extractor
npm run test:voice
```

## Start Bubu

Install dependencies once, then start the persistent WhatsApp process:

```sh
npm install
npm start
```

Scan the displayed QR code from WhatsApp when prompted. Voice commands run separately through `npm run voice`; the Termux:Widget script can be copied to `~/.shortcuts/` and made executable with `chmod +x voice-command.sh`.

## Android Setup

Follow the [official Termux installation guide](https://github.com/termux/termux-app/wiki/Installation) for Termux, Termux:API, permissions, and widget setup before running the Android integrations.
