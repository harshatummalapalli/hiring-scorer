import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let redis: Redis | null = null;
let rlAnalyse: Ratelimit | null = null;
let rlScore: Ratelimit | null = null;

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

export function getAnalyseRatelimiter(): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  if (!rlAnalyse) {
    rlAnalyse = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "rl:analyse",
    });
  }
  return rlAnalyse;
}

export function getScoreRatelimiter(): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  if (!rlScore) {
    rlScore = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      prefix: "rl:score",
    });
  }
  return rlScore;
}

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  if (!limiter) return { allowed: true };
  const { success, reset } = await limiter.limit(identifier);
  if (!success) {
    return { allowed: false, retryAfter: Math.ceil((reset - Date.now()) / 1000) };
  }
  return { allowed: true };
}

export function assertRateLimiterConfigured(): void {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    console.warn(
      "[rate-limit] WARNING: UPSTASH_REDIS_REST_URL or " +
        "UPSTASH_REDIS_REST_TOKEN is not set. " +
        "Rate limiting is DISABLED. All API calls to " +
        "/api/score and /api/analyse-role are unthrottled. " +
        "Set these env vars in Vercel to enable protection.",
    );
  }
}

assertRateLimiterConfigured();
