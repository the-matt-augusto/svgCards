import { fonts } from '../constants';
import { GitHubCardData, ThemeConfig } from '../types';
import { safeHex } from '../utils/color';
import { escapeXml } from '../utils/xml';
import { renderAvatar, renderCardBackground, renderCardDefs } from './common';

export function renderGitHubCard(data: GitHubCardData, theme: ThemeConfig): string {
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

  const avatarMarkup = renderAvatar({
    avatarUrl: data.avatarUrl,
    name: data.name,
    login: data.login,
    theme,
  });

  let langsSvg = '';
  (data.languages || []).forEach((lang, i) => {
    const cx = 30 + i * 130;
    const tx = cx + 10;
    const escapedLangName = escapeXml(lang.name);
    const colorHex = (lang.color ?? '').replace(/^#/, '');
    const safeLangColor = safeHex(colorHex)
      ? (lang.color?.startsWith('#') ? lang.color : `#${colorHex}`)
      : '#8b949e';

    langsSvg += `
  <circle cx="${cx}" cy="202" r="4.5" fill="${safeLangColor}" />
  <text x="${tx}" y="206" font-family="${fonts}" font-size="12" fill="${theme.subtext}">${escapedLangName}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="450" height="225" viewBox="0 0 450 225">
${renderCardDefs()}
${renderCardBackground(theme)}
  
${avatarMarkup}

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
