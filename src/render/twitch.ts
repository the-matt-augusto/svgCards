import { fonts } from '../constants';
import { ThemeConfig, TwitchCardData } from '../types';
import { escapeXml } from '../utils/xml';
import { renderAvatar, renderCardBackground, renderCardDefs } from './common';

export function renderTwitchCard(data: TwitchCardData, theme: ThemeConfig): string {
  const cleanDisplayName = escapeXml(data.name);
  const cleanLogin = escapeXml(data.login);
  const followers = data.stats.find(s => s.label === 'Seguidores');
  const followersText = followers ? ` • ${escapeXml(followers.value)} seguidores` : '';

  if (data.isLive) {
    const cleanViewers = escapeXml(data.stats.find(s => s.label === 'Viewers')?.value || '0');
    let truncatedTitle = data.streamTitle || 'Sem título';
    if (truncatedTitle.length > 48) {
      truncatedTitle = truncatedTitle.slice(0, 45) + '...';
    }
    const cleanTitle = escapeXml(truncatedTitle);
    const cleanGame = escapeXml(data.game || 'Sem categoria');

    const avatarMarkup = renderAvatar({
      avatarUrl: data.avatarUrl,
      name: data.name,
      login: data.login,
      theme,
      borderColor: theme.accent,
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="450" height="225" viewBox="0 0 450 225">
${renderCardDefs()}
${renderCardBackground(theme)}
  
${avatarMarkup}

  <text x="135" y="45" font-family="${fonts}" font-size="20" font-weight="bold" fill="${theme.text}">${cleanDisplayName}</text>
  <text x="135" y="66" font-family="${fonts}" font-size="14" fill="${theme.subtext}">@${cleanLogin}${followersText}</text>
  
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
  }

  // Channel is offline
  const offlineAvatarMarkup = renderAvatar({
    avatarUrl: data.avatarUrl,
    name: data.name,
    login: data.login,
    theme,
    opacity: 0.6,
    textColor: theme.subtext,
    borderColor: theme.border,
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="450" height="225" viewBox="0 0 450 225">
${renderCardDefs()}
${renderCardBackground(theme)}
  
${offlineAvatarMarkup}
  
  <text x="135" y="45" font-family="${fonts}" font-size="20" font-weight="bold" fill="${theme.text}">${cleanDisplayName}</text>
  <text x="135" y="66" font-family="${fonts}" font-size="14" fill="${theme.subtext}">@${cleanLogin}${followersText}</text>
  
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
