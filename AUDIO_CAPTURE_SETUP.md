# Google Meet audio capture setup

MeetingOps includes a Chrome extension that captures the audio playing in a Google Meet tab and transcribes it with Groq Whisper. This path does not depend on Google Meet's paid transcription feature.

## Install the extension

1. Clone or download this repository.
2. In Chrome, open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the repository's `extension` folder.
6. Pin **MeetingOps Meet Agent** from Chrome's Extensions menu.

## Use it in a meeting

1. Join or start a meeting at `meet.google.com`.
2. Open the MeetingOps extension and click **Start MeetingOps**.
3. Keep the Meet tab open. Meeting audio will continue playing normally.
4. At the end of the meeting, open the extension and click **Stop and analyze meeting**.
5. Open the MeetingOps dashboard. The transcript analysis appears under **Agent runs** and the resulting meeting brief appears in the dashboard.

Chrome requires the Start click before an extension can capture tab audio. After that, recording runs in an offscreen extension document even if the popup closes.

## Backend configuration

The extension defaults to:

```text
https://meetingops-production.up.railway.app
```

During development, open **Connection settings** in the extension and use:

```text
http://localhost:3001
```

For a shared deployment, configure `MEETINGOPS_EXTENSION_TOKEN` on the backend and enter the same token in the extension settings.

## Current limitations

- The extension captures combined tab audio, so individual speaker identification is best-effort.
- Audio is uploaded and transcribed in independently decodable one-minute segments. The final agent analysis begins when the meeting ends.
- Chrome intentionally requires a user gesture to begin tab audio capture.
