import { getAgentRuns } from "@/lib/agent/runtime";

export async function GET() {
  return Response.json({
    runs: getAgentRuns(),
    integrations: {
      googleMeet: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_PUBSUB_TOPIC),
      googleActions: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      webhookSecurity: Boolean(process.env.GOOGLE_WEBHOOK_SECRET),
      reasoning: process.env.GROQ_API_KEY ? "groq" : process.env.OPENAI_API_KEY ? "openai" : "fallback",
    },
  });
}
