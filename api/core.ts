export interface ThemeConfig {
  bg: string;
  border: string;
  text: string;
  subtext: string;
  accent: string;
}

export const themes = {
  light:      { bg: "#ffffff", border: "#d0d7de", text: "#1f2328", subtext: "#656d76", accent: "#0969da" },
  dark:       { bg: "#0d1117", border: "#30363d", text: "#e6edf3", subtext: "#8b949e", accent: "#58a6ff" },
  nord:       { bg: "#2e3440", border: "#434c5e", text: "#eceff4", subtext: "#81a1c1", accent: "#88c0d0" },
  gruvbox:    { bg: "#282828", border: "#504945", text: "#ebdbb2", subtext: "#a89984", accent: "#fabd2f" },
  tokyonight: { bg: "#1a1b26", border: "#292e42", text: "#c0caf5", subtext: "#565f89", accent: "#7aa2f7" },
  onedark:    { bg: "#282c34", border: "#3e4451", text: "#abb2bf", subtext: "#5c6370", accent: "#61afef" },
  spotify:    { bg: "#191414", border: "#282828", text: "#ffffff", subtext: "#b3b3b3", accent: "#1db954" },
  youtube:    { bg: "#0f0f0f", border: "#282828", text: "#ffffff", subtext: "#aaaaaa", accent: "#ff0000" },
  cyberpunk:  { bg: "#0c0813", border: "#ff0055", text: "#ffe600", subtext: "#9d7cd8", accent: "#00f0ff" },
  twitch:     { bg: "#0d0c0f", border: "#9146ff", text: "#f5f5f7", subtext: "#adadb8", accent: "#9146ff" },
} as const;

export const fonts = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export interface StatItem {
  label: string;
  value: string;
}

export interface BaseCardData {
  provider: 'github' | 'stackoverflow' | 'twitch';
  name: string;
  login: string;
  avatarUrl: string;
  stats: StatItem[];
}

export interface GitHubCardData extends BaseCardData {
  provider: 'github';
  memberSince: number;
  languages: Array<{ name: string; color: string }>;
}

export interface StackOverflowCardData extends BaseCardData {
  provider: 'stackoverflow';
  memberSince: number;
  badges: {
    gold: string;
    silver: string;
    bronze: string;
  };
}

export interface TwitchCardData extends BaseCardData {
  provider: 'twitch';
  isLive: boolean;
  game?: string;
  streamTitle?: string;
}

export type CardData = GitHubCardData | StackOverflowCardData | TwitchCardData;

export interface Provider {
  fetch(id: string): Promise<CardData | null>;
}

export class ProviderError extends Error {
  title: string;
  category: 'not_found' | 'unavailable' | 'rate_limited';
  constructor(category: 'not_found' | 'unavailable' | 'rate_limited', title: string, message: string) {
    super(message);
    this.category = category;
    this.title = title;
    this.name = 'ProviderError';
  }
}

// Auxiliar para escapar caracteres XML especiais
export function escapeXml(str: string | null | undefined): string {
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

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return String(num);
}

export function safeHex(val: string | null | undefined): boolean {
  if (!val) return false;
  const hexRegex = /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
  return hexRegex.test(val);
}

export async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchAvatarBase64(url: string, provider: string): Promise<string> {
  if (!url || !url.startsWith('http')) return url;
  try {
    const res = await fetchWithTimeout(url, {}, 5000);
    if (!res.ok) return url;
    const arrayBuffer = await res.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = '';
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);
    
    // Choose default content-type based on provider if not found
    const defaultContentType = provider === 'twitch' ? 'image/png' : 'image/jpeg';
    const contentType = res.headers.get('content-type') || defaultContentType;
    return `data:${contentType};base64,${base64}`;
  } catch {
    return url;
  }
}

// Renderiza o SVG do cartão de erro com quebra de linha para mensagens longas
export function renderErrorCard(title: string, message: string, theme: ThemeConfig): string {
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

export function renderSvg(data: CardData, theme: ThemeConfig): string {
  const cleanAvatarUrl = escapeXml(data.avatarUrl);

  if (data.provider === 'github') {
    const cleanName = escapeXml(data.name);
    const cleanLogin = escapeXml(data.login);
    const memberSince = escapeXml(String(data.memberSince));
    const cleanRepos = escapeXml(data.stats.find(s => s.label === 'Repos')?.value || '0');
    const cleanFollowers = escapeXml(data.stats.find(s => s.label === 'Seguidores')?.value || '0');
    const cleanStars = escapeXml(data.stats.find(s => s.label === 'Estrelas')?.value || '0');
    const cleanStreak = escapeXml(data.stats.find(s => s.label === 'Sequência atual')?.value || '0');
    const cleanContributions = escapeXml(data.stats.find(s => s.label === 'Contribuições no ano')?.value || '0');
    const cleanCommits = escapeXml(data.stats.find(s => s.label === 'Commits')?.value || '0');
    const cleanPrs = escapeXml(data.stats.find(s => s.label === 'PRs')?.value || '0');
    const cleanIssues = escapeXml(data.stats.find(s => s.label === 'Issues')?.value || '0');

    let langsSvg = '';
    (data.languages || []).forEach((lang, i) => {
      const cx = 30 + i * 130;
      const tx = cx + 10;
      const escapedLangName = escapeXml(lang.name);
      langsSvg += `
  <circle cx="${cx}" cy="202" r="4.5" fill="${lang.color}" />
  <text x="${tx}" y="206" font-family="${fonts}" font-size="12" fill="${theme.subtext}">${escapedLangName}</text>`;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="450" height="225" viewBox="0 0 450 225">
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
  }

  if (data.provider === 'stackoverflow') {
    const cleanDisplayName = escapeXml(data.name);
    const cleanId = escapeXml(data.login);
    const memberSinceYear = escapeXml(String(data.memberSince));
    const cleanReputation = escapeXml(data.stats.find(s => s.label === 'Reputação')?.value || '0');
    
    const goldBadges = escapeXml(data.badges.gold);
    const silverBadges = escapeXml(data.badges.silver);
    const bronzeBadges = escapeXml(data.badges.bronze);
    
    const cleanRepChangeYear = escapeXml(data.stats.find(s => s.label === 'Este ano')?.value || '0');
    const cleanRepChangeQuarter = escapeXml(data.stats.find(s => s.label === 'Este trimestre')?.value || '0');
    const cleanRepChangeMonth = escapeXml(data.stats.find(s => s.label === 'Este mês')?.value || '0');

    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="450" height="225" viewBox="0 0 450 225">
  <defs>
    <clipPath id="avatar-clip">
      <circle cx="70" cy="65" r="40" />
    </clipPath>
  </defs>
  <rect width="100%" height="100%" rx="16" fill="${theme.bg}" stroke="${theme.border}" stroke-width="1.5"/>
  
  <circle cx="70" cy="65" r="41" fill="none" stroke="${theme.accent}" stroke-width="2" />
  <image xlink:href="${cleanAvatarUrl}" x="30" y="25" width="80" height="80" clip-path="url(#avatar-clip)" />
  
  <text x="135" y="40" font-family="${fonts}" font-size="20" font-weight="bold" fill="${theme.text}">${cleanDisplayName}</text>
  <text x="135" y="60" font-family="${fonts}" font-size="14" fill="${theme.subtext}">Stack Overflow ID: ${cleanId}</text>
  <text x="135" y="78" font-family="${fonts}" font-size="12" fill="${theme.subtext}">Membro desde ${memberSinceYear}</text>
  
  <text x="135" y="102" font-family="${fonts}" font-size="13" fill="${theme.subtext}">Reputação: <tspan fill="${theme.accent}" font-weight="bold">${cleanReputation}</tspan></text>
  
  <g transform="translate(390, 25) scale(1.2)">
    <path d="M 5 17 L 5 24 L 21 24 L 21 17 L 23 17 L 23 26 L 3 26 L 3 17 Z" fill="${theme.subtext}" />
    <rect x="6" y="20" width="12" height="2.5" fill="#f48225" rx="0.5" />
    <rect x="6" y="16" width="12" height="2.5" fill="#f48225" rx="0.5" transform="rotate(-12, 6, 17)" />
    <rect x="7" y="11" width="12" height="2.5" fill="#f48225" rx="0.5" transform="rotate(-28, 7, 12)" />
    <rect x="9" y="6" width="12" height="2.5" fill="#f48225" rx="0.5" transform="rotate(-45, 9, 7)" />
  </g>

  <line x1="30" y1="118" x2="420" y2="118" stroke="${theme.border}" stroke-width="1" />
  
  <g transform="translate(30, 132)">
    <circle cx="10" cy="10" r="6" fill="#f1a80a" />
    <text x="24" y="14" font-family="${fonts}" font-size="13" font-weight="bold" fill="${theme.text}">${goldBadges}</text>
    <text x="50" y="14" font-family="${fonts}" font-size="13" fill="${theme.subtext}">Ouro</text>
  </g>
  <g transform="translate(170, 132)">
    <circle cx="10" cy="10" r="6" fill="#b4b8bc" />
    <text x="24" y="14" font-family="${fonts}" font-size="13" font-weight="bold" fill="${theme.text}">${silverBadges}</text>
    <text x="50" y="14" font-family="${fonts}" font-size="13" fill="${theme.subtext}">Prata</text>
  </g>
  <g transform="translate(310, 132)">
    <circle cx="10" cy="10" r="6" fill="#d1a684" />
    <text x="24" y="14" font-family="${fonts}" font-size="13" font-weight="bold" fill="${theme.text}">${bronzeBadges}</text>
    <text x="50" y="14" font-family="${fonts}" font-size="13" fill="${theme.subtext}">Bronze</text>
  </g>

  <g transform="translate(30, 172)">
    <text x="0" y="14" font-family="${fonts}" font-size="13" fill="${theme.subtext}">Este ano: <tspan fill="${theme.accent}" font-weight="bold">${cleanRepChangeYear}</tspan></text>
  </g>
  <g transform="translate(170, 172)">
    <text x="0" y="14" font-family="${fonts}" font-size="13" fill="${theme.subtext}">Este trimestre: <tspan fill="${theme.accent}" font-weight="bold">${cleanRepChangeQuarter}</tspan></text>
  </g>
  <g transform="translate(310, 172)">
    <text x="0" y="14" font-family="${fonts}" font-size="13" fill="${theme.subtext}">Este mês: <tspan fill="${theme.accent}" font-weight="bold">${cleanRepChangeMonth}</tspan></text>
  </g>
</svg>`;
  }

  if (data.provider === 'twitch') {
    const cleanDisplayName = escapeXml(data.name);
    const cleanLogin = escapeXml(data.login);
    const cleanFollowers = escapeXml(data.stats.find(s => s.label === 'Seguidores')?.value || '0');

    if (data.isLive) {
      const cleanViewers = escapeXml(data.stats.find(s => s.label === 'Viewers')?.value || '0');
      let truncatedTitle = data.streamTitle || 'Sem título';
      if (truncatedTitle.length > 48) {
        truncatedTitle = truncatedTitle.slice(0, 45) + '...';
      }
      const cleanTitle = escapeXml(truncatedTitle);
      const cleanGame = escapeXml(data.game || 'Sem categoria');

      return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="450" height="225" viewBox="0 0 450 225">
  <defs>
    <clipPath id="avatar-clip">
      <circle cx="70" cy="65" r="40" />
    </clipPath>
  </defs>
  <rect width="100%" height="100%" rx="16" fill="${theme.bg}" stroke="${theme.border}" stroke-width="1.5"/>
  
  <circle cx="70" cy="65" r="41" fill="none" stroke="${theme.accent}" stroke-width="2" />
  <image xlink:href="${cleanAvatarUrl}" x="30" y="25" width="80" height="80" clip-path="url(#avatar-clip)" />
  
  <text x="135" y="45" font-family="${fonts}" font-size="20" font-weight="bold" fill="${theme.text}">${cleanDisplayName}</text>
  <text x="135" y="66" font-family="${fonts}" font-size="14" fill="${theme.subtext}">@${cleanLogin} • ${cleanFollowers} seguidores</text>
  
  <g transform="translate(135, 80)">
    <rect width="76" height="20" rx="4" fill="#e91916" />
    <circle cx="11" cy="10" r="4" fill="#ffffff">
      <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
    </circle>
    <text x="22" y="14" font-family="${fonts}" font-size="11" font-weight="bold" fill="#ffffff">AO VIVO</text>
  </g>
  
  <g transform="translate(223, 80)">
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="${theme.subtext}" transform="scale(0.7) translate(0, 4)"/>
    <text x="20" y="14" font-family="${fonts}" font-size="13" font-weight="500" fill="${theme.text}">${cleanViewers} viewers</text>
  </g>

  <line x1="30" y1="125" x2="420" y2="125" stroke="${theme.border}" stroke-width="1" />

  <text x="30" y="152" font-family="${fonts}" font-size="14" font-weight="bold" fill="${theme.text}">${cleanTitle}</text>
  <text x="30" y="180" font-family="${fonts}" font-size="13" fill="${theme.subtext}">Jogando: <tspan fill="${theme.accent}" font-weight="bold">${cleanGame}</tspan></text>
  <text x="30" y="202" font-family="${fonts}" font-size="11" fill="${theme.subtext}">Assista ao vivo em <tspan fill="${theme.accent}" font-weight="bold">twitch.tv/${cleanLogin}</tspan></text>

  <!-- Twitch logo -->
  <g transform="translate(390, 25) scale(1.1)" fill="#9146ff">
    <path d="M11.571 4.714h1.715v5.143H11.57v-5.143zm4.715 0H18v5.143h-1.714v-5.143zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0H6zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714v9.429z" />
  </g>
</svg>`;
    } else {
      return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="450" height="225" viewBox="0 0 450 225">
  <defs>
    <clipPath id="avatar-clip">
      <circle cx="70" cy="65" r="40" />
    </clipPath>
  </defs>
  <rect width="100%" height="100%" rx="16" fill="${theme.bg}" stroke="${theme.border}" stroke-width="1.5"/>
  
  <circle cx="70" cy="65" r="41" fill="none" stroke="${theme.border}" stroke-width="2" />
  <image xlink:href="${cleanAvatarUrl}" x="30" y="25" width="80" height="80" clip-path="url(#avatar-clip)" opacity="0.6" />
  
  <text x="135" y="45" font-family="${fonts}" font-size="20" font-weight="bold" fill="${theme.text}">${cleanDisplayName}</text>
  <text x="135" y="66" font-family="${fonts}" font-size="14" fill="${theme.subtext}">@${cleanLogin} • ${cleanFollowers} seguidores</text>
  
  <g transform="translate(135, 80)">
    <rect width="76" height="20" rx="4" fill="${theme.border}" />
    <circle cx="11" cy="10" r="3.5" fill="${theme.subtext}" />
    <text x="22" y="14" font-family="${fonts}" font-size="10" font-weight="bold" fill="${theme.subtext}">OFFLINE</text>
  </g>

  <line x1="30" y1="125" x2="420" y2="125" stroke="${theme.border}" stroke-width="1" />

  <text x="30" y="156" font-family="${fonts}" font-size="14" font-weight="500" fill="${theme.subtext}">O canal está offline no momento.</text>
  <text x="30" y="182" font-family="${fonts}" font-size="13" fill="${theme.subtext}">Acompanhe o canal de <tspan fill="${theme.accent}" font-weight="bold">${cleanDisplayName}</tspan> para não perder a próxima stream.</text>
  <text x="30" y="204" font-family="${fonts}" font-size="11" fill="${theme.subtext}">twitch.tv/${cleanLogin}</text>

  <!-- Twitch logo -->
  <g transform="translate(390, 25) scale(1.1)" fill="${theme.subtext}" opacity="0.6">
    <path d="M11.571 4.714h1.715v5.143H11.57v-5.143zm4.715 0H18v5.143h-1.714v-5.143zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0H6zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714v9.429z" />
  </g>
</svg>`;
    }
  }

  return '';
}

// Unified request handler
export async function handleRequest(req: Request, defaultProvider?: string): Promise<Response> {
  const url = new URL(req.url);
  
  // 1. Resolve theme
  const requested = String(url.searchParams.get('theme') ?? "dark").toLowerCase();
  const baseTheme = (requested in themes) ? themes[requested as keyof typeof themes] : themes.dark;
  const theme: ThemeConfig = { ...baseTheme };
  const colorKeys: (keyof ThemeConfig)[] = ['bg', 'border', 'text', 'subtext', 'accent'];

  for (const key of colorKeys) {
    const val = url.searchParams.get(key);
    if (safeHex(val)) {
      theme[key] = `#${val}`;
    }
  }

  // 2. Resolve provider
  const providerParam = url.searchParams.get('provider');
  let providerName = defaultProvider || providerParam || 'github';
  if (providerName !== 'github' && providerName !== 'stackoverflow' && providerName !== 'twitch') {
    providerName = 'github';
  }

  // 3. Configure Cache Headers
  const maxAge = providerName === 'twitch' ? 60 : 1800;
  const staleRevalidate = providerName === 'twitch' ? 600 : 86400;
  const responseHeaders = new Headers({
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${staleRevalidate}`,
  });

  const errorHeaders = new Headers({
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  });

  try {
    // 4. Resolve ID parameter name based on provider
    let idParam = 'username';
    let idLabel = 'Username';
    if (providerName === 'stackoverflow') {
      idParam = 'id';
      idLabel = 'User ID';
    } else if (providerName === 'twitch') {
      idParam = 'channel';
      idLabel = 'Channel';
    }

    const id = url.searchParams.get(idParam);
    if (!id) {
      return new Response(renderErrorCard('Não Encontrado', `Parâmetro ?${idParam}= ausente na URL.`, theme), { status: 400, headers: errorHeaders });
    }

    if (providerName === 'stackoverflow' && !/^\d+$/.test(id)) {
      return new Response(renderErrorCard('Não Encontrado', 'O parâmetro ?id= deve ser um valor numérico.', theme), { status: 400, headers: errorHeaders });
    }

    if (providerName === 'twitch') {
      const twitchClientId = process.env.TWITCH_CLIENT_ID;
      const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET;
      if (!twitchClientId || !twitchClientSecret) {
        return new Response(renderErrorCard('Serviço Indisponível', 'Configuração TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET ausente.', theme), { status: 500, headers: errorHeaders });
      }
    }

    // 5. Dynamic import and instantiate provider
    let provider: Provider;
    if (providerName === 'github') {
      const { GitHubProvider } = await import('./providers/github');
      provider = new GitHubProvider();
    } else if (providerName === 'stackoverflow') {
      const { StackOverflowProvider } = await import('./providers/stackoverflow');
      provider = new StackOverflowProvider();
    } else {
      const { TwitchProvider } = await import('./providers/twitch');
      provider = new TwitchProvider();
    }

    // 6. Fetch and normalize data
    const data = await provider.fetch(id);
    if (!data) {
      return new Response(renderErrorCard('Não Encontrado', 'O provider não retornou dados para o ID solicitado.', theme), { status: 404, headers: errorHeaders });
    }

    // 7. Base64 encode the avatar url
    data.avatarUrl = await fetchAvatarBase64(data.avatarUrl, providerName);

    // 8. Render SVG
    const svg = renderSvg(data, theme);
    return new Response(svg, { headers: responseHeaders });

  } catch (error: any) {
    let category: 'not_found' | 'unavailable' | 'rate_limited' = 'unavailable';
    let message = error?.message || 'Unknown network error.';
    
    if (error instanceof ProviderError) {
      category = error.category;
    } else if (error.name === 'AbortError' || error.name === 'TimeoutError' || error.message?.includes('timeout') || error.message?.includes('abort')) {
      category = 'unavailable';
      message = 'A solicitação para a API externa expirou (timeout).';
    } else {
      category = 'unavailable';
      message = error?.message || 'Erro de rede ou serviço indisponível.';
    }

    const titleMap = {
      not_found: 'Não Encontrado',
      unavailable: 'Serviço Indisponível',
      rate_limited: 'Limite Atingido'
    };

    const title = titleMap[category];
    
    const statusMap = {
      not_found: 404,
      rate_limited: 429,
      unavailable: 503
    };
    const responseStatus = statusMap[category] || 500;

    return new Response(renderErrorCard(title, message, theme), { 
      status: responseStatus,
      headers: errorHeaders 
    });
  }
}
