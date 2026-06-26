import { describe, it, expect } from 'vitest';
import { safeHex, renderSvg, escapeXml, fetchAvatarBase64, formatNumber } from '../api/core';
import type { GitHubCardData, ThemeConfig } from '../api/core';

describe('escapeXml', () => {
  it('escapes <', () => expect(escapeXml('<')).toBe('&lt;'));
  it('escapes >', () => expect(escapeXml('>')).toBe('&gt;'));
  it('escapes &', () => expect(escapeXml('&')).toBe('&amp;'));
  it("escapes '", () => expect(escapeXml("'")).toBe('&apos;'));
  it('escapes "', () => expect(escapeXml('"')).toBe('&quot;'));
  it('returns empty string for null', () => expect(escapeXml(null as any)).toBe(''));
  it('returns empty string for undefined', () => expect(escapeXml(undefined as any)).toBe(''));
  it('escapes combined injection attempt', () => {
    expect(escapeXml('<img src="x" onerror=\'alert(1)\'>&')).toBe(
      '&lt;img src=&quot;x&quot; onerror=&apos;alert(1)&apos;&gt;&amp;'
    );
  });
});

describe('safeHex', () => {
  it('should accept valid 3-digit hex colors', () => {
    expect(safeHex('fff')).toBe(true);
    expect(safeHex('000')).toBe(true);
    expect(safeHex('abc')).toBe(true);
    expect(safeHex('ABC')).toBe(true);
  });

  it('should accept valid 6-digit hex colors', () => {
    expect(safeHex('ffffff')).toBe(true);
    expect(safeHex('000000')).toBe(true);
    expect(safeHex('12a3f6')).toBe(true);
    expect(safeHex('12A3F6')).toBe(true);
  });

  it('should reject color names', () => {
    expect(safeHex('red')).toBe(false);
    expect(safeHex('blue')).toBe(false);
    expect(safeHex('green')).toBe(false);
  });

  it('should reject empty strings, null, or undefined', () => {
    expect(safeHex('')).toBe(false);
    expect(safeHex(null as any)).toBe(false);
    expect(safeHex(undefined as any)).toBe(false);
  });

  it('should reject 7-digit hex strings', () => {
    expect(safeHex('1234567')).toBe(false);
    expect(safeHex('ffffff0')).toBe(false);
  });

  it('should reject injection attempts', () => {
    expect(safeHex('"/><script>')).toBe(false);
    expect(safeHex('<script>alert(1)</script>')).toBe(false);
    expect(safeHex('eval("1")')).toBe(false);
  });
});

describe('renderSvg - lang.color injection', () => {
  const theme: ThemeConfig = {
    bg: '#0d1117', border: '#30363d', text: '#e6edf3',
    subtext: '#8b949e', accent: '#58a6ff',
  };
  const base: GitHubCardData = {
    provider: 'github', name: 'Test', login: 'test',
    avatarUrl: 'https://example.com/a.jpg', memberSince: 2020, languages: [],
    stats: [
      { label: 'Repos', value: '0' }, { label: 'Seguidores', value: '0' },
      { label: 'Estrelas', value: '0' }, { label: 'Sequência atual', value: '0' },
      { label: 'Contribuições no ano', value: '0' }, { label: 'Commits', value: '0' },
      { label: 'PRs', value: '0' }, { label: 'Issues', value: '0' },
    ],
  };

  it('rejects malicious lang.color and falls back to #8b949e', () => {
    const data: GitHubCardData = { ...base, languages: [
      { name: 'TS', color: '"/><script xmlns="http://www.w3.org/1999/xhtml">alert(1)</script><circle fill="' },
    ]};
    const svg = renderSvg(data, theme);
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('alert(1)');
    expect(svg).toContain('fill="#8b949e"');
  });

  it('accepts valid lang.color with # prefix', () => {
    const data: GitHubCardData = { ...base, languages: [{ name: 'TS', color: '#3178c6' }] };
    expect(renderSvg(data, theme)).toContain('fill="#3178c6"');
  });
});

describe('renderSvg - avatar fallback', () => {
  const theme: ThemeConfig = {
    bg: '#0d1117', border: '#30363d', text: '#e6edf3',
    subtext: '#8b949e', accent: '#58a6ff',
  };
  const base: GitHubCardData = {
    provider: 'github', name: 'Alice', login: 'alice',
    avatarUrl: '', memberSince: 2020, languages: [],
    stats: [
      { label: 'Repos', value: '0' }, { label: 'Seguidores', value: '0' },
      { label: 'Estrelas', value: '0' }, { label: 'Sequência atual', value: '0' },
      { label: 'Contribuições no ano', value: '0' }, { label: 'Commits', value: '0' },
      { label: 'PRs', value: '0' }, { label: 'Issues', value: '0' },
    ],
  };

  it('renders initial in <text> and omits empty <image> when avatarUrl is empty', () => {
    const svg = renderSvg(base, theme);
    expect(svg).toContain('text-anchor="middle"');
    expect(svg).toContain('>A<');
    expect(svg).not.toContain('xlink:href=""');
  });

  it('escapes initial when name starts with <', () => {
    const svg = renderSvg({ ...base, name: '<script>alert(1)</script>' }, theme);
    expect(svg).toContain('&lt;');
    expect(svg).not.toContain('<script');
  });

  it('falls back to login initial when name is empty', () => {
    const svg = renderSvg({ ...base, name: '', login: 'bob' }, theme);
    expect(svg).toContain('>B<');
  });

  it('escapes XML-special first char in login fallback when name is empty', () => {
    const svg = renderSvg({ ...base, name: '', login: '<injected' }, theme);
    expect(svg).toContain('text-anchor="middle">&lt;</text>');
  });

  it('handles multi-byte unicode (CJK) initial correctly', () => {
    const svg = renderSvg({ ...base, name: '中文用户', login: '' }, theme);
    expect(svg).toContain('text-anchor="middle">中</text>');
  });

  it('handles emoji initial correctly via code-point iteration (no lone surrogate)', () => {
    // [...str][0] reads the full emoji code point; the SVG receives the glyph intact.
    const svg = renderSvg({ ...base, name: '🔥streamer', login: '' }, theme);
    expect(svg).toContain('text-anchor="middle">🔥</text>');
    expect(svg).not.toContain('<script');
  });

  it('falls back to ? when both name and login are empty', () => {
    const svg = renderSvg({ ...base, name: '', login: '' }, theme);
    expect(svg).toContain('>?<');
  });

  it('escapes every XML-special character that could appear as the first char of name', () => {
    const cases: Array<[string, string]> = [
      ['<script>xss</script>',   'text-anchor="middle">&lt;</text>'],
      ['>injected',               'text-anchor="middle">&gt;</text>'],
      ['&amp;payload',            'text-anchor="middle">&amp;</text>'],
      ['"onload="alert(1)',       'text-anchor="middle">&quot;</text>'],
      ["'onload='alert(1)",       'text-anchor="middle">&apos;</text>'],
    ];
    for (const [name, expectedFragment] of cases) {
      const svg = renderSvg({ ...base, name }, theme);
      expect(svg).toContain(expectedFragment);
    }
  });
});

describe('fetchAvatarBase64 - URL scheme allowlist', () => {
  it('returns empty string for javascript: URL', async () => {
    expect(await fetchAvatarBase64('javascript:alert(1)', 'github')).toBe('');
  });
  it('returns empty string for http:// URL', async () => {
    expect(await fetchAvatarBase64('http://example.com/avatar.jpg', 'github')).toBe('');
  });
  it('returns empty string for empty input', async () => {
    expect(await fetchAvatarBase64('', 'github')).toBe('');
  });
});

describe('formatNumber', () => {
  it('returns string as-is below 1000', () => expect(formatNumber(999)).toBe('999'));
  it('returns "0" for zero',             () => expect(formatNumber(0)).toBe('0'));
  it('exact boundary 1000 → "1k"',       () => expect(formatNumber(1000)).toBe('1k'));
  it('formats 1500 as "1.5k"',           () => expect(formatNumber(1500)).toBe('1.5k'));
  it('strips trailing .0 → "2k"',        () => expect(formatNumber(2000)).toBe('2k'));
  it('exact boundary 1000000 → "1M"',    () => expect(formatNumber(1000000)).toBe('1M'));
  it('formats 1500000 as "1.5M"',        () => expect(formatNumber(1500000)).toBe('1.5M'));
  it('strips trailing .0 → "2M"',        () => expect(formatNumber(2000000)).toBe('2M'));
  // Negativos: válidos via formatRepChange (reputação SO pode cair)
  it('formats -500 as "-500"',           () => expect(formatNumber(-500)).toBe('-500'));
  it('formats -1500 as "-1.5k"',         () => expect(formatNumber(-1500)).toBe('-1.5k'));
  it('formats -1000000 as "-1M"',        () => expect(formatNumber(-1000000)).toBe('-1M'));
});
