export const config = { runtime: 'edge' };

interface ThemeConfig {
  bg: string;
  border: string;
  text: string;
  subtext: string;
  accent: string;
}

const themes = {
  light:      { bg: "#ffffff", border: "#d0d7de", text: "#1f2328", subtext: "#656d76", accent: "#0969da" },
  dark:       { bg: "#0d1117", border: "#30363d", text: "#e6edf3", subtext: "#8b949e", accent: "#58a6ff" },
  nord:       { bg: "#2e3440", border: "#434c5e", text: "#eceff4", subtext: "#81a1c1", accent: "#88c0d0" },
  gruvbox:    { bg: "#282828", border: "#504945", text: "#ebdbb2", subtext: "#a89984", accent: "#fabd2f" },
  tokyonight: { bg: "#1a1b26", border: "#292e42", text: "#c0caf5", subtext: "#565f89", accent: "#7aa2f7" },
  onedark:    { bg: "#282c34", border: "#3e4451", text: "#abb2bf", subtext: "#5c6370", accent: "#61afef" },
  spotify:    { bg: "#191414", border: "#282828", text: "#ffffff", subtext: "#b3b3b3", accent: "#1db954" },
  youtube:    { bg: "#0f0f0f", border: "#282828", text: "#ffffff", subtext: "#aaaaaa", accent: "#ff0000" },
  cyberpunk:  { bg: "#0c0813", border: "#ff0055", text: "#ffe600", subtext: "#9d7cd8", accent: "#00f0ff" },
} as const;

const fonts = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

// Auxiliar para escapar caracteres XML especiais
function escapeXml(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return String(num);
}

async function fetchAvatarBase64(url: string): Promise<string> {
  if (!url || !url.startsWith('http')) return url;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s limit
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) return url;
    const arrayBuffer = await res.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = '';
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${base64}`;
  } catch {
    return url;
  }
}

// Renderiza o SVG do cartão de erro com quebra de linha para mensagens longas
function renderErrorCard(title: string, message: string, theme: ThemeConfig): string {
  const cleanTitle = escapeXml(title);
  
  // Divide a mensagem em duas linhas se for muito longa (ex: > 38 caracteres)
  let line1 = message;
  let line2 = '';
  if (message.length > 38) {
    const spaceIndex = message.lastIndexOf(' ', 38);
    const splitIndex = spaceIndex > 20 ? spaceIndex : 38;
    line1 = message.slice(0, splitIndex);
    line2 = message.slice(splitIndex).trim();
    // Trunca a linha 2 se ainda for muito longa
    if (line2.length > 38) {
      line2 = line2.slice(0, 35) + '...';
    }
  }

  const cleanLine1 = escapeXml(line1);
  const cleanLine2 = escapeXml(line2);

  const textElement = line2
    ? `<text x="120" y="88" font-family="${fonts}" font-size="14" fill="${theme.subtext}">${cleanLine1}</text>
  <text x="120" y="110" font-family="${fonts}" font-size="14" fill="${theme.subtext}">${cleanLine2}</text>`
    : `<text x="120" y="95" font-family="${fonts}" font-size="14" fill="${theme.subtext}">${cleanLine1}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="450" height="150" viewBox="0 0 450 150">
  <rect width="100%" height="100%" rx="16" fill="${theme.bg}" stroke="${theme.border}" stroke-width="1.5"/>
  <g transform="translate(30, 40)">
    <circle cx="35" cy="35" r="30" fill="${theme.accent}" opacity="0.1" />
    <circle cx="35" cy="35" r="25" fill="none" stroke="${theme.accent}" stroke-width="3" />
    <path d="M 35 23 L 35 43 M 35 48 L 35 50" stroke="${theme.accent}" stroke-width="4" stroke-linecap="round" />
  </g>
  <text x="120" y="65" font-family="${fonts}" font-size="20" font-weight="bold" fill="${theme.accent}">${cleanTitle}</text>
  ${textElement}
</svg>`;
}

export default async function handler(req: Request): Promise<Response> {
  const responseHeaders = new Headers({
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=86400',
  });

  const url = new URL(req.url);
  const requested = String(url.searchParams.get('theme') ?? "dark").toLowerCase();
  const baseTheme = (requested in themes) ? themes[requested as keyof typeof themes] : themes.dark;

  const theme: ThemeConfig = { ...baseTheme };
  const hexRegex = /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
  const colorKeys: (keyof ThemeConfig)[] = ['bg', 'border', 'text', 'subtext', 'accent'];

  for (const key of colorKeys) {
    const val = url.searchParams.get(key);
    if (val && hexRegex.test(val)) {
      theme[key] = `#${val}`;
    }
  }

  const username = url.searchParams.get('username');

  if (!username) {
    return new Response(renderErrorCard('Missing Username', 'Provide a ?username= parameter in the URL.', theme), { headers: responseHeaders });
  }

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

  try {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables: { login: username } }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(renderErrorCard('GitHub API Error', `Status ${response.status}: ${errText.slice(0, 50)}...`, theme), { headers: responseHeaders });
    }

    const json = await response.json() as any;

    if (json.errors || !json.data?.user) {
      if (!json.data?.user) {
        return new Response(renderErrorCard('User Not Found', `GitHub user "${username}" does not exist.`, theme), { headers: responseHeaders });
      }
      const errMsg = json.errors[0]?.message || 'GraphQL Error';
      return new Response(renderErrorCard('GitHub API Error', errMsg, theme), { headers: responseHeaders });
    }

    const user = json.data.user;

    const cleanName = escapeXml(user.name || user.login);
    const cleanLogin = escapeXml(user.login);
    const avatarBase64 = await fetchAvatarBase64(user.avatarUrl);
    const cleanAvatarUrl = escapeXml(avatarBase64);
    const cleanRepos = escapeXml(formatNumber(user.repositories.totalCount));
    const cleanFollowers = escapeXml(formatNumber(user.followers.totalCount));

    // Calcular total de estrelas e top linguagens
    const totalStars = user.repositories.nodes.reduce((s: number, r: any) => s + r.stargazerCount, 0);
    const cleanStars = escapeXml(formatNumber(totalStars));

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

    const cleanStreak = escapeXml(formatNumber(streak));
    const cleanContributions = escapeXml(formatNumber(totalContributions));
    const cleanCommits = escapeXml(formatNumber(commits));
    const cleanPrs = escapeXml(formatNumber(prs));
    const cleanIssues = escapeXml(formatNumber(issues));

    let langsSvg = '';
    sortedLangs.forEach((lang, i) => {
      const cx = 30 + i * 130;
      const tx = cx + 10;
      const escapedLangName = escapeXml(lang.name);
      langsSvg += `
  <circle cx="${cx}" cy="202" r="4.5" fill="${lang.color}" />
  <text x="${tx}" y="206" font-family="${fonts}" font-size="12" fill="${theme.subtext}">${escapedLangName}</text>`;
    });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="450" height="225" viewBox="0 0 450 225">
  <defs>
    <clipPath id="avatar-clip">
      <circle cx="70" cy="65" r="40" />
    </clipPath>
  </defs>
  <rect width="100%" height="100%" rx="16" fill="${theme.bg}" stroke="${theme.border}" stroke-width="1.5"/>
  
  <circle cx="70" cy="65" r="41" fill="none" stroke="${theme.accent}" stroke-width="2" />
  <image xlink:href="${cleanAvatarUrl}" x="30" y="25" width="80" height="80" clip-path="url(#avatar-clip)" />
  
  <text x="135" y="40" font-family="${fonts}" font-size="20" font-weight="bold" fill="${theme.text}">${cleanName}</text>
  <text x="135" y="60" font-family="${fonts}" font-size="14" fill="${theme.subtext}">@${cleanLogin}</text>
  <text x="135" y="78" font-family="${fonts}" font-size="12" fill="${theme.subtext}">Membro desde ${memberSince}</text>
  
  <g transform="translate(390, 25) scale(1.2)">
    <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" fill="${theme.subtext}" />
  </g>
  
  <text x="135" y="102" font-family="${fonts}" font-size="13" fill="${theme.subtext}">Repos: <tspan fill="${theme.accent}" font-weight="bold">${cleanRepos}</tspan></text>
  <text x="210" y="102" font-family="${fonts}" font-size="13" fill="${theme.subtext}">Seguidores: <tspan fill="${theme.accent}" font-weight="bold">${cleanFollowers}</tspan></text>
  <text x="330" y="102" font-family="${fonts}" font-size="13" fill="${theme.subtext}">Estrelas: <tspan fill="${theme.accent}" font-weight="bold">${cleanStars}</tspan></text>
  
  <line x1="30" y1="118" x2="420" y2="118" stroke="${theme.border}" stroke-width="1" />
  
  <text x="30" y="146" font-family="${fonts}" font-size="13" fill="${theme.subtext}">Sequência atual: <tspan fill="${theme.accent}" font-weight="bold">${cleanStreak}</tspan> 🔥</text>
  <text x="240" y="146" font-family="${fonts}" font-size="13" fill="${theme.subtext}">Contribuições no ano: <tspan fill="${theme.accent}" font-weight="bold">${cleanContributions}</tspan></text>
  
  <text x="30" y="173" font-family="${fonts}" font-size="13" fill="${theme.subtext}">Commits: <tspan fill="${theme.accent}" font-weight="bold">${cleanCommits}</tspan>  •  PRs: <tspan fill="${theme.accent}" font-weight="bold">${cleanPrs}</tspan>  •  Issues: <tspan fill="${theme.accent}" font-weight="bold">${cleanIssues}</tspan></text>
  
  ${langsSvg}
</svg>`;

    return new Response(svg, { headers: responseHeaders });

  } catch (error: any) {
    return new Response(renderErrorCard('Exception Occurred', error?.message || 'Unknown network error.', theme), { headers: responseHeaders });
  }
}
