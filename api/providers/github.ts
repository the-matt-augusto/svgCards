import { Provider, CardData, ProviderError, formatNumber, fetchWithTimeout } from '../core';

export class GitHubProvider implements Provider {
  async fetch(id: string): Promise<CardData | null> {
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      'User-Agent': 'Vercel-GitHub-Card',
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const query = `
      query($login: String!) {
        user(login: $login) {
          name
          login
          avatarUrl(size: 120)
          createdAt
          followers { totalCount }
          repositories(first: 100, ownerAffiliations: OWNER,
                       orderBy: {field: STARGAZERS, direction: DESC}) {
            totalCount
            nodes {
              stargazerCount
              primaryLanguage { name color }
            }
          }
          contributionsCollection {
            totalCommitContributions
            totalPullRequestContributions
            totalIssueContributions
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
      }`;

    let response: Response;
    try {
      response = await fetchWithTimeout("https://api.github.com/graphql", {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables: { login: id } }),
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new ProviderError('unavailable', 'Serviço Indisponível', 'A solicitação ao GitHub expirou (timeout).');
      }
      throw new ProviderError('unavailable', 'Serviço Indisponível', `Erro de rede ao acessar o GitHub: ${err.message}`);
    }

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 429) {
        throw new ProviderError('rate_limited', 'Limite Atingido', 'Limite de requisições à API do GitHub atingido.');
      }
      if (response.status >= 500) {
        throw new ProviderError('unavailable', 'Serviço Indisponível', `GitHub indisponível (Status ${response.status}).`);
      }
      throw new ProviderError('unavailable', 'Serviço Indisponível', `Erro na API do GitHub (Status ${response.status}): ${errText.slice(0, 50)}...`);
    }

    const json = await response.json() as any;

    validateGitHubResponse(json, id);

    const user = json.data.user;

    // Calcular total de estrelas e top linguagens
    const totalStars = user.repositories.nodes.reduce((s: number, r: any) => s + r.stargazerCount, 0);

    const langMap: Record<string, { count: number, color: string }> = {};
    for (const repo of user.repositories.nodes) {
      if (repo.primaryLanguage) {
        const { name, color } = repo.primaryLanguage;
        if (!langMap[name]) {
          langMap[name] = { count: 0, color: color || '#8b949e' };
        }
        langMap[name].count += 1;
      }
    }

    const sortedLangs = Object.entries(langMap)
      .map(([name, info]) => ({ name, ...info }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Calcular ano de criação e informações de contribuição
    const memberSince = new Date(user.createdAt).getUTCFullYear();
    const contributions = user.contributionsCollection || {};
    const commits = contributions.totalCommitContributions || 0;
    const prs = contributions.totalPullRequestContributions || 0;
    const issues = contributions.totalIssueContributions || 0;
    const totalContributions = contributions.contributionCalendar?.totalContributions || 0;

    // Calcular a sequência atual (streak) percorrendo os dias de trás pra frente
    const weeks = contributions.contributionCalendar?.weeks || [];
    const days = weeks.flatMap((w: any) => w?.contributionDays || []);

    const streak = calculateStreak(days);

    return {
      provider: 'github',
      name: user.name || user.login,
      login: user.login,
      avatarUrl: user.avatarUrl,
      memberSince,
      languages: sortedLangs,
      stats: [
        { label: 'Repos', value: formatNumber(user.repositories.totalCount) },
        { label: 'Seguidores', value: formatNumber(user.followers.totalCount) },
        { label: 'Estrelas', value: formatNumber(totalStars) },
        { label: 'Sequência atual', value: formatNumber(streak) },
        { label: 'Contribuições no ano', value: formatNumber(totalContributions) },
        { label: 'Commits', value: formatNumber(commits) },
        { label: 'PRs', value: formatNumber(prs) },
        { label: 'Issues', value: formatNumber(issues) },
      ],
    };
  }
}

export function validateGitHubResponse(json: any, id: string): void {
  if (!json || json.errors || !json.data?.user) {
    if (!json || !json.data?.user) {
      throw new ProviderError('not_found', 'User Not Found', `GitHub user "${id}" does not exist.`);
    }
    const errMsg = json.errors[0]?.message || 'GraphQL Error';
    if (errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('secondary rate')) {
      throw new ProviderError('rate_limited', 'GitHub API Error', errMsg);
    }
    throw new ProviderError('unavailable', 'GitHub API Error', errMsg);
  }
}

export function calculateStreak(days: Array<{ contributionCount: number }>): number {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const count = days[i]?.contributionCount || 0;
    if (count > 0) {
      streak++;
    } else {
      // Se hoje estiver zerado, não quebra a sequência; conta a partir de ontem
      if (i === days.length - 1 && streak === 0) {
        continue;
      } else {
        break;
      }
    }
  }
  return streak;
}

