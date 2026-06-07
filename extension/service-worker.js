const DEFAULT_BACKEND = "https://meetingops-production.up.railway.app";

async function getSettings() {
  const stored = await chrome.storage.local.get(["backendUrl", "extensionToken"]);
  return {
    backendUrl: (stored.backendUrl || DEFAULT_BACKEND).replace(/\/$/, ""),
    extensionToken: stored.extensionToken || "",
  };
}

async function setCaptureState(patch) {
  const current = (await chrome.storage.local.get("captureState")).captureState || {};
  await chrome.storage.local.set({ captureState: { ...current, ...patch } });
}

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL("offscreen.html");
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl],
  });
  if (contexts.length) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Record audio from a user-approved Google Meet tab for transcription.",
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === "service-worker" && message.type === "start-capture") {
    (async () => {
      if (!message.tabId || !message.meetingUrl?.startsWith("https://meet.google.com/") || !message.streamId) {
        throw new Error("Open a Google Meet tab before starting MeetingOps.");
      }
      const settings = await getSettings();
      await ensureOffscreenDocument();
      await setCaptureState({ status: "starting", tabId: message.tabId, title: message.title, meetingUrl: message.meetingUrl, error: null });
      const response = await chrome.runtime.sendMessage({
        target: "offscreen",
        type: "start-recording",
        streamId: message.streamId,
        title: message.title || "Google Meet conversation",
        meetingUrl: message.meetingUrl,
        ...settings,
      });
      if (!response?.ok) throw new Error(response?.error || "Could not start recording.");
      sendResponse({ ok: true });
    })().catch(async (error) => {
      await setCaptureState({ status: "failed", error: error.message });
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }

  if (message.target === "service-worker" && message.type === "stop-capture") {
    chrome.runtime.sendMessage({ target: "offscreen", type: "stop-recording" })
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.target === "service-worker" && message.type === "capture-state") {
    setCaptureState(message.state);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = (await chrome.storage.local.get("captureState")).captureState;
  if (state?.tabId === tabId && state.status === "recording") {
    chrome.runtime.sendMessage({ target: "offscreen", type: "stop-recording" }).catch(() => {});
  }
});
