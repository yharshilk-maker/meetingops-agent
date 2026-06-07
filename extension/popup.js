const DEFAULT_BACKEND = "https://meetingops-production.up.railway.app";
const statusText = document.querySelector("#status");
const detailText = document.querySelector("#detail");
const toggle = document.querySelector("#toggle");
const backend = document.querySelector("#backend");
const token = document.querySelector("#token");

async function refresh() {
  const stored = await chrome.storage.local.get(["captureState", "backendUrl", "extensionToken"]);
  const state = stored.captureState || { status: "idle" };
  backend.value = stored.backendUrl || DEFAULT_BACKEND;
  token.value = stored.extensionToken || "";
  const recording = ["starting", "recording", "processing"].includes(state.status);
  toggle.textContent = recording ? "Stop and analyze meeting" : "Start MeetingOps";
  toggle.disabled = state.status === "starting" || state.status === "processing";
  statusText.textContent = {
    idle: "Ready to capture this Google Meet.",
    starting: "Starting secure audio capture…",
    recording: "MeetingOps is listening and transcribing.",
    processing: "Finishing transcript and running the agent…",
    completed: "Meeting analyzed. Open the MeetingOps dashboard.",
    failed: "Capture failed.",
  }[state.status] || "Ready.";
  detailText.textContent = state.error || (state.status === "recording" ? "Audio stays compressed in the extension until you stop." : "");
}

toggle.addEventListener("click", async () => {
  try {
    const state = (await chrome.storage.local.get("captureState")).captureState || {};
    const type = ["starting", "recording", "processing"].includes(state.status) ? "stop-capture" : "start-capture";
    toggle.disabled = true;
    let message = { target: "service-worker", type };
    if (type === "start-capture") {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url?.startsWith("https://meet.google.com/")) {
        throw new Error("Open a Google Meet tab before starting MeetingOps.");
      }
      const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
      message = { ...message, streamId, tabId: tab.id, title: tab.title, meetingUrl: tab.url };
    }
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || "MeetingOps could not complete the request.");
  } catch (error) {
    await chrome.storage.local.set({ captureState: { status: "failed", error: error.message } });
    toggle.disabled = false;
  }
  await refresh();
});

document.querySelector("#save").addEventListener("click", async () => {
  await chrome.storage.local.set({ backendUrl: backend.value.replace(/\/$/, ""), extensionToken: token.value });
  detailText.textContent = "Connection settings saved.";
});

chrome.storage.onChanged.addListener(refresh);
refresh();
