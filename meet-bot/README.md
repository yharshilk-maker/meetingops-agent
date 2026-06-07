# MeetingOps Meet bot prototype

This worker joins a Google Meet as a visible participant, turns its microphone and camera off, enables live captions, collects speaker-attributed caption text, and submits the transcript to MeetingOps when the call ends.

It is inspired by `AbishKamran/google-meet-ai-agent`, but adds the missing transcription and MeetingOps reasoning pipeline.

## Setup

```bash
cd meet-bot
npm install
npm run login
```

Sign in to the Google account the bot should use, then close Chrome.

## Join a meeting

```bash
MEETINGOPS_BACKEND_URL=http://localhost:3001 \
npm start -- https://meet.google.com/xxx-xxxx-xxx
```

For the hosted backend:

```bash
MEETINGOPS_BACKEND_URL=https://meetingops-production.up.railway.app \
npm start -- https://meet.google.com/xxx-xxxx-xxx
```

If the organizer does not automatically admit the bot account, approve its join request from the meeting.

## Automatic worker

After the Workspace watcher is installed, select **Hybrid** or **Bot** in the MeetingOps integrations panel and run:

```bash
MEETINGOPS_BACKEND_URL=http://localhost:3001 \
npm run worker
```

The worker polls MeetingOps for jobs queued by Google Meet conference-start events, joins each meeting automatically, captures captions, and submits the transcript. In **Hybrid** mode, MeetingOps keeps the bot transcript as coverage while preferring Google's official transcript when it becomes available.

## Environment

- `MEETINGOPS_BOT_NAME`: visible guest name, default `MeetingOps AI Agent`
- `MEETINGOPS_BOT_PROFILE`: persistent Chrome profile directory
- `MEETINGOPS_BOT_MAX_MINUTES`: maximum meeting duration, default `180`
- `MEETINGOPS_BOT_HEADLESS`: set `true` only after validating the Meet flow
- `MEETINGOPS_EXTENSION_TOKEN`: shared backend token, if configured
- `MEETINGOPS_BOT_WORKER_ID`: optional stable name for this browser worker
- `MEETINGOPS_BOT_POLL_MS`: queue polling interval, default `15000`
- `CHROME_EXECUTABLE`: Chrome/Chromium executable path

## Prototype limitations

- Google Meet UI selectors change and require ongoing maintenance.
- The bot must be admitted when the meeting does not allow instant joining.
- Captions provide useful speaker attribution but may omit or misrecognize speech.
- Running this in the cloud requires a browser-worker container and persistent bot profile.
