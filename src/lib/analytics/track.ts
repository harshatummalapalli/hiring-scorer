import { createSupabaseServerClient } from "@/lib/supabase/server-auth";

export type AnalyticsEventType =
  | "job_created"
  | "job_paused"
  | "job_archived"
  | "candidate_uploaded"
  | "candidate_scored"
  | "candidate_shortlisted"
  | "candidate_rejected"
  | "interview_brief_generated"
  | "shortlist_exported"
  | "page_viewed"
  | "search_performed"
  | "signup_completed"
  | "onboarding_completed";

export async function trackEvent(
  eventType: AnalyticsEventType,
  eventData: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from("analytics_events").insert({
      user_id: user.id,
      event_type: eventType,
      event_data: eventData,
    });
  } catch (err) {
    console.warn("[analytics] Failed to track event:", eventType, err);
  }
}
