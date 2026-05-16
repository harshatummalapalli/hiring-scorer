import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getApiKey } from "@/lib/ai/api-keys";

export const runtime = "nodejs";

export async function GET() {
  try {
    const modelId =
      process.env.OPENAI_PROFILE_MODEL?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      "gpt-4o-mini";
    const client = new OpenAI({ apiKey: getApiKey("openai") });
    const completion = await client.chat.completions.create({
      model: modelId,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: 'Reply with JSON only: {"ok":true}',
        },
      ],
    });
    const text = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({
      ok: true,
      model: modelId,
      vercelEnv: process.env.VERCEL_ENV ?? "local",
      responsePreview: text.slice(0, 120),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false,
        vercelEnv: process.env.VERCEL_ENV ?? "local",
        error: message,
        hint:
          "Set OPENAI_API_KEY for Production in Vercel, then redeploy (not just save env vars).",
      },
      { status: 503 },
    );
  }
}
