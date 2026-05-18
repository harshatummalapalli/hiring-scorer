/** Canonical resume schema from local parsing service. */

export type ConfidenceField = {
  value: string;
  confidence: number;
  extraction_method?: string;
  source_section?: string | null;
};

export type DocumentClassification = {
  document_type: string;
  layout_complexity: string;
  needs_ocr: boolean;
  parser_strategy: string;
  extraction_quality_estimate: number;
};

export type StructuredResumeExperience = {
  company?: ConfidenceField | null;
  title?: ConfidenceField | null;
  start_date?: string | null;
  end_date?: string | null;
  duration_months?: number | null;
  bullets: string[];
  technologies: string[];
  confidence: number;
  evidence: string[];
};

export type StructuredResumeSkill = {
  skill: string;
  normalized_skill?: string | null;
  demonstrated: boolean;
  listed_only: boolean;
  evidence?: string | null;
  source_company?: string | null;
  source_section: string;
  confidence: number;
};

export type StructuredResume = {
  basics: {
    full_name?: ConfidenceField | null;
    email?: ConfidenceField | null;
    phone?: ConfidenceField | null;
    linkedin?: ConfidenceField | null;
    github?: ConfidenceField | null;
    location?: ConfidenceField | null;
    summary?: ConfidenceField | null;
  };
  experience: StructuredResumeExperience[];
  education: Array<{
    institution: string;
    degree?: string | null;
    field?: string | null;
    year?: string | null;
    confidence: number;
  }>;
  skills: StructuredResumeSkill[];
  projects: Array<{
    name: string;
    description?: string | null;
    technologies: string[];
    confidence: number;
  }>;
  certifications: Array<{
    name: string;
    issuer?: string | null;
    year?: string | null;
    confidence: number;
  }>;
  timeline: {
    total_experience_months: number;
    total_experience_years: number;
    average_tenure_months: number;
    career_gaps_months: number[];
    growth_velocity: string;
    career_stability: string;
    current_role_title?: string | null;
    current_role_company?: string | null;
  };
  metadata: {
    parser_used: string;
    parse_confidence: number;
    document_type: string;
    classification?: DocumentClassification | null;
    extraction_warnings: string[];
    created_at?: string;
    raw_text_length: number;
    pii_stripped_text_length: number;
  };
  raw_text: string;
  pii_stripped_text: string;
};

export type ParseRunResult = {
  success: boolean;
  structured_resume?: StructuredResume | null;
  error?: string | null;
  warnings: string[];
  duration_ms: number;
};
