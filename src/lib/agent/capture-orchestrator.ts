import { readJson, writeJson } from "@/lib/agent/data-store";

const CONFIG_FILE = "capture-config.json";
const BOT_JOBS_FILE = "meet-bot-jobs.json";

export type CaptureMode = "official" | "bot" | "hybrid";
export type CaptureConfig = {
  mode: CaptureMode;
  botName: string;
  updatedAt: string;
};
export type MeetBotJob = {
  id: string;
  conferenceRecord: string;
  meetingUrl?: string;
  title: string;
  status: "queued" | "claimed" | "completed" | "failed";
  createdAt: string;
  claimedAt?: string;
  completedAt?: string;
  workerId?: string;
  runId?: string;
  error?: string;
};

const DEFAULT_CONFIG: CaptureConfig = {
  mode: "hybrid",
  botName: "MeetingOps AI Agent",
  updatedAt: new Date(0).toISOString(),
};

export async function getCaptureConfig() {
  return await readJson<CaptureConfig>(CONFIG_FILE) ?? DEFAULT_CONFIG;
}

export async function updateCaptureConfig(input: { mode?: CaptureMode; botName?: string }) {
  const current = await getCaptureConfig();
  const config: CaptureConfig = {
    mode: input.mode ?? current.mode,
    botName: input.botName?.trim() || current.botName,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(CONFIG_FILE, config);
  return config;
}

async function getJobs() {
  return await readJson<MeetBotJob[]>(BOT_JOBS_FILE) ?? [];
}

async function saveJobs(jobs: MeetBotJob[]) {
  await writeJson(BOT_JOBS_FILE, jobs.slice(0, 100));
}

export async function queueMeetBotJob(input: { conferenceRecord: string; meetingUrl?: string; title?: string }) {
  const jobs = await getJobs();
  const existing = jobs.find((job) => job.conferenceRecord === input.conferenceRecord && job.status !== "failed");
  if (existing) return existing;
  const job: MeetBotJob = {
    id: crypto.randomUUID(),
    conferenceRecord: input.conferenceRecord,
    meetingUrl: input.meetingUrl,
    title: input.title?.trim() || "Google Meet conversation",
    status: "queued",
    createdAt: new Date().toISOString(),
  };
  await saveJobs([job, ...jobs]);
  return job;
}

export async function listMeetBotJobs() {
  return getJobs();
}

export async function getMeetBotJob(id: string) {
  return (await getJobs()).find((job) => job.id === id);
}

export async function claimMeetBotJob(workerId: string) {
  const jobs = await getJobs();
  const job = jobs.find((item) => item.status === "queued" && item.meetingUrl);
  if (!job) return undefined;
  job.status = "claimed";
  job.claimedAt = new Date().toISOString();
  job.workerId = workerId;
  await saveJobs(jobs);
  return job;
}

export async function completeMeetBotJob(id: string, input: { runId?: string; error?: string }) {
  const jobs = await getJobs();
  const job = jobs.find((item) => item.id === id);
  if (!job) throw new Error("Meet bot job not found.");
  job.status = input.error ? "failed" : "completed";
  job.completedAt = new Date().toISOString();
  job.runId = input.runId;
  job.error = input.error;
  await saveJobs(jobs);
  return job;
}
