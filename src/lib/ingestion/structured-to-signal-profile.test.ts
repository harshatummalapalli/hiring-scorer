import { describe, expect, it } from "vitest";
import { structuredResumeToSignalProfile } from "./structured-to-signal-profile";
import type { StructuredResume } from "@/types/structured-resume";

const SAMPLE: StructuredResume = {
  basics: {
    full_name: { value: "Jane Doe", confidence: 0.9, extraction_method: "regex" },
    email: { value: "jane@example.com", confidence: 0.95, extraction_method: "regex" },
  },
  experience: [
    {
      company: { value: "Acme Corp", confidence: 0.9, extraction_method: "regex" },
      title: { value: "Senior Backend Engineer", confidence: 0.9, extraction_method: "regex" },
      start_date: "2020-01",
      end_date: "present",
      bullets: ["Built EKS deployment infrastructure using Kubernetes"],
      technologies: [],
      confidence: 0.88,
      evidence: [],
    },
  ],
  education: [],
  skills: [
    {
      skill: "Kubernetes",
      normalized_skill: "Kubernetes",
      demonstrated: true,
      listed_only: false,
      evidence: "Built EKS deployment infrastructure",
      source_section: "experience",
      confidence: 0.9,
    },
    {
      skill: "GraphQL",
      normalized_skill: "GraphQL",
      demonstrated: false,
      listed_only: true,
      evidence: null,
      source_section: "skills",
      confidence: 0.7,
    },
  ],
  projects: [],
  certifications: [],
  timeline: {
    total_experience_months: 72,
    total_experience_years: 6,
    average_tenure_months: 72,
    career_gaps_months: [],
    growth_velocity: "normal",
    career_stability: "stable",
    current_role_title: "Senior Backend Engineer",
    current_role_company: "Acme Corp",
  },
  metadata: {
    parser_used: "test",
    parse_confidence: 0.85,
    document_type: "txt",
    extraction_warnings: [],
    raw_text_length: 100,
    pii_stripped_text_length: 100,
  },
  raw_text: "Jane Doe\nSenior Backend Engineer at Acme\nKubernetes",
  pii_stripped_text: "Jane Doe\nSenior Backend Engineer at Acme\nKubernetes",
};

describe("structuredResumeToSignalProfile", () => {
  it("maps basics and demonstrated skills", () => {
    const profile = structuredResumeToSignalProfile(SAMPLE, "resume.txt");
    expect(profile.display_name).toBe("Jane Doe");
    expect(profile.experience.length).toBe(1);
    expect(profile.skills_verified.some((s) => s.skill === "Kubernetes")).toBe(true);
    expect(profile.skills_listed_only).toContain("GraphQL");
    expect(profile.total_years_experience).toMatch(/6/);
  });
});
