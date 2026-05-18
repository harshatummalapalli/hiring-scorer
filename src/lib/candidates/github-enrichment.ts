export type GithubProfileData = {
  username: string;
  public_repos: number;
  top_languages: string[];
  most_starred_repo: { name: string; stars: number } | null;
  is_active: boolean;
  last_active_date: string | null;
};

const GITHUB_USER_RE =
  /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38}[a-zA-Z0-9])?)/i;

export function extractGithubUsername(resumeText: string): string | null {
  const match = resumeText.match(GITHUB_USER_RE);
  const user = match?.[1]?.trim();
  if (!user || ["settings", "orgs", "marketplace", "features"].includes(user.toLowerCase())) {
    return null;
  }
  return user;
}

function githubHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN?.trim();
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Karta-Hiring-Scorer",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function enrichGithubProfile(
  username: string,
): Promise<GithubProfileData | null> {
  try {
    const headers = githubHeaders();
    const userRes = await fetch(`https://api.github.com/users/${username}`, {
      headers,
      next: { revalidate: 0 },
    });
    if (!userRes.ok) return null;
    const userJson = (await userRes.json()) as {
      public_repos?: number;
    };

    const reposRes = await fetch(
      `https://api.github.com/users/${username}/repos?sort=pushed&per_page=10`,
      { headers, next: { revalidate: 0 } },
    );
    if (!reposRes.ok) {
      return {
        username,
        public_repos: Number(userJson.public_repos ?? 0),
        top_languages: [],
        most_starred_repo: null,
        is_active: false,
        last_active_date: null,
      };
    }

    const repos = (await reposRes.json()) as Array<{
      name?: string;
      stargazers_count?: number;
      language?: string | null;
      pushed_at?: string;
    }>;

    const langCounts = new Map<string, number>();
    let mostStarred: { name: string; stars: number } | null = null;
    let lastPush: Date | null = null;

    for (const repo of repos) {
      const lang = repo.language?.trim();
      if (lang) {
        langCounts.set(lang, (langCounts.get(lang) ?? 0) + 1);
      }
      const stars = Number(repo.stargazers_count ?? 0);
      const name = repo.name ?? "";
      if (name && (!mostStarred || stars > mostStarred.stars)) {
        mostStarred = { name, stars };
      }
      if (repo.pushed_at) {
        const d = new Date(repo.pushed_at);
        if (!lastPush || d > lastPush) lastPush = d;
      }
    }

    const top_languages = [...langCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang]) => lang);

    const now = Date.now();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    const is_active = lastPush
      ? now - lastPush.getTime() < ninetyDays
      : false;

    return {
      username,
      public_repos: Number(userJson.public_repos ?? 0),
      top_languages,
      most_starred_repo: mostStarred,
      is_active,
      last_active_date: lastPush?.toISOString() ?? null,
    };
  } catch {
    return null;
  }
}
