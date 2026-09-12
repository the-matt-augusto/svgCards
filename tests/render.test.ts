import { describe, it, expect } from 'vitest';
import { renderSvg, renderErrorCard } from '../api/render';
import { resolveTheme, themes } from '../api/themes';
import type { StackOverflowCardData, TwitchCardData, ThemeConfig } from '../api/types';

describe('renderSvg - Stack Overflow Card', () => {
  const theme: ThemeConfig = themes.dark;
  const sampleSO: StackOverflowCardData = {
    provider: 'stackoverflow',
    name: 'Jon Skeet',
    login: '22656',
    avatarUrl: '',
    memberSince: 2008,
    badges: {
      gold: '880',
      silver: '9.2k',
      bronze: '9.3k',
    },
    stats: [
      { label: 'Reputação', value: '1.4M' },
      { label: 'Este ano', value: '+12.5k' },
      { label: 'Este trimestre', value: '+3.2k' },
      { label: 'Este mês', value: '+1.1k' },
    ],
  };

  it('renders Stack Overflow user information and reputation metrics', () => {
    const svg = renderSvg(sampleSO, theme);
    expect(svg).toContain('Jon Skeet');
    expect(svg).toContain('Stack Overflow ID: 22656');
    expect(svg).toContain('Membro desde 2008');
    expect(svg).toContain('Reputação:');
    expect(svg).toContain('1.4M');
    expect(svg).toContain('880');
    expect(svg).toContain('9.2k');
    expect(svg).toContain('9.3k');
    expect(svg).toContain('+12.5k');
    expect(svg).toContain('+3.2k');
    expect(svg).toContain('+1.1k');
  });

  it('escapes displayName and ID against XSS payloads', () => {
    const maliciousSO: StackOverflowCardData = {
      ...sampleSO,
      name: '<script>alert("so")</script>',
      login: '"><svg onload=alert(1)>',
    };
    const svg = renderSvg(maliciousSO, theme);
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;alert(&quot;so&quot;)&lt;/script&gt;');
    expect(svg).not.toContain('<svg onload');
  });
});

describe('renderSvg - Twitch Card', () => {
  const theme: ThemeConfig = themes.twitch;

  it('renders live status card with stream title, category and viewers', () => {
    const liveTwitch: TwitchCardData = {
      provider: 'twitch',
      name: 'StreamerPro',
      login: 'streamerpro',
      avatarUrl: '',
      isLive: true,
      game: 'Elden Ring',
      streamTitle: 'No Hit Run - Day 5',
      stats: [
        { label: 'Seguidores', value: '45.2k' },
        { label: 'Viewers', value: '1.8k' },
      ],
    };
    const svg = renderSvg(liveTwitch, theme);
    expect(svg).toContain('StreamerPro');
    expect(svg).toContain('@streamerpro • 45.2k seguidores');
    expect(svg).toContain('AO VIVO');
    expect(svg).toContain('1.8k viewers');
    expect(svg).toContain('No Hit Run - Day 5');
    expect(svg).toContain('Elden Ring');
    expect(svg).toContain('twitch.tv/streamerpro');
  });

  it('renders offline status card with appropriate styling', () => {
    const offlineTwitch: TwitchCardData = {
      provider: 'twitch',
      name: 'StreamerPro',
      login: 'streamerpro',
      avatarUrl: '',
      isLive: false,
      stats: [
        { label: 'Seguidores', value: '45.2k' },
      ],
    };
    const svg = renderSvg(offlineTwitch, theme);
    expect(svg).toContain('StreamerPro');
    expect(svg).toContain('@streamerpro • 45.2k seguidores');
    expect(svg).toContain('OFFLINE');
    expect(svg).toContain('O canal está offline no momento.');
  });

  it('truncates very long stream titles cleanly', () => {
    const liveTwitchLongTitle: TwitchCardData = {
      provider: 'twitch',
      name: 'StreamerPro',
      login: 'streamerpro',
      avatarUrl: '',
      isLive: true,
      streamTitle: 'This is an extremely long stream title intended to verify truncation behavior in svg cards properly',
      game: 'Just Chatting',
      stats: [
        { label: 'Seguidores', value: '10' },
        { label: 'Viewers', value: '5' },
      ],
    };
    const svg = renderSvg(liveTwitchLongTitle, theme);
    expect(svg).toContain('...');
  });
});

describe('renderErrorCard', () => {
  const theme: ThemeConfig = themes.dark;

  it('renders short error messages on a single line', () => {
    const svg = renderErrorCard('Erro', 'Usuário inexistente', theme);
    expect(svg).toContain('Erro');
    expect(svg).toContain('Usuário inexistente');
    expect(svg).toContain('y="95"');
  });

  it('splits long error messages into two lines when exceeding threshold', () => {
    const svg = renderErrorCard(
      'Não Encontrado',
      'Parâmetro ?username= ausente na URL da requisição enviada.',
      theme
    );
    expect(svg).toContain('y="88"');
    expect(svg).toContain('y="110"');
  });

  it('escapes XML characters in title and message', () => {
    const svg = renderErrorCard('<Error & Danger>', '"injection" & <payload>', theme);
    expect(svg).not.toContain('<Error & Danger>');
    expect(svg).toContain('&lt;Error &amp; Danger&gt;');
    expect(svg).toContain('&quot;injection&quot; &amp; &lt;payload&gt;');
  });
});

describe('resolveTheme', () => {
  it('resolves standard theme by name', () => {
    const theme = resolveTheme('nord', () => null);
    expect(theme.bg).toBe(themes.nord.bg);
    expect(theme.accent).toBe(themes.nord.accent);
  });

  it('falls back to dark when unknown theme is requested', () => {
    const theme = resolveTheme('non-existent-theme', () => null);
    expect(theme.bg).toBe(themes.dark.bg);
  });

  it.each(['__proto__', 'constructor'])('ignores inherited theme name %s', (name) => {
    expect(resolveTheme(name, () => null)).toEqual(themes.dark);
  });

  it('applies valid hex overrides and ignores invalid overrides', () => {
    const overrides: Record<string, string> = {
      accent: 'ff00ff',
      bg: 'malicious"onload="',
    };
    const theme = resolveTheme('dark', (key) => overrides[key] ?? null);
    expect(theme.accent).toBe('#ff00ff');
    expect(theme.bg).toBe(themes.dark.bg); // Preserved, malicious ignored
  });
});
