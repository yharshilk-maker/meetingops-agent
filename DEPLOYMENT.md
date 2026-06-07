# Deployment

## Recommended handoff

Share both:

1. A public GitHub repository so reviewers can inspect the architecture and run it themselves.
2. A hosted URL so reviewers can immediately use the transcript test bench.

For the interview demo, keep the local app and ngrok tunnel available as a backup. The full Google Meet event flow has more external dependencies than the transcript test bench.

## Recommended host: Railway

MeetingOps receives Pub/Sub webhooks and stores Google OAuth tokens on disk, so a long-running Node service with a persistent volume is a better fit than a purely serverless deployment.

1. Create a Railway project from the GitHub repository.
2. Add a persistent volume mounted at `/data`.
3. Add the environment variables from `.env.example`.
4. Set `MEETINGOPS_DATA_DIR=/data`.
5. Generate a public Railway domain.
6. Set `GOOGLE_REDIRECT_URI=https://YOUR_DOMAIN/api/auth/google/callback`.
7. Add that redirect URI to the Google OAuth client.
8. Set the Pub/Sub push endpoint to:

```text
https://YOUR_DOMAIN/api/webhooks/google-meet
```

9. Redeploy, connect Google Workspace, and activate the Meet watcher.

For automatic Meet-bot coverage, run `npm run worker` from `meet-bot` on a separate machine or browser-worker service with a persistent signed-in Chrome profile. Point `MEETINGOPS_BACKEND_URL` at the Railway app and use the same `MEETINGOPS_EXTENSION_TOKEN`.

The included `railway.toml` starts the production Next.js server and uses `/api/health` for health checks.

## Fast hosted preview

Vercel is fine for showcasing the UI, simulated events, and pasted-transcript analysis. The complete Google Workspace flow is not recommended there yet because OAuth tokens and agent runs currently use single-process local state.

## Production hardening

Before treating MeetingOps as a multi-user production service:

- Store OAuth tokens encrypted in a managed database or secrets store.
- Persist agent runs, workspace memory, and webhook deduplication records.
- Validate Pub/Sub signed JWTs.
- Add per-user authentication and tenant isolation.
- Renew Google Workspace subscriptions with a scheduled job.
- Run a durable job queue for transcript processing and external actions.
