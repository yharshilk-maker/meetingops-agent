# Google Workspace Setup

This setup lets MeetingOps automatically receive Google Meet transcript events, fetch transcript entries, save briefs to Drive, and create Gmail drafts.

## 1. Create a Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Record the project ID.

Enable these APIs under **APIs & Services → Library**:

- Google Meet REST API
- Google Workspace Events API
- Gmail API
- Google Drive API
- Cloud Pub/Sub API

## 2. Configure OAuth

Under **Google Auth Platform → Branding / Audience / Data Access**:

1. Configure the consent screen.
2. Choose **External** unless you are using a Workspace organization.
3. Add your Google account as a test user.
4. Add these scopes:

```text
openid
email
profile
https://www.googleapis.com/auth/meetings.space.readonly
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/gmail.compose
```

Under **Clients**, create an **OAuth client ID → Web application**.

Add this local authorized redirect URI:

```text
http://localhost:3001/api/auth/google/callback
```

For deployment, also add:

```text
https://YOUR_DOMAIN/api/auth/google/callback
```

Copy the client ID and client secret into `.env.local`.

## 3. Create the Pub/Sub topic

In **Pub/Sub → Topics**, create:

```text
meetingops-events
```

On the topic permissions panel, add this principal:

```text
meet-api-event-push@system.gserviceaccount.com
```

Grant it:

```text
Pub/Sub Publisher
```

The full topic value is:

```text
projects/YOUR_PROJECT_ID/topics/meetingops-events
```

Avoid configuring a message storage policy because Workspace Events uses ordering keys and event regions might not match the policy.

## 4. Create a push subscription

Pub/Sub cannot push to localhost. Deploy MeetingOps to a public HTTPS URL or use an ngrok tunnel:

```bash
ngrok http 3001
```

Create a Pub/Sub push subscription for `meetingops-events` with:

```text
https://YOUR_PUBLIC_DOMAIN/api/webhooks/google-meet
```

For this take-home, append a secret header through your proxy or use an authenticated push subscription. Production should validate Pub/Sub's signed JWT. MeetingOps also supports:

```bash
GOOGLE_WEBHOOK_SECRET="a-long-random-secret"
```

with the request header:

```text
x-meetingops-webhook-secret: a-long-random-secret
```

## 5. Choose the Meet target

MeetingOps can watch:

- One Meet space: `//meet.googleapis.com/spaces/SPACE_ID`
- All spaces owned by a user: `//cloudidentity.googleapis.com/users/USER_ID`

For the best demo, use a single Meet space first. MeetingOps accepts the normal Meet URL or meeting code and resolves it to the canonical API space ID before creating the subscription.

## 6. Configure `.env.local`

```bash
LLM_PROVIDER="groq"
GROQ_API_KEY="..."
GROQ_MODEL="openai/gpt-oss-20b"

GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="http://localhost:3001/api/auth/google/callback"
GOOGLE_PUBSUB_TOPIC="projects/YOUR_PROJECT_ID/topics/meetingops-events"
GOOGLE_MEET_TARGET_RESOURCE="https://meet.google.com/YOUR-MEETING-CODE"
GOOGLE_WEBHOOK_SECRET=""
GOOGLE_DRIVE_ROOT_FOLDER_ID=""
```

Restart the app after changing environment variables:

```bash
npm run dev
```

## 7. Connect and activate

1. Open MeetingOps.
2. Click the cloud integration button in the top bar.
3. Click **Connect Google Workspace**.
4. Grant permissions.
5. Return to the integration panel and click **Activate Meet watcher**.
6. Start a Google Meet using the monitored space and enable transcription.
7. End the meeting. After Google generates the transcript, the agent should process it automatically.

## Important limitations

- Google Meet transcription must be enabled during the meeting.
- The authenticated user must have access to the conference transcript.
- This demo stores OAuth tokens in the local gitignored `.meetingops` directory. A production deployment must encrypt and persist refresh tokens in a managed secrets store or database.
- Google Workspace subscriptions expire and should be renewed by a scheduled background job.
