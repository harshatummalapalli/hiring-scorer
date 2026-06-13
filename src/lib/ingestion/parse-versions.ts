import { GEMINI_PARSE_MODEL } from "@/lib/gemini-client";

export const PARSE_VERSIONS = {
  PARSER: GEMINI_PARSE_MODEL,
  PROMPT: "v1",
  SCHEMA: "v1",
} as const;

// To invalidate cache for all resumes when prompt or schema changes,
// increment PROMPT or SCHEMA version here.
// Parser version tracks the active Gemini model name.
//
// Example: after improving the Gemini prompt, change PROMPT to 'v2'.
// All existing cache entries become misses. New parses rebuild cache
// with the new prompt. Old entries expire naturally.
