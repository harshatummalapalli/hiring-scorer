import { GoogleGenAI } from "@google/genai";
import { getVertexCredentials } from "@/lib/ai/api-keys";

export const GEMINI_PARSE_MODEL = "gemini-2.5-flash";

let cachedClient: GoogleGenAI | null = null;
let cachedLane: "vertex" | "aistudio" | null = null;

function useGeminiStudio(): boolean {
  return process.env.USE_GEMINI_STUDIO === "true";
}

export function geminiParseLane(): "vertex" | "aistudio" {
  return useGeminiStudio() ? "aistudio" : "vertex";
}

/** True when the active parse lane (Vertex or AI Studio) is configured. */
export function isGeminiParsingConfigured(): boolean {
  if (useGeminiStudio()) {
    const key = resolveStudioApiKeyOptional();
    return Boolean(key);
  }
  try {
    getVertexCredentials();
    return true;
  } catch {
    return false;
  }
}

function resolveStudioApiKeyOptional(): string | null {
  const key =
    process.env.GEMINI_API_KEY?.trim() ??
    process.env.GOOGLE_API_KEY?.trim() ??
    "";
  if (!key || key.includes("your_")) return null;
  return key;
}

function resolveStudioApiKey(): string {
  const key = resolveStudioApiKeyOptional();
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. Get one at https://aistudio.google.com/apikey",
    );
  }
  return key;
}

function buildGeminiClient(): GoogleGenAI {
  if (useGeminiStudio()) {
    return new GoogleGenAI({
      apiKey: resolveStudioApiKey(),
    });
  }

  const credentialsJson = process.env.GOOGLE_VERTEX_CREDENTIALS?.trim();
  if (!credentialsJson) {
    throw new Error(
      "GOOGLE_VERTEX_CREDENTIALS is not set. " +
        "Add the service account JSON to Vercel env vars.",
    );
  }

  let credentials: {
    client_email: string;
    private_key: string;
    project_id?: string;
  };
  try {
    credentials = JSON.parse(credentialsJson) as {
      client_email: string;
      private_key: string;
      project_id?: string;
    };
  } catch {
    throw new Error(
      "GOOGLE_VERTEX_CREDENTIALS is not valid JSON. " +
        "Paste the full service account key file contents.",
    );
  }

  const project =
    process.env.GOOGLE_VERTEX_PROJECT_ID?.trim() ??
    process.env.GOOGLE_VERTEX_PROJECT?.trim() ??
    credentials.project_id ??
    "karta2026";
  const location = process.env.GOOGLE_VERTEX_LOCATION?.trim() ?? "us-central1";

  return new GoogleGenAI({
    vertexai: true,
    project,
    location,
    googleAuthOptions: {
      credentials,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    },
  });
}

export function getGeminiClient(): GoogleGenAI {
  const lane = geminiParseLane();
  if (cachedClient && cachedLane === lane) {
    return cachedClient;
  }
  cachedClient = buildGeminiClient();
  cachedLane = lane;
  return cachedClient;
}

export function getGeminiModel() {
  return getGeminiClient().models;
}
