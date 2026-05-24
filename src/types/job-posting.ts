import type { CompanySize } from "@/lib/workspace/workspace-profiles";
import { parseTitleBands, type TitleBand } from "@/types/role-brief";

export const SENIORITY_LEVELS = [
  "Entry",
  "Mid",
  "Senior",
  "Staff",
  "Principal",
  "Director",
  "VP",
  "C-Suite",
] as const;

export type SeniorityLevel = (typeof SENIORITY_LEVELS)[number];

export type JobPostingFields = {
  jobTitle: string;
  jobLocation: string;
  titleBands: TitleBand[];
  seniorityOverride: SeniorityLevel;
  clientCompanyName?: string;
  clientCompanyBrief?: string;
  clientCompanySize?: CompanySize;
  clientCompanyWebsite?: string;
};

export type JdRecruiterContext = {
  job_title?: string | null;
  job_location?: string | null;
  seniority_override?: string | null;
  department?: string | null;
  client_company_name?: string | null;
  client_company_size?: string | null;
  client_company_brief?: string | null;
  client_company_website?: string | null;
};

export function jobPostingToJdContext(
  fields: Partial<JobPostingFields>,
): JdRecruiterContext {
  const bandLabel =
    fields.titleBands && fields.titleBands.length > 0
      ? fields.titleBands.join(" / ")
      : fields.seniorityOverride?.trim() || null;
  return {
    job_title: fields.jobTitle?.trim() || null,
    job_location: fields.jobLocation?.trim() || null,
    seniority_override: bandLabel,
    client_company_name: fields.clientCompanyName?.trim() || null,
    client_company_size: fields.clientCompanySize ?? null,
    client_company_brief: fields.clientCompanyBrief?.trim() || null,
    client_company_website: fields.clientCompanyWebsite?.trim() || null,
  };
}

export function jobPostingToBriefColumns(
  fields: JobPostingFields,
): Record<string, unknown> {
  const primaryBand = fields.titleBands[0] ?? fields.seniorityOverride;
  return {
    title: fields.jobTitle.trim(),
    job_location: fields.jobLocation.trim(),
    seniority_override: primaryBand,
    title_bands: fields.titleBands,
    title_band: primaryBand,
    client_company_name: fields.clientCompanyName?.trim() || null,
    client_company_brief: fields.clientCompanyBrief?.trim() || null,
    client_company_size: fields.clientCompanySize ?? null,
    client_company_website: fields.clientCompanyWebsite?.trim() || null,
  };
}

export function briefRowToJobPosting(
  row: Record<string, unknown>,
  fallbackTitle = "",
): JobPostingFields {
  const seniority = String(row.seniority_override ?? "Mid").trim();
  const level = (SENIORITY_LEVELS as readonly string[]).includes(seniority)
    ? (seniority as SeniorityLevel)
    : "Mid";

  const sizeRaw = row.client_company_size;
  const validSizes = [
    "1-10",
    "11-50",
    "51-200",
    "201-500",
    "501-1000",
    "1001-5000",
    "5000+",
  ] as const satisfies readonly CompanySize[];
  const companySize = validSizes.includes(sizeRaw as CompanySize)
    ? (sizeRaw as CompanySize)
    : undefined;

  const titleBands = parseTitleBands(row.title_bands, row.title_band);
  const primaryBand = titleBands[0];
  const seniorityFromBands =
    primaryBand &&
    (SENIORITY_LEVELS as readonly string[]).includes(primaryBand)
      ? (primaryBand as SeniorityLevel)
      : level;

  return {
    jobTitle: String(row.title ?? fallbackTitle).trim(),
    jobLocation: String(row.job_location ?? "").trim(),
    titleBands,
    seniorityOverride: seniorityFromBands,
    clientCompanyName:
      row.client_company_name != null
        ? String(row.client_company_name)
        : undefined,
    clientCompanyBrief:
      row.client_company_brief != null
        ? String(row.client_company_brief)
        : undefined,
    clientCompanySize: companySize,
    clientCompanyWebsite:
      row.client_company_website != null
        ? String(row.client_company_website)
        : undefined,
  };
}
