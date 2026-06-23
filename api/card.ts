import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ThemeConfig {
  bg: string;
  border: string;
  name: string;
  login: string;
  label: string;
  reposValue: string;
  followersValue: string;
  avatarBorder: string;
  errorBg: string;
  errorBorder: string;
  errorIcon: string;
  errorText: string;
}

const themes: Record<string, ThemeConfig> = {
  dark: {
    bg: '#1a1b26',
    border: '#414868',
    name: '#c0caf5',
    login: '#bb9af3',
    label: '#a9b1d6',
    reposValue: '#73daca',
    followersValue: '#ff9e64',
    avatarBorder: '#7aa2f7',
    errorBg: '#1a1b26',
    errorBorder: '#f7768e',
    errorIcon: '#f7768e',
    errorText: '#a9b1d6',
  },
  light: {
    bg: '#f6f8fa',
    border: '#d0d7de',
    name: '#24292f',
    login: '#57606a',
    label: '#57606a',
    reposValue: '#0969da',
    followersValue: '#bc4c00',
    avatarBorder: '#0969da',
    errorBg: '#fff5f5',
    errorBorder: '#cf222e',
    errorIcon: '#cf222e',
    errorText: '#57606a',
  },
};

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
    ? `<text x="120" y="93" font-family="${fonts}" font-size="14" fill="${theme.errorText}">${cleanLine1}</text>
  <text x="120" y="115" font-family="${fonts}" font-size="14" fill="${theme.errorText}">${cleanLine2}</text>`
    : `<text x="120" y="100" font-family="${fonts}" font-size="14" fill="${theme.errorText}">${cleanLine1}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="450" height="160" viewBox="0 0 450 160">
  <rect width="100%" height="100%" rx="16" fill="${theme.errorBg}" stroke="${theme.errorBorder}" stroke-width="1.5"/>
  <g transform="translate(30, 45)">
    <circle cx="35" cy="35" r="30" fill="${theme.errorIcon}" opacity="0.1" />
    <circle cx="35" cy="35" r="25" fill="none" stroke="${theme.errorIcon}" stroke-width="3" />
    <path d="M 35 23 L 35 43 M 35 48 L 35 50" stroke="${theme.errorIcon}" stroke-width="4" stroke-linecap="round" />
  </g>
  <text x="120" y="70" font-family="${fonts}" font-size="20" font-weight="bold" fill="${theme.errorBorder}">${cleanTitle}</text>
  ${textElement}
</svg>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=86400');

  const themeParam = req.query.theme;
  const themeName = (themeParam === 'light') ? 'light' : 'dark';
  const theme = themes[themeName];

  const username = req.query.username;

  if (!username || typeof username !== 'string') {
    return res.status(200).send(renderErrorCard('Missing Username', 'Provide a ?username= parameter in the URL.', theme));
  }

  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    'User-Agent': 'Vercel-GitHub-Card',
    'Accept': 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`https://api.github.com/users/${username}`, { headers });

    if (response.status === 404) {
      return res.status(200).send(renderErrorCard('User Not Found', `GitHub user "${username}" does not exist.`, theme));
    }

    if (!response.ok) {
      const errText = await response.text();
      return res.status(200).send(renderErrorCard('GitHub API Error', `Status ${response.status}: ${errText.slice(0, 50)}...`, theme));
    }

    const data = await response.json() as {
      name: string | null;
      login: string;
      avatar_url: string;
      public_repos: number;
      followers: number;
    };

    const cleanName = escapeXml(data.name || data.login);
    const cleanLogin = escapeXml(data.login);
    const avatarUrl = data.avatar_url.includes('?') ? `${data.avatar_url}&s=120` : `${data.avatar_url}?s=120`;
    const avatarBase64 = await fetchAvatarBase64(avatarUrl);
    const cleanAvatarUrl = escapeXml(avatarBase64);
    const cleanRepos = escapeXml(String(data.public_repos));
    const cleanFollowers = escapeXml(String(data.followers));

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="450" height="160" viewBox="0 0 450 160">
  <defs>
    <clipPath id="avatar-clip">
      <circle cx="70" cy="80" r="45" />
    </clipPath>
  </defs>
  <rect width="100%" height="100%" rx="16" fill="${theme.bg}" stroke="${theme.border}" stroke-width="1.5"/>
  
  <circle cx="70" cy="80" r="46" fill="none" stroke="${theme.avatarBorder}" stroke-width="2" />
  <image xlink:href="${cleanAvatarUrl}" x="25" y="35" width="90" height="90" clip-path="url(#avatar-clip)" />
  
  <text x="135" y="60" font-family="${fonts}" font-size="22" font-weight="bold" fill="${theme.name}">${cleanName}</text>
  <text x="135" y="85" font-family="${fonts}" font-size="16" fill="${theme.login}">@${cleanLogin}</text>
  
  <text x="135" y="120" font-family="${fonts}" font-size="14" fill="${theme.label}">Repos: <tspan fill="${theme.reposValue}" font-weight="bold">${cleanRepos}</tspan></text>
  <text x="250" y="120" font-family="${fonts}" font-size="14" fill="${theme.label}">Followers: <tspan fill="${theme.followersValue}" font-weight="bold">${cleanFollowers}</tspan></text>
</svg>`;

    return res.status(200).send(svg);

  } catch (error: any) {
    return res.status(200).send(renderErrorCard('Exception Occurred', error?.message || 'Unknown network error.', theme));
  }
}
