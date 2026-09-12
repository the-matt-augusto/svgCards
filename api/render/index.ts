import { CardData, ThemeConfig } from '../types';
import { renderGitHubCard } from './github';
import { renderStackOverflowCard } from './stackoverflow';
import { renderTwitchCard } from './twitch';

export * from './common';
export * from './error';
export * from './github';
export * from './stackoverflow';
export * from './twitch';

/**
 * Main SVG render dispatcher that routes card data to its provider-specific SVG template.
 */
export function renderSvg(data: CardData, theme: ThemeConfig): string {
  switch (data.provider) {
    case 'github':
      return renderGitHubCard(data, theme);
    case 'stackoverflow':
      return renderStackOverflowCard(data, theme);
    case 'twitch':
      return renderTwitchCard(data, theme);
    default:
      return '';
  }
}
