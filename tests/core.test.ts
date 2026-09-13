import { describe, it, expect, vi, afterEach } from 'vitest';
import { safeHex, renderSvg, escapeXml, fetchAvatarBase64, formatNumber, isPlaceholder, isAllowedAvatarHost, getClientIp } from '../src/core';
import type { GitHubCardData, ThemeConfig } from '../src/core';

describe('escapeXml', () => {
  it('escapes <', () => expect(escapeXml('<')).toBe('&lt;'));
  it('escapes >', () => expect(escapeXml('>')).toBe('&gt;'));
  it('escapes &', () => expect(escapeXml('&')).toBe('&amp;'));
  it("escapes '", () => expect(escapeXml("'")).toBe('&apos;'));
  it('escapes "', () => expect(escapeXml('"')).toBe('&quot;'));
  it('returns empty string for null', () => expect(escapeXml(null)).toBe(''));
  it('returns empty string for undefined', () => expect(escapeXml(undefined)).toBe(''));
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
    expect(safeHex(null)).toBe(false);
    expect(safeHex(undefined)).toBe(false);
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

describe('fetchAvatarBase64 - Security Controls (SSRF, host allowlist, redirects, size cap, MIME)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty string for javascript: URL', async () => {
    expect(await fetchAvatarBase64('javascript:alert(1)', 'github')).toBe('');
  });

  it('returns empty string for http:// URL', async () => {
    expect(await fetchAvatarBase64('http://example.com/avatar.jpg', 'github')).toBe('');
  });

  it('returns empty string for empty input', async () => {
    expect(await fetchAvatarBase64('', 'github')).toBe('');
  });

  it('returns empty string for URL with host outside allowlist without performing network request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    expect(await fetchAvatarBase64('https://malicious.internal/avatar.jpg', 'github')).toBe('');
    expect(await fetchAvatarBase64('https://evil-avatars.githubusercontent.com/a.png', 'github')).toBe('');
    expect(await fetchAvatarBase64('https://attacker.com/avatar.png', 'twitch')).toBe('');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('aborts and returns empty string when redirect points to host outside allowlist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: 'https://evil.internal/metadata' },
    })));

    const result = await fetchAvatarBase64('https://avatars.githubusercontent.com/u/1', 'github');
    expect(result).toBe('');
  });

  it('aborts and returns empty string when resource exceeds 512 KB', async () => {
    // 600 KB mock payload
    const largeBody = new Uint8Array(600 * 1024);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(largeBody, {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'content-length': (600 * 1024).toString(),
      },
    })));

    const result = await fetchAvatarBase64('https://avatars.githubusercontent.com/u/1', 'github');
    expect(result).toBe('');
  });

  it('aborts and returns empty string when Content-Type is not an allowed image MIME type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>evil</html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })));

    const result = await fetchAvatarBase64('https://avatars.githubusercontent.com/u/1', 'github');
    expect(result).toBe('');
  });

  it('successfully returns base64 data URI for valid host and image MIME type', async () => {
    const imageBytes = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(imageBytes, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    })));

    const result = await fetchAvatarBase64('https://avatars.githubusercontent.com/u/1', 'github');
    expect(result).toMatch(/^data:image\/png;base64,/);
  });
});

describe('isAllowedAvatarHost', () => {
  it('allows exact avatars.githubusercontent.com for github', () => {
    expect(isAllowedAvatarHost('avatars.githubusercontent.com', 'github')).toBe(true);
    expect(isAllowedAvatarHost('githubusercontent.com', 'github')).toBe(false);
    expect(isAllowedAvatarHost('evil-avatars.githubusercontent.com', 'github')).toBe(false);
  });

  it('allows sstatic.net and gravatar domains for stackoverflow', () => {
    expect(isAllowedAvatarHost('sstatic.net', 'stackoverflow')).toBe(true);
    expect(isAllowedAvatarHost('i.sstatic.net', 'stackoverflow')).toBe(true);
    expect(isAllowedAvatarHost('gravatar.com', 'stackoverflow')).toBe(true);
    expect(isAllowedAvatarHost('www.gravatar.com', 'stackoverflow')).toBe(true);
    expect(isAllowedAvatarHost('evilgravatar.com', 'stackoverflow')).toBe(false);
  });

  it('allows static-cdn.jtvnw.net for twitch', () => {
    expect(isAllowedAvatarHost('static-cdn.jtvnw.net', 'twitch')).toBe(true);
    expect(isAllowedAvatarHost('sub.static-cdn.jtvnw.net', 'twitch')).toBe(true);
    expect(isAllowedAvatarHost('evilstatic-cdn.jtvnw.net', 'twitch')).toBe(false);
  });
});

describe('isPlaceholder', () => {
  it('detects .env.example placeholders ending with _here or starting with your_', () => {
    expect(isPlaceholder('your_github_token_here')).toBe(true);
    expect(isPlaceholder('your_twitch_client_id_here')).toBe(true);
    expect(isPlaceholder('your_stackapps_key_here')).toBe(true);
    expect(isPlaceholder('placeholder_here')).toBe(true);
  });

  it('detects empty or whitespace strings, null, and undefined', () => {
    expect(isPlaceholder('')).toBe(true);
    expect(isPlaceholder('   ')).toBe(true);
    expect(isPlaceholder(null)).toBe(true);
    expect(isPlaceholder(undefined)).toBe(true);
  });

  it('accepts legitimate token strings', () => {
    expect(isPlaceholder('ghp_1234567890abcdef')).toBe(false);
    expect(isPlaceholder('valid_client_secret_xyz')).toBe(false);
    expect(isPlaceholder('12345')).toBe(false);
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

describe('getClientIp - resistência a X-Forwarded-For forjado', () => {
  const reqWith = (headers: Record<string, string>) =>
    new Request('https://example.com/api/github?username=octocat', { headers });

  it('usa o último segmento do XFF, não o primeiro escrito pelo cliente', () => {
    // O cliente antepõe um IP falso; a borda acrescenta o real ao final.
    const ip = getClientIp(reqWith({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7' }));
    expect(ip).toBe('203.0.113.7');
    expect(ip).not.toBe('1.2.3.4');
  });

  it('atribui o mesmo balde a requisições que só variam o prefixo forjado', () => {
    const a = getClientIp(reqWith({ 'x-forwarded-for': '9.9.9.1, 203.0.113.7' }));
    const b = getClientIp(reqWith({ 'x-forwarded-for': '9.9.9.2, 203.0.113.7' }));
    const c = getClientIp(reqWith({ 'x-forwarded-for': 'nao-e-um-ip, 203.0.113.7' }));
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('prefere x-real-ip, que a borda escreve com valor único', () => {
    const ip = getClientIp(reqWith({ 'x-real-ip': '198.51.100.9', 'x-forwarded-for': '1.2.3.4' }));
    expect(ip).toBe('198.51.100.9');
  });

  it('descarta valor que não se parece com IP e cai no balde compartilhado', () => {
    expect(getClientIp(reqWith({ 'x-forwarded-for': 'meu-proxy-interno' }))).toBe('unknown');
    expect(getClientIp(reqWith({ 'x-real-ip': '999.999.999.999' }))).toBe('unknown');
    expect(getClientIp(reqWith({}))).toBe('unknown');
  });

  it('recua o número de saltos configurado em TRUSTED_PROXY_HOPS', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '2');
    const ip = getClientIp(reqWith({ 'x-forwarded-for': '1.2.3.4, 198.51.100.9, 203.0.113.7' }));
    expect(ip).toBe('198.51.100.9');
    vi.unstubAllEnvs();
  });
});

describe('ALLOWED_IMAGE_MIME_TYPES - SVG não é aceito como avatar', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('descarta avatar servido como image/svg+xml mesmo vindo de host permitido', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/svg+xml' },
      })
    ));
    const out = await fetchAvatarBase64('https://avatars.githubusercontent.com/u/1', 'github');
    expect(out).toBe('');
  });

  it('continua aceitando PNG do host permitido', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      })
    ));
    const out = await fetchAvatarBase64('https://avatars.githubusercontent.com/u/1', 'github');
    expect(out).toMatch(/^data:image\/png;base64,/);
  });
});
