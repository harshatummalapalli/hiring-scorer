export type RoleBrief = {
  id: string;
  title: string;
  department: string | null;
  responsibilities: string | null;
  required_skills: string | null;
  nice_to_have_skills: string | null;
  experience_years: number | null;
  weight_skills: number;
  weight_trajectory: number;
  weight_domain: number;
  weight_seniority: number;
  weight_tenure: number;
  created_at: string;
};

export type RoleBriefFormValues = {
  title: string;
  department: string;
  responsibilities: string;
  required_skills: string;
  nice_to_have_skills: string;
  experience_years: string;
  weight_skills: number;
  weight_trajectory: number;
  weight_domain: number;
  weight_seniority: number;
  weight_tenure: number;
};

export const defaultFormValues: RoleBriefFormValues = {
  title: "",
  department: "",
  responsibilities: "",
  required_skills: "",
  nice_to_have_skills: "",
  experience_years: "",
  weight_skills: 5,
  weight_trajectory: 5,
  weight_domain: 5,
  weight_seniority: 5,
  weight_tenure: 5,
};

export function roleBriefToFormValues(brief: RoleBrief): RoleBriefFormValues {
  return {
    title: brief.title,
    department: brief.department ?? "",
    responsibilities: brief.responsibilities ?? "",
    required_skills: brief.required_skills ?? "",
    nice_to_have_skills: brief.nice_to_have_skills ?? "",
    experience_years:
      brief.experience_years != null ? String(brief.experience_years) : "",
    weight_skills: brief.weight_skills,
    weight_trajectory: brief.weight_trajectory,
    weight_domain: brief.weight_domain,
    weight_seniority: brief.weight_seniority,
    weight_tenure: brief.weight_tenure,
  };
}

export function formValuesToPayload(values: RoleBriefFormValues) {
  const title = values.title.trim();
  if (!title) {
    throw new Error("Title is required.");
  }

  let experience_years: number | null = null;
  const yearsRaw = values.experience_years.trim();
  if (yearsRaw) {
    const parsed = Number.parseInt(yearsRaw, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      throw new Error("Years of experience must be a whole number of 0 or greater.");
    }
    experience_years = parsed;
  }

  const clampWeight = (n: number) => Math.max(1, Math.min(10, Math.round(n)));

  return {
    title,
    department: values.department.trim() || null,
    responsibilities: values.responsibilities.trim() || null,
    required_skills: values.required_skills.trim() || null,
    nice_to_have_skills: values.nice_to_have_skills.trim() || null,
    experience_years,
    weight_skills: clampWeight(values.weight_skills),
    weight_trajectory: clampWeight(values.weight_trajectory),
    weight_domain: clampWeight(values.weight_domain),
    weight_seniority: clampWeight(values.weight_seniority),
    weight_tenure: clampWeight(values.weight_tenure),
  };
}
