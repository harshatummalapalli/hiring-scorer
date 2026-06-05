import type { AiProvider } from "@/types/score";

export function normalizeAnthropicKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.startsWith("ysk-ant-")) {
    return trimmed.replace(/^ysk-ant-/, "sk-ant-");
  }
  return trimmed;
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

/** True when a non-placeholder Google key is present (does not call the API). */
export function isGoogleApiKeyConfigured(): boolean {
  try {
    const key = getApiKey("google");
    return key.startsWith("AIza") && key.length >= 35;
  } catch {
    return false;
  }
}

export function isGoogleApiKeyAuthError(message: string): boolean {
  return (
    message.includes("API_KEY_INVALID") ||
    message.includes("API key not valid") ||
    message.includes("API key not found") ||
    message.includes("API key expired") ||
    message.includes("GOOGLE_VERTEX_CREDENTIALS") ||
    message.includes("Vertex AI authentication")
  );
}

/** True when Vertex service account JSON is present and parseable. */
export function isVertexCredentialsConfigured(): boolean {
  try {
    getVertexCredentials();
    return true;
  } catch {
    return false;
  }
}

export function getVertexCredentials(): {
  client_email: string;
  private_key: string;
  project_id: string;
} {
  const raw = process.env.GOOGLE_VERTEX_CREDENTIALS?.trim();
  if (!raw) {
    throw new Error(
      "GOOGLE_VERTEX_CREDENTIALS is not set. " +
        "Add the service account JSON to environment variables.",
    );
  }
  try {
    const parsed = JSON.parse(raw) as {
      client_email?: string;
      private_key?: string;
      project_id?: string;
    };
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("Missing client_email or private_key");
    }
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
      project_id: parsed.project_id ?? "karta2026",
    };
  } catch {
    throw new Error("GOOGLE_VERTEX_CREDENTIALS is not valid JSON.");
  }
}

export function getApiKey(provider: AiProvider): string {
  switch (provider) {
    case "anthropic": {
      const raw = process.env.ANTHROPIC_API_KEY?.trim() ?? "";
      if (!raw || raw.includes("your_anthropic")) {
        throw new Error(
          "ANTHROPIC_API_KEY is missing in .env.local. Get one at console.anthropic.com",
        );
      }
      return normalizeAnthropicKey(raw);
    }
    case "openai": {
      const key = process.env.OPENAI_API_KEY?.trim() ?? "";
      if (!key || key.includes("your_openai")) {
        throw new Error(
          "OPENAI_API_KEY is missing in .env.local. Get one at platform.openai.com",
        );
      }
      return key;
    }
    case "google": {
      const raw =
        process.env.GOOGLE_API_KEY?.trim() ??
        process.env.GEMINI_API_KEY?.trim() ??
        process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ??
        "";
      const key = raw.replace(/^["']|["']$/g, "");
      if (!key || key.includes("your_google")) {
        throw new Error(
          "GOOGLE_API_KEY is missing. Set it in .env.local locally, or in Vercel → Project Settings → Environment Variables (name: GOOGLE_API_KEY). Create a key at https://aistudio.google.com/apikey",
        );
      }
      if (!key.startsWith("AIza") || key.length < 35) {
        throw new Error(
          "GOOGLE_API_KEY looks incomplete (should start with AIza and be ~39 characters). Copy the full key from Google AI Studio with no quotes.",
        );
      }
      return key;
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export function formatProviderAuthError(
  provider: AiProvider,
  rawMessage: string,
): string {
  if (
    rawMessage.includes("API_KEY_INVALID") ||
    rawMessage.includes("API key not found") ||
    rawMessage.includes("API key expired") ||
    rawMessage.includes("API Key not found")
  ) {
    if (provider === "google") {
      return (
        "Google Vertex AI authentication failed. " +
        "Check GOOGLE_VERTEX_CREDENTIALS in your " +
        "environment variables. The value should be the " +
        "full JSON contents of a service account key file."
      );
    }
  }

  if (
    rawMessage.includes("429") ||
    rawMessage.includes("quota") ||
    rawMessage.includes("Too Many Requests") ||
    rawMessage.includes("RESOURCE_EXHAUSTED")
  ) {
    if (provider === "google") {
      return (
        "Resume parsing quota exceeded. Check your " +
        "GCP billing account has active credits."
      );
    }
    if (provider === "openai") {
      return "Scoring service is busy. Wait a moment and try again.";
    }
    return "Analysis service is busy. Wait a moment and try again.";
  }

  if (
    rawMessage.includes("invalid x-api-key") ||
    rawMessage.includes("authentication") ||
    rawMessage.includes("401")
  ) {
    return "A required service credential is not configured. Contact your administrator.";
  }

  if (rawMessage.length > 400) {
    return `${rawMessage.slice(0, 400)}…`;
  }
  return rawMessage;
}
