/**
 * HTTP upload test against running dev server (localhost:3000).
 * Creates an authenticated session via Supabase admin magic link.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "crypto";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const SAMPLE_RESUME = `
Alex UploadTest
Staff Engineer | alex.uploadtest@example.com | +1-555-0200
Austin, TX

SUMMARY
Platform engineer with 10 years in Go, Kubernetes, and cloud infrastructure.

EXPERIENCE
CloudScale Inc — Staff Engineer (2019 – Present)
- Built multi-tenant control plane on GKE serving 200+ enterprise customers
- Reduced infra cost 35% via autoscaling and spot instance orchestration

DataPipe — Senior Engineer (2014 – 2019)
- Designed streaming ETL pipelines with Kafka and Flink

SKILLS
Go, Python, Kubernetes, Terraform, GCP, PostgreSQL, Redis, gRPC

EDUCATION
M.S. Computer Science, Tech Institute, 2014
`.trim();

async function getSessionCookie(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  const client = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  const { data: usersData, error: usersErr } =
    await admin.auth.admin.listUsers({ perPage: 5 });
  if (usersErr || !usersData.users.length) {
    console.error("No auth users found:", usersErr?.message);
    return null;
  }

  const email = usersData.users[0].email;
  if (!email) {
    console.error("First user has no email");
    return null;
  }

  const { data: linkData, error: linkErr } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
  if (linkErr || !linkData.properties?.hashed_token) {
    console.error("generateLink failed:", linkErr?.message);
    return null;
  }

  const { data: otpData, error: otpErr } = await client.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties.hashed_token,
  });
  if (otpErr || !otpData.session) {
    console.error("verifyOtp failed:", otpErr?.message);
    return null;
  }

  const cookieJar: { name: string; value: string }[] = [];
  const ssr = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieJar,
      setAll: (toSet) => {
        for (const { name, value } of toSet) {
          const idx = cookieJar.findIndex((c) => c.name === name);
          if (idx >= 0) cookieJar[idx].value = value;
          else cookieJar.push({ name, value });
        }
      },
    },
  });

  await ssr.auth.setSession({
    access_token: otpData.session.access_token,
    refresh_token: otpData.session.refresh_token,
  });

  return cookieJar.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function uploadResume(
  cookie: string,
  forceUpload: boolean,
): Promise<{ status: number; body: unknown }> {
  const tag = randomUUID().slice(0, 8);
  const res = await fetch("http://localhost:3000/api/candidates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      resumeText: SAMPLE_RESUME,
      resumeFilename: `upload-test-${tag}.txt`,
      displayName: `Upload Cache Test ${tag}`,
      forceUpload,
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  console.log("=== HTTP upload E2E test (localhost:3000) ===");

  const cookie = await getSessionCookie();
  if (!cookie) {
    process.exit(1);
  }
  console.log("Authenticated session created");

  console.log("\n--- Upload 1 (expect parse-cache MISS in dev server logs) ---");
  const up1 = await uploadResume(cookie, false);
  console.log(`Response: ${up1.status}`, up1.body);

  if (up1.status !== 200) {
    console.error("Upload 1 failed");
    process.exit(1);
  }

  console.log("Waiting 45s for async triggerParsing to complete...");
  await new Promise((r) => setTimeout(r, 45_000));

  console.log("\n--- Upload 2 same resume with forceUpload (expect cache HIT) ---");
  const up2 = await uploadResume(cookie, true);
  console.log(`Response: ${up2.status}`, up2.body);

  if (up2.status !== 200) {
    console.error("Upload 2 failed");
    process.exit(1);
  }

  console.log(
    "\nCheck dev server terminal for [parse-cache] MISS/HIT and [gemini-parse] logs.",
  );
  console.log("Upload 2 should show HIT if parse_cache table exists and upload 1 cached.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
