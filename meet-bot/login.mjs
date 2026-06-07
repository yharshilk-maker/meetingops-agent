import playwright from "playwright-core";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const profile = process.env.MEETINGOPS_BOT_PROFILE || path.resolve(".meetingops-bot-profile");
const chromePath = process.env.CHROME_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const { chromium } = playwright;
await mkdir(profile, { recursive: true });
const context = await chromium.launchPersistentContext(profile, {
  executablePath: chromePath,
  headless: false,
  viewport: null,
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = context.pages()[0] || await context.newPage();
await page.goto("https://accounts.google.com/");
console.log("Sign in to the Google account that MeetingOps should use, then close the browser.");
