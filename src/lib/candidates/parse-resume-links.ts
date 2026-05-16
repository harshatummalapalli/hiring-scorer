const URL_IN_TEXT =
  /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in\/[\w%-]+|github\.com\/[\w%-]+|gitlab\.com\/[\w%-/]+|bitbucket\.org\/[\w%-]+|[\w-]+\.(?:dev|io|me|com|net|org)\/[\w#./?-]*)/gi;

const BARE_LINKEDIN = /(?:^|\s)linkedin\.com\/in\/([\w%-]+)/gi;

function normalizeUrl(raw: string): string {
  let u = raw.trim().replace(/[.,;)\]]+$/, "");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

function isLinkedIn(url: string): boolean {
  return /linkedin\.com\/in\//i.test(url);
}

function isPortfolioUrl(url: string): boolean {
  if (isLinkedIn(url)) return false;
  return /github\.com|gitlab\.com|bitbucket|behance\.net|dribbble\.com|medium\.com|codepen\.io|stackoverflow\.com\/users|\.(?:dev|io|me)\b/i.test(
    url,
  );
}

export type ResumeLinks = {
  linkedin_url: string | null;
  portfolio_links: string[];
};

export function extractResumeLinks(resumeText: string): ResumeLinks {
  const seen = new Set<string>();
  let linkedin_url: string | null = null;
  const portfolio_links: string[] = [];

  const addPortfolio = (url: string) => {
    const key = url.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    portfolio_links.push(url);
  };

  for (const match of resumeText.matchAll(URL_IN_TEXT)) {
    const url = normalizeUrl(match[0]);
    if (isLinkedIn(url)) {
      if (!linkedin_url) linkedin_url = url;
    } else if (isPortfolioUrl(url)) {
      addPortfolio(url);
    }
  }

  for (const match of resumeText.matchAll(BARE_LINKEDIN)) {
    const slug = match[1];
    const url = `https://www.linkedin.com/in/${slug}`;
    if (!linkedin_url) linkedin_url = url;
  }

  const linkedinLabel = resumeText.match(
    /linkedin\s*:\s*([\w./%-]+)/i,
  );
  if (linkedinLabel?.[1] && !linkedin_url) {
    const path = linkedinLabel[1].trim();
    linkedin_url = path.startsWith("http")
      ? normalizeUrl(path)
      : `https://www.linkedin.com/in/${path.replace(/^\/+/, "")}`;
  }

  return {
    linkedin_url,
    portfolio_links: portfolio_links.slice(0, 8),
  };
}
