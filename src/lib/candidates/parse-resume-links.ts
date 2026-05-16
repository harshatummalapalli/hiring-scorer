const URL_IN_TEXT =
  /(?:https?:\/\/)(?:www\.)?(?:linkedin\.com\/in\/[\w%-]+|github\.com\/[\w%-]+|gitlab\.com\/[\w%-/]+|bitbucket\.org\/[\w%-]+)/gi;

const BARE_LINKEDIN_HTTPS =
  /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([\w%-]{2,})/gi;

const BARE_GITHUB_HTTPS =
  /(?:https?:\/\/)?(?:www\.)?github\.com\/([\w%-]{2,})/gi;

const LINKEDIN_LABEL = /linkedin\s*:\s*([\w./%-]+)/i;

export type ResumeLinks = {
  linkedin_url: string | null;
  portfolio_links: string[];
};

export function isValidLinkedInUrl(url: string | null | undefined): boolean {
  const u = url?.trim();
  if (!u) return false;
  const normalized = u.startsWith("http") ? u : `https://${u}`;
  return /linkedin\.com\/in\/[\w%-]{2,}/i.test(normalized);
}

export function isValidGithubUrl(url: string | null | undefined): boolean {
  const u = url?.trim();
  if (!u) return false;
  const normalized = u.startsWith("http") ? u : `https://${u}`;
  return /github\.com\/[\w%-]{2,}/i.test(normalized);
}

function toLinkedInUrl(raw: string): string | null {
  const path = raw.trim().replace(/[.,;)\]]+$/, "");
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) {
    return isValidLinkedInUrl(path) ? path : null;
  }
  if (/^linkedin\.com\/in\//i.test(path)) {
    const url = `https://www.${path.replace(/^\/+/, "")}`;
    return isValidLinkedInUrl(url) ? url : null;
  }
  if (/^www\.linkedin\.com\/in\//i.test(path)) {
    const url = `https://${path}`;
    return isValidLinkedInUrl(url) ? url : null;
  }
  const slug = path.replace(/^\/+/, "");
  if (/^[\w%-]{2,}$/i.test(slug) && !slug.includes("/")) {
    const url = `https://www.linkedin.com/in/${slug}`;
    return isValidLinkedInUrl(url) ? url : null;
  }
  return null;
}

function toGithubUrl(raw: string): string | null {
  const path = raw.trim().replace(/[.,;)\]]+$/, "");
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) {
    return isValidGithubUrl(path) ? path : null;
  }
  if (/^github\.com\//i.test(path)) {
    const url = `https://${path.replace(/^\/+/, "")}`;
    return isValidGithubUrl(url) ? url : null;
  }
  return null;
}

export function extractResumeLinks(resumeText: string): ResumeLinks {
  let linkedin_url: string | null = null;
  const portfolio_links: string[] = [];
  const seenGithub = new Set<string>();

  for (const match of resumeText.matchAll(URL_IN_TEXT)) {
    const raw = match[0];
    if (/linkedin\.com\/in\//i.test(raw) && !linkedin_url) {
      linkedin_url = toLinkedInUrl(raw);
    } else if (/github\.com\//i.test(raw)) {
      const url = toGithubUrl(raw);
      if (url && !seenGithub.has(url.toLowerCase())) {
        seenGithub.add(url.toLowerCase());
        portfolio_links.push(url);
      }
    }
  }

  for (const match of resumeText.matchAll(BARE_LINKEDIN_HTTPS)) {
    if (linkedin_url) break;
    const url = toLinkedInUrl(match[0]);
    if (url) linkedin_url = url;
  }

  for (const match of resumeText.matchAll(BARE_GITHUB_HTTPS)) {
    const url = toGithubUrl(match[0]);
    if (url && !seenGithub.has(url.toLowerCase())) {
      seenGithub.add(url.toLowerCase());
      portfolio_links.push(url);
    }
  }

  const labelMatch = resumeText.match(LINKEDIN_LABEL);
  if (labelMatch?.[1] && !linkedin_url) {
    linkedin_url = toLinkedInUrl(labelMatch[1]);
  }

  return {
    linkedin_url,
    portfolio_links: portfolio_links.slice(0, 8),
  };
}

export function getValidProfileLinks(profile: {
  linkedin_url: string | null;
  portfolio_links: string[];
}): { linkedin: string | null; github: string | null; other: string[] } {
  const linkedin = isValidLinkedInUrl(profile.linkedin_url)
    ? profile.linkedin_url!.trim().startsWith("http")
      ? profile.linkedin_url!.trim()
      : `https://${profile.linkedin_url!.trim()}`
    : null;

  let github: string | null = null;
  const other: string[] = [];
  for (const url of profile.portfolio_links ?? []) {
    if (isValidGithubUrl(url) && !github) {
      github = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
    }
  }

  return { linkedin, github, other };
}
