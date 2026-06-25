import type { VercelRequest, VercelResponse } from '@vercel/node';

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
  dracula:    { bg: "#282a36", border: "#44475a", text: "#f8f8f2", subtext: "#6272a4", accent: "#bd93f9" },
  nord:       { bg: "#2e3440", border: "#434c5e", text: "#eceff4", subtext: "#81a1c1", accent: "#88c0d0" },
  gruvbox:    { bg: "#282828", border: "#504945", text: "#ebdbb2", subtext: "#a89984", accent: "#fabd2f" },
  catppuccin: { bg: "#1e1e2e", border: "#313244", text: "#cdd6f4", subtext: "#a6adc8", accent: "#cba6f7" },
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

async function fetchAvatarBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=86400');

  const requested = String(req.query.theme ?? "dark").toLowerCase();
  const theme = (requested in themes) ? themes[requested as keyof typeof themes] : themes.dark;

  const username = req.query.username;

  if (!username || typeof username !== 'string') {
    return res.status(200).send(renderErrorCard('Missing Username', 'Provide a ?username= parameter in the URL.', theme));
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
        followers { totalCount }
        repositories(first: 100, ownerAffiliations: OWNER,
                     orderBy: {field: STARGAZERS, direction: DESC}) {
          totalCount
          nodes {
            stargazerCount
            primaryLanguage { name color }
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
      return res.status(200).send(renderErrorCard('GitHub API Error', `Status ${response.status}: ${errText.slice(0, 50)}...`, theme));
    }

    const json = await response.json() as any;

    if (json.errors || !json.data?.user) {
      if (!json.data?.user) {
        return res.status(200).send(renderErrorCard('User Not Found', `GitHub user "${username}" does not exist.`, theme));
      }
      const errMsg = json.errors[0]?.message || 'GraphQL Error';
      return res.status(200).send(renderErrorCard('GitHub API Error', errMsg, theme));
    }

    const user = json.data.user;

    const cleanName = escapeXml(user.name || user.login);
    const cleanLogin = escapeXml(user.login);
    const avatarBase64 = await fetchAvatarBase64(user.avatarUrl);
    const cleanAvatarUrl = escapeXml(avatarBase64);
    const cleanRepos = escapeXml(String(user.repositories.totalCount));
    const cleanFollowers = escapeXml(String(user.followers.totalCount));

    // Calcular total de estrelas e top linguagens
    const totalStars = user.repositories.nodes.reduce((s: number, r: any) => s + r.stargazerCount, 0);
    const cleanStars = escapeXml(String(totalStars));

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

    let langsSvg = '';
    sortedLangs.forEach((lang, i) => {
      const cx = 135 + i * 100;
      const tx = cx + 10;
      const escapedLangName = escapeXml(lang.name);
      langsSvg += `
  <circle cx="${cx}" cy="122" r="4.5" fill="${lang.color}" />
  <text x="${tx}" y="126" font-family="${fonts}" font-size="12" fill="${theme.subtext}">${escapedLangName}</text>`;
    });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="450" height="150" viewBox="0 0 450 150">
  <defs>
    <clipPath id="avatar-clip">
      <circle cx="70" cy="75" r="40" />
    </clipPath>
  </defs>
  <rect width="100%" height="100%" rx="16" fill="${theme.bg}" stroke="${theme.border}" stroke-width="1.5"/>
  
  <circle cx="70" cy="75" r="41" fill="none" stroke="${theme.accent}" stroke-width="2" />
  <image xlink:href="${cleanAvatarUrl}" x="30" y="35" width="80" height="80" clip-path="url(#avatar-clip)" />
  
  <text x="135" y="46" font-family="${fonts}" font-size="22" font-weight="bold" fill="${theme.text}">${cleanName}</text>
  <text x="135" y="68" font-family="${fonts}" font-size="15" fill="${theme.subtext}">@${cleanLogin}</text>
  
  <text x="135" y="98" font-family="${fonts}" font-size="13" fill="${theme.subtext}">Repos: <tspan fill="${theme.accent}" font-weight="bold">${cleanRepos}</tspan></text>
  <text x="230" y="98" font-family="${fonts}" font-size="13" fill="${theme.subtext}">Followers: <tspan fill="${theme.accent}" font-weight="bold">${cleanFollowers}</tspan></text>
  <text x="340" y="98" font-family="${fonts}" font-size="13" fill="${theme.subtext}">Stars: <tspan fill="${theme.accent}" font-weight="bold">${cleanStars}</tspan></text>
  
  ${langsSvg}
</svg>`;

    return res.status(200).send(svg);

  } catch (error: any) {
    return res.status(200).send(renderErrorCard('Exception Occurred', error?.message || 'Unknown network error.', theme));
  }
}
