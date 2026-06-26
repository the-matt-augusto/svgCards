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
  twitch:     { bg: "#0d0c0f", border: "#9146ff", text: "#f5f5f7", subtext: "#adadb8", accent: "#9146ff" },
} as const;

const fonts = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

// Global cache variables for Twitch OAuth Token
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

// Escapa caracteres XML
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
    const contentType = res.headers.get('content-type') || 'image/png';
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

async function getTwitchToken(clientId: string, clientSecret: string, forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Auth failed (${res.status}): ${errorText.slice(0, 100)}`);
  }

  const json = await res.json() as { access_token: string; expires_in: number };
  cachedToken = json.access_token;
  tokenExpiresAt = Date.now() + (json.expires_in - 60) * 1000; // Buffer de 60s
  return cachedToken;
}

async function fetchTwitchHelix(url: string, clientId: string, clientSecret: string): Promise<any> {
  let token = await getTwitchToken(clientId, clientSecret);
  
  let res = await fetch(url, {
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    // Tenta renovar o token e repetir uma vez
    token = await getTwitchToken(clientId, clientSecret, true);
    res = await fetch(url, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API status ${res.status}: ${errorText.slice(0, 50)}`);
  }

  return res.json();
}

export default async function handler(req: Request): Promise<Response> {
  const responseHeaders = new Headers({
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=600', // Cache reduzido para live status
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

  const channel = url.searchParams.get('channel');

  if (!channel) {
    return new Response(renderErrorCard('Missing Channel', 'Provide a ?channel= parameter in the URL.', theme), { headers: responseHeaders });
  }

  const twitchClientId = process.env.TWITCH_CLIENT_ID;
  const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!twitchClientId || !twitchClientSecret) {
    return new Response(renderErrorCard('Credentials Missing', 'Configure TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET.', theme), { headers: responseHeaders });
  }

  try {
    // 1. Obter informações básicas do usuário
    const userJson = await fetchTwitchHelix(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(channel)}`, twitchClientId, twitchClientSecret);
    
    if (!userJson.data || userJson.data.length === 0) {
      return new Response(renderErrorCard('Channel Not Found', `Twitch channel "${channel}" does not exist.`, theme), { headers: responseHeaders });
    }

    const twitchUser = userJson.data[0];
    const displayName = twitchUser.display_name;
    const loginName = twitchUser.login;
    const profileImageUrl = twitchUser.profile_image_url;

    // Converter imagem de perfil em Base64
    const avatarBase64 = await fetchAvatarBase64(profileImageUrl);
    const cleanAvatarUrl = escapeXml(avatarBase64);
    const cleanDisplayName = escapeXml(displayName);
    const cleanLogin = escapeXml(loginName);

    // 1.5. Obter número de seguidores
    const followersJson = await fetchTwitchHelix(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${twitchUser.id}&first=1`, twitchClientId, twitchClientSecret);
    const followersCount = followersJson.total || 0;
    const cleanFollowers = escapeXml(formatNumber(followersCount));

    // 2. Obter informações de transmissão ao vivo
    const streamJson = await fetchTwitchHelix(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`, twitchClientId, twitchClientSecret);
    const isLive = streamJson.data && streamJson.data.length > 0;

    let svg = '';

    if (isLive) {
      const stream = streamJson.data[0];
      const streamTitle = stream.title || 'Sem título';
      const gameName = stream.game_name || 'Sem categoria';
      const viewers = stream.viewer_count || 0;

      // Trunca o título para caber no cartão
      let truncatedTitle = streamTitle;
      if (truncatedTitle.length > 48) {
        truncatedTitle = truncatedTitle.slice(0, 45) + '...';
      }

      const cleanTitle = escapeXml(truncatedTitle);
      const cleanGame = escapeXml(gameName);
      const cleanViewers = escapeXml(formatNumber(viewers));

      svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="450" height="225" viewBox="0 0 450 225">
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
      svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="450" height="225" viewBox="0 0 450 225">
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

    return new Response(svg, { headers: responseHeaders });
  } catch (error: any) {
    return new Response(renderErrorCard('Exception Occurred', error?.message || 'Unknown network error.', theme), { headers: responseHeaders });
  }
}
