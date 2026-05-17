/**
 * Admin / cost-dashboard environment variables (server-only).
 *
 * Required for super-admin cost tracking:
 * - OPENAI_ADMIN_KEY — OpenAI **admin** API key with usage read permissions
 *   (create at https://platform.openai.com/settings/organization/admin-keys)
 * - ANTHROPIC_ADMIN_KEY — same Anthropic API key used for JD analysis / prompts
 *   (reserved for future Anthropic billing APIs; cost from Claude scoring uses saved_scores)
 */

export const REQUIRED_ADMIN_ENV_KEYS = [
  "OPENAI_ADMIN_KEY",
  "ANTHROPIC_ADMIN_KEY",
] as const;

function isPlaceholder(value: string): boolean {
  const v = value.toLowerCase();
  return (
    !value.trim() ||
    v.includes("your_") ||
    v.includes("_here") ||
    v === "undefined"
  );
}

export function getOpenAiAdminKey(): string {
  const key = process.env.OPENAI_ADMIN_KEY?.trim() ?? "";
  if (isPlaceholder(key)) {
    throw new Error(
      "OPENAI_ADMIN_KEY is missing. Create an admin key at platform.openai.com → Settings → Admin keys.",
    );
  }
  return key;
}

export function getAnthropicAdminKey(): string {
  const key =
    process.env.ANTHROPIC_ADMIN_KEY?.trim() ??
    process.env.ANTHROPIC_API_KEY?.trim() ??
    "";
  if (isPlaceholder(key)) {
    throw new Error(
      "ANTHROPIC_ADMIN_KEY is missing. Set it to your Anthropic API key (same as ANTHROPIC_API_KEY).",
    );
  }
  return key.replace(/^ysk-ant-/, "sk-ant-");
}

export function getMissingAdminEnvKeys(): string[] {
  return REQUIRED_ADMIN_ENV_KEYS.filter((name) => {
    try {
      if (name === "OPENAI_ADMIN_KEY") getOpenAiAdminKey();
      else getAnthropicAdminKey();
      return false;
    } catch {
      return true;
    }
  });
}
