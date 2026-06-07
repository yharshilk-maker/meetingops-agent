import playwright from "playwright-core";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const meetingUrl = process.argv[2] || process.env.MEETING_URL;
if (!meetingUrl?.startsWith("https://meet.google.com/")) {
  throw new Error("Usage: npm start -- https://meet.google.com/xxx-xxxx-xxx");
}

const backendUrl = (process.env.MEETINGOPS_BACKEND_URL || "http://localhost:3001").replace(/\/$/, "");
const extensionToken = process.env.MEETINGOPS_EXTENSION_TOKEN || "";
const botName = process.env.MEETINGOPS_BOT_NAME || "MeetingOps AI Agent";
const maxMinutes = Number(process.env.MEETINGOPS_BOT_MAX_MINUTES || 180);
const jobId = process.env.MEETINGOPS_BOT_JOB_ID;
const profile = process.env.MEETINGOPS_BOT_PROFILE || path.resolve(".meetingops-bot-profile");
const chromePath = process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const { chromium } = playwright;
const startedAt = new Date().toISOString();
const transcript = [];
const seen = new Set();

await mkdir(profile, { recursive: true });
const context = await chromium.launchPersistentContext(profile, {
  executablePath: chromePath,
  headless: process.env.MEETINGOPS_BOT_HEADLESS === "true",
  viewport: { width: 1280, height: 800 },
  permissions: ["microphone", "camera"],
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--disable-blink-features=AutomationControlled",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const page = context.pages()[0] || await context.newPage();
page.setDefaultTimeout(15_000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const visible = async (selector, timeout = 1500) => page.locator(selector).first().isVisible({ timeout }).catch(() => false);

async function clickFirst(selectors) {
  for (const selector of selectors) {
    if (await visible(selector)) {
      await page.locator(selector).first().click();
      return true;
    }
  }
  return false;
}

async function joinMeeting() {
  console.log(`Opening ${meetingUrl}`);
  await page.goto(meetingUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await sleep(5000);

  const nameInput = page.locator('input[placeholder*="name" i], input[aria-label*="name" i]').first();
  if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) await nameInput.fill(botName);

  // The bot joins visibly but never sends microphone or camera media.
  await clickFirst([
    'button[aria-label*="Turn off microphone" i]',
    'div[role="button"][aria-label*="Turn off microphone" i]',
  ]);
  await clickFirst([
    'button[aria-label*="Turn off camera" i]',
    'div[role="button"][aria-label*="Turn off camera" i]',
  ]);

  const joined = await clickFirst([
    'button:has-text("Join now")',
    'button:has-text("Ask to join")',
    'button:has-text("Request to join")',
    'div[role="button"]:has-text("Join now")',
    'div[role="button"]:has-text("Ask to join")',
  ]);
  if (!joined) throw new Error("Could not find a Google Meet join control.");
  console.log("Join request submitted. Waiting for the bot to enter the call...");

  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return text.includes("Leave call") || text.includes("Meeting details") || text.includes("Everyone is here");
  }, { timeout: 120_000 });
  console.log("Bot joined the meeting.");
}

async function turnOnCaptions() {
  const clicked = await clickFirst([
    'button[aria-label*="Turn on captions" i]',
    'button[aria-label*="captions" i]',
    'div[role="button"][aria-label*="Turn on captions" i]',
  ]);
  if (!clicked) {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+Shift+C" : "Control+Shift+C");
  }
  console.log("Live captions enabled.");
}

async function readCaptions() {
  const rows = await page.evaluate(() => {
    const results = [];
    const containers = document.querySelectorAll('[jsname="tgaKEf"], .iOzk7, [aria-live="polite"]');
    for (const container of containers) {
      const parent = container.closest('[jscontroller], .nMcdL') || container.parentElement;
      const speaker = parent?.querySelector('[jsname="YSxPC"], .zs7s8d')?.textContent?.trim() || "Speaker";
      const text = container.textContent?.trim();
      if (text && text.length > 1 && text.length < 2000) results.push({ speaker, text });
    }
    return results;
  });
  for (const row of rows) {
    const key = `${row.speaker}:${row.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const previous = transcript.at(-1);
    if (previous?.speaker === row.speaker && row.text.startsWith(previous.text)) previous.text = row.text;
    else transcript.push(row);
    console.log(`${row.speaker}: ${row.text}`);
  }
}

async function meetingEnded() {
  return page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes("You've left the call") || text.includes("The meeting has ended") || text.includes("Return to home screen");
  }).catch(() => true);
}

async function submitTranscript() {
  console.log(`Submitting ${transcript.length} caption entries to MeetingOps...`);
  const response = await fetch(`${backendUrl}/api/meet-bot/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(extensionToken ? { "X-MeetingOps-Extension-Token": extensionToken } : {}),
    },
    body: JSON.stringify({
      meetingUrl,
      jobId,
      title: await page.title().catch(() => "Google Meet conversation"),
      startedAt,
      transcript,
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `MeetingOps returned ${response.status}.`);
  if (jobId) {
    await fetch(`${backendUrl}/api/meet-bot/jobs/${jobId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(extensionToken ? { "X-MeetingOps-Extension-Token": extensionToken } : {}),
      },
      body: JSON.stringify({ runId: result.id }),
    });
  }
  console.log(`Agent run completed: ${result.id} (${result.stage})`);
  return result;
}

try {
  await joinMeeting();
  await turnOnCaptions();
  const deadline = Date.now() + maxMinutes * 60_000;
  while (Date.now() < deadline && !await meetingEnded()) {
    await readCaptions();
    await sleep(1000);
  }
  await readCaptions();
  await submitTranscript();
} finally {
  await context.close();
}
