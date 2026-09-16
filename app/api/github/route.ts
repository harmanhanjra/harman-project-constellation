import { NextResponse } from "next/server";

const GITHUB_REPOS_URL =
  "https://api.github.com/users/harmanhanjra/repos?sort=updated&per_page=12";

const REQUEST_TIMEOUT_MS = 5_000;

interface GitHubRepo {
  name?: unknown;
  html_url?: unknown;
  description?: unknown;
  language?: unknown;
  stargazers_count?: unknown;
  fork?: unknown;
}

interface PublicRepo {
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
}

function isSafeGitHubRepo(repo: GitHubRepo): repo is GitHubRepo & {
  name: string;
  html_url: string;
} {
  return (
    typeof repo.name === "string" &&
    typeof repo.html_url === "string" &&
    repo.html_url.startsWith("https://github.com/harmanhanjra/") &&
    repo.fork !== true
  );
}

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GITHUB_REPOS_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "harman-project-constellation",
      },
      signal: controller.signal,
      next: { revalidate: 900 },
    });

    if (!response.ok) {
      throw new Error(`GitHub responded with ${response.status}`);
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) {
      throw new Error("Unexpected GitHub response shape");
    }

    const repos: PublicRepo[] = payload
      .filter((repo): repo is GitHubRepo => typeof repo === "object" && repo !== null)
      .filter(isSafeGitHubRepo)
      .slice(0, 6)
      .map((repo) => ({
        name: repo.name,
        html_url: repo.html_url,
        description: typeof repo.description === "string" ? repo.description : null,
        language: typeof repo.language === "string" ? repo.language : null,
        stargazers_count:
          typeof repo.stargazers_count === "number" ? repo.stargazers_count : 0,
      }));

    return NextResponse.json(repos, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
      },
    });
  } catch {
    return NextResponse.json([], {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}
