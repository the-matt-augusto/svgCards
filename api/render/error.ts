import { fonts } from '../constants';
import { ThemeConfig } from '../types';
import { escapeXml } from '../utils/xml';

/**
 * Renders an SVG card displaying an error title and message, with automatic word wrapping.
 */
export function renderErrorCard(title: string, message: string, theme: ThemeConfig): string {
  const cleanTitle = escapeXml(title);

  // Split long messages into two lines if needed (> 38 characters)
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
