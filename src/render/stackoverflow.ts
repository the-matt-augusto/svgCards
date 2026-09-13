import { fonts } from '../constants';
import { StackOverflowCardData, ThemeConfig } from '../types';
import { escapeXml } from '../utils/xml';
import { renderAvatar, renderCardBackground, renderCardDefs } from './common';

export function renderStackOverflowCard(data: StackOverflowCardData, theme: ThemeConfig): string {
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

  const avatarMarkup = renderAvatar({
    avatarUrl: data.avatarUrl,
    name: data.name,
    login: data.login,
    theme,
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="450" height="225" viewBox="0 0 450 225">
${renderCardDefs()}
${renderCardBackground(theme)}
  
${avatarMarkup}

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
