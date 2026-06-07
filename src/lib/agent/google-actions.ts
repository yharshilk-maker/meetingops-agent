import { Meeting } from "@/lib/meeting-engine";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

async function googleRequest<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`Google API returned ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

function meetingBrief(meeting: Meeting) {
  const lines = [
    `# ${meeting.title}`, "", meeting.summary, "", "## Decisions",
    ...meeting.decisions.map((item) => `- ${item.text}\n  Evidence: "${item.evidence}" — ${item.speaker}`),
    "", "## Action Items",
    ...meeting.tasks.map((task) => `- [${task.status === "done" ? "x" : " "}] ${task.text} — ${task.owner}, due ${task.dueDate}`),
    "", "## Risks",
    ...meeting.risks.map((item) => `- ${item.text}\n  Evidence: "${item.evidence}" — ${item.speaker}`),
  ];
  return lines.join("\n");
}

async function createFolder(name: string, parentId: string | undefined, accessToken: string) {
  return googleRequest<{ id: string }>(`${DRIVE_API}/files?fields=id`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", ...(parentId ? { parents: [parentId] } : {}) }),
  });
}

export async function saveMeetingBriefToDrive(meeting: Meeting, accessToken: string) {
  const root = await createFolder("MeetingOps", process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || undefined, accessToken);
  const folder = await createFolder(`${meeting.date} - ${meeting.title}`, root.id, accessToken);
  const metadata = JSON.stringify({ name: "meeting-brief.md", mimeType: "text/markdown", parents: [folder.id] });
  const boundary = "meetingops_boundary";
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: text/markdown\r\n\r\n${meetingBrief(meeting)}\r\n--${boundary}--`;
  const file = await googleRequest<{ id: string; webViewLink?: string }>(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,webViewLink`, accessToken, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return { folderId: folder.id, fileId: file.id, webViewLink: file.webViewLink };
}

export async function createGmailFollowUpDraft(meeting: Meeting, accessToken: string) {
  const recipients = meeting.participants.filter((participant) => participant.includes("@")).join(", ");
  const actions = meeting.tasks.map((task) => `- ${task.text} — ${task.owner}, due ${task.dueDate}`).join("\n");
  const decisions = meeting.decisions.map((item) => `- ${item.text}`).join("\n");
  const message = [`To: ${recipients}`, `Subject: Recap: ${meeting.title}`, "Content-Type: text/plain; charset=UTF-8", "", meeting.summary, "", "Decisions:", decisions, "", "Action items:", actions].join("\r\n");
  const raw = Buffer.from(message).toString("base64url");
  const draft = await googleRequest<{ id: string; message: { id: string } }>(`${GMAIL_API}/drafts`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw } }),
  });
  return { ...draft, webUrl: "https://mail.google.com/mail/u/0/#drafts" };
}
