# MeetingOps Meet Agent extension

This unpacked Chrome extension captures compressed audio from a Google Meet tab, sends independently decodable one-minute segments to Groq Whisper, and starts the MeetingOps agent analysis when the meeting ends.

## Install locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this `extension` folder.
4. Open a Google Meet tab and click the MeetingOps extension.
5. Click **Start MeetingOps**. Chrome requires this one user gesture before tab audio can be captured.
6. At the end of the meeting, click **Stop and analyze meeting**.

The popup defaults to the hosted MeetingOps backend. Use **Connection settings** to point it to `http://localhost:3001` during development or supply `MEETINGOPS_EXTENSION_TOKEN` when the backend requires one.

The extension captures combined tab audio. It does not currently identify individual speakers.
