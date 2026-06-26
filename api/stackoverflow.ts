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

function formatRepChange(change: number): string {
  if (change >= 0) {
    return `+${formatNumber(change)}`;
  }
  return formatNumber(change);
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

// Renderiza o SVG do cartão de erro
function renderErrorCard(title: string, message: string, theme: ThemeConfig): string {
  const cleanTitle = escapeXml(title);
  
  let line1 = message;
  let line2 = '';
  if (message.length > 38) {
    const spaceIndex = message.lastIndexOf(' ', 38);
    const splitIndex = spaceIndex > 20 ? spaceIndex : 38;
    line1 = message.slice(0, splitIndex);
    line2 = message.slice(splitIndex).trim();
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

  const id = url.searchParams.get('id');

  if (!id) {
    return new Response(renderErrorCard('Missing User ID', 'Provide a ?id= parameter in the URL.', theme), { headers: responseHeaders });
  }

  if (!/^\d+$/.test(id)) {
    return new Response(renderErrorCard('Invalid User ID', 'The ?id= parameter must be a numeric value.', theme), { headers: responseHeaders });
  }

  const stackappsKey = process.env.STACKAPPS_KEY;
  let apiUrl = `https://api.stackexchange.com/2.3/users/${id}?site=stackoverflow`;
  if (stackappsKey) {
    apiUrl += `&key=${stackappsKey}`;
  }

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Vercel-StackOverflow-Card',
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(renderErrorCard('Stack Exchange API Error', `Status ${response.status}: ${errText.slice(0, 50)}...`, theme), { headers: responseHeaders });
    }

    const json = await response.json() as any;

    if (!json.items || json.items.length === 0) {
      return new Response(renderErrorCard('User Not Found', `Stack Overflow user ID "${id}" does not exist.`, theme), { headers: responseHeaders });
    }

    const user = json.items[0];
    const displayName = user.display_name;
    const reputation = user.reputation || 0;
    const badgeCounts = user.badge_counts || { gold: 0, silver: 0, bronze: 0 };
    const creationDate = user.creation_date; // Epoch timestamp seconds
    const profileImage = user.profile_image;

    const repChangeYear = user.reputation_change_year || 0;
    const repChangeQuarter = user.reputation_change_quarter || 0;
    const repChangeMonth = user.reputation_change_month || 0;

    const cleanDisplayName = escapeXml(displayName);
    const cleanId = escapeXml(id);
    const avatarBase64 = await fetchAvatarBase64(profileImage);
    const cleanAvatarUrl = escapeXml(avatarBase64);
    const cleanReputation = escapeXml(formatNumber(reputation));
    
    const memberSince = creationDate ? new Date(creationDate * 1000).getUTCFullYear() : new Date().getUTCFullYear();
    const memberSinceYear = escapeXml(String(memberSince));

    const goldBadges = escapeXml(formatNumber(badgeCounts.gold));
    const silverBadges = escapeXml(formatNumber(badgeCounts.silver));
    const bronzeBadges = escapeXml(formatNumber(badgeCounts.bronze));

    const cleanRepChangeYear = escapeXml(formatRepChange(repChangeYear));
    const cleanRepChangeQuarter = escapeXml(formatRepChange(repChangeQuarter));
    const cleanRepChangeMonth = escapeXml(formatRepChange(repChangeMonth));

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="450" height="225" viewBox="0 0 450 225">
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

    return new Response(svg, { headers: responseHeaders });
  } catch (error: any) {
    return new Response(renderErrorCard('Exception Occurred', error?.message || 'Unknown network error.', theme), { headers: responseHeaders });
  }
}
