import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const backendUrl = (process.env.MEETINGOPS_BACKEND_URL || "http://localhost:3001").replace(/\/$/, "");
const extensionToken = process.env.MEETINGOPS_EXTENSION_TOKEN || "";
const workerId = process.env.MEETINGOPS_BOT_WORKER_ID || `worker-${Date.now()}`;
const pollMs = Number(process.env.MEETINGOPS_BOT_POLL_MS || 15000);
const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "meet-bot.mjs");

function headers() {
  return {
    "Content-Type": "application/json",
    ...(extensionToken ? { "X-MeetingOps-Extension-Token": extensionToken } : {}),
  };
}

async function request(pathname, init = {}) {
  const response = await fetch(`${backendUrl}${pathname}`, { ...init, headers: { ...headers(), ...init.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `MeetingOps returned ${response.status}`);
  return body;
}

function runBot(job) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, job.meetingUrl], {
      stdio: "inherit",
      env: {
        ...process.env,
        MEETINGOPS_BACKEND_URL: backendUrl,
        MEETINGOPS_BOT_JOB_ID: job.id,
        MEETINGOPS_BOT_NAME: process.env.MEETINGOPS_BOT_NAME || "MeetingOps AI Agent",
      },
    });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Meet bot exited with code ${code}`)));
  });
}

async function markFailed(job, error) {
  await request(`/api/meet-bot/jobs/${job.id}`, {
    method: "POST",
    body: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
  }).catch((updateError) => console.error(updateError));
}

console.log(`MeetingOps bot worker ${workerId} polling ${backendUrl}`);
while (true) {
  try {
    const { job } = await request(`/api/meet-bot/jobs?workerId=${encodeURIComponent(workerId)}`);
    if (job?.meetingUrl) {
      console.log(`Claimed ${job.id}: ${job.meetingUrl}`);
      try {
        await runBot(job);
      } catch (error) {
        console.error(error);
        await markFailed(job, error);
      }
    }
  } catch (error) {
    console.error(error);
  }
  await new Promise((resolve) => setTimeout(resolve, pollMs));
}
