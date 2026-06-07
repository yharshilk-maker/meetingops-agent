import { getCaptureConfig, updateCaptureConfig } from "@/lib/agent/capture-orchestrator";

export async function GET() {
  return Response.json(await getCaptureConfig());
}

export async function POST(request: Request) {
  const body = await request.json() as { mode?: "official" | "bot" | "hybrid"; botName?: string };
  if (body.mode && !["official", "bot", "hybrid"].includes(body.mode)) {
    return Response.json({ error: "Unsupported capture mode." }, { status: 400 });
  }
  return Response.json(await updateCaptureConfig(body));
}
