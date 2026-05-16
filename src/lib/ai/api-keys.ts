import type { AiProvider } from "@/types/score";

export function normalizeAnthropicKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.startsWith("ysk-ant-")) {
    return trimmed.replace(/^ysk-ant-/, "sk-ant-");
  }
  return trimmed;
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
        "Google rejected GOOGLE_API_KEY as invalid. Create a new key at https://aistudio.google.com/apikey " +
        "(use Create API key, not an old Cloud key). Paste into .env.local as GOOGLE_API_KEY=AIza... with no quotes, then restart npm run dev."
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
        "Gemini API quota exceeded. Enable billing at https://aistudio.google.com/apikey " +
        "or set GEMINI_MODEL=gemini-2.0-flash-lite in .env.local, then restart npm run dev."
      );
    }
    return `${provider} rate limit or quota exceeded. Wait a minute and retry, or check your API plan.`;
  }

  if (
    rawMessage.includes("invalid x-api-key") ||
    rawMessage.includes("authentication") ||
    rawMessage.includes("401")
  ) {
    const hints: Record<AiProvider, string> = {
      anthropic:
        "Check ANTHROPIC_API_KEY in .env.local (should start with sk-ant-). Restart npm run dev after saving.",
      openai:
        "Check OPENAI_API_KEY in .env.local (should start with sk-). Restart npm run dev after saving.",
      google:
        "Check GOOGLE_API_KEY in .env.local. Restart npm run dev after saving.",
    };
    return `Invalid API key for ${provider}. ${hints[provider]}`;
  }

  if (rawMessage.length > 400) {
    return `${rawMessage.slice(0, 400)}…`;
  }
  return rawMessage;
}
