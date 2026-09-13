import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout, handleRequest, resetRateLimits } from '../src/core';

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('aborts when headers arrive but the response body stalls', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(async (_input, init) => new Response(new ReadableStream({
      start(controller) {
        init?.signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')));
        setTimeout(() => {
          if (!init?.signal?.aborted) controller.close();
        }, 100);
      },
    })));

    const result = fetchWithTimeout('https://example.com', {}, 10)
      .then(res => res.text())
      .catch((error: Error) => error.name);

    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toBe('AbortError');
  });

  it('should resolve when fetch succeeds within timeout', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const res = await fetchWithTimeout('https://example.com', {}, 1000);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('ok');
  });

  it('should abort and throw AbortError when timeout is reached', async () => {
    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        const handler = () => reject(new DOMException('The user aborted a request.', 'AbortError'));
        if (signal?.aborted) {
          handler();
        } else {
          signal?.addEventListener('abort', handler);
        }
      });
    });

    await expect(fetchWithTimeout('https://example.com', {}, 10)).rejects.toThrowError(/abort/i);
  });
});

describe('handleRequest - error caching and status codes', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    resetRateLimits();
    // Mock the environment variables
    vi.stubEnv('GITHUB_TOKEN', 'mock_github_token');
    vi.stubEnv('TWITCH_CLIENT_ID', 'mock_id');
    vi.stubEnv('TWITCH_CLIENT_SECRET', 'mock_secret');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns 429 for a Stack Overflow throttle response with HTTP 400', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      error_id: 502, error_name: 'throttle_violation', error_message: 'too many requests',
    }), { status: 400 }));

    const res = await handleRequest(new Request('https://example.com/api/stackoverflow?id=1'), 'stackoverflow');
    expect(res.status).toBe(429);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });

  it('returns 503 for a GitHub internal error without user data', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      errors: [{ type: 'INTERNAL', message: 'Internal server error' }], data: null,
    })));

    const res = await handleRequest(new Request('https://example.com/api/github?username=octocat'), 'github');
    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });

  it.each([0, 1250, null])('renders Twitch follower count %s without inventing missing data', async (total) => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/oauth2/token')) return Response.json({ access_token: 'token', expires_in: 3600 });
      if (url.includes('/helix/users')) return Response.json({ data: [{ id: '1', login: 'streamer', display_name: 'Streamer', profile_image_url: '' }] });
      if (url.includes('/helix/streams')) return Response.json({ data: [] });
      if (url.includes('/channels/followers')) return total === null ? new Response('', { status: 503 }) : Response.json({ total });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const res = await handleRequest(new Request('https://example.com/api/twitch?channel=streamer'), 'twitch');
    const svg = await res.text();
    expect(res.status).toBe(200);
    expect(svg).toContain('OFFLINE');
    if (total === null) {
      expect(svg).not.toContain(' seguidores');
    } else {
      expect(svg).toContain(`${total === 0 ? '0' : '1.3k'} seguidores`);
    }
  });

  it('should return 400 and no-store cache when id parameter is missing', async () => {
    const req = new Request('https://example.com/api?provider=github');
    const res = await handleRequest(req);
    
    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    const svg = await res.text();
    expect(svg).toContain('Não Encontrado');
    expect(svg).toContain('Parâmetro ?username= ausente na URL.');
  });

  it('should return 404 and no-store cache when user is not found', async () => {
    // GitHub API response for user not found
    const mockResponse = new Response(JSON.stringify({ data: { user: null } }), { status: 200 });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const req = new Request('https://example.com/api?provider=github&username=nonexistent');
    const res = await handleRequest(req);

    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    const svg = await res.text();
    expect(svg).toContain('Não Encontrado');
    expect(svg).toContain('GitHub user');
    expect(svg).toContain('exist.');
  });

  it('should return 429 and no-store cache when API rate limit is reached', async () => {
    // GitHub API response with 429 status code
    const mockResponse = new Response('Rate limit exceeded', { status: 429 });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const req = new Request('https://example.com/api?provider=github&username=octocat');
    const res = await handleRequest(req);

    expect(res.status).toBe(429);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    const svg = await res.text();
    expect(svg).toContain('Limite Atingido');
    expect(svg).toContain('Limite de requisições');
    expect(svg).toContain('atingido.');
  });

  it('should return 503 and no-store cache when API returns 401 bad credentials', async () => {
    const mockResponse = new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const req = new Request('https://example.com/api?provider=github&username=octocat');
    const res = await handleRequest(req);

    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    const svg = await res.text();
    expect(svg).toContain('Serviço Indisponível');
    expect(svg).not.toContain('Token do GitHub');
    expect(svg).not.toContain('GITHUB_TOKEN');
    expect(svg).not.toContain('.env');
  });

  it('should return 503 and no-store cache when external API returns 500', async () => {
    // GitHub API response with 500 status code
    const mockResponse = new Response('Internal Server Error', { status: 500 });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const req = new Request('https://example.com/api?provider=github&username=octocat');
    const res = await handleRequest(req);

    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    const svg = await res.text();
    expect(svg).toContain('Serviço Indisponível');
    expect(svg).toContain('GitHub indisponível');
  });

  it('should return 503 and no-store cache when external request times out', async () => {
    // Simulate AbortError on fetch
    vi.mocked(fetch).mockRejectedValue(new DOMException('The user aborted a request.', 'AbortError'));

    const req = new Request('https://example.com/api?provider=github&username=octocat');
    const res = await handleRequest(req);

    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    const svg = await res.text();
    expect(svg).toContain('Serviço Indisponível');
    expect(svg).toContain('expirou');
    expect(svg).toContain('timeout');
  });

  it('should return valid SVG and no-store cache when fetch rejects with null', async () => {
    vi.mocked(fetch).mockRejectedValue(null);

    const req = new Request('https://example.com/api?provider=github&username=octocat');
    const res = await handleRequest(req);

    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    const svg = await res.text();
    expect(svg).toContain('<svg');
    expect(svg).toContain('Serviço Indisponível');
  });

  it('should return valid SVG and no-store cache when fetch rejects with a plain string', async () => {
    vi.mocked(fetch).mockRejectedValue('network failure');

    const req = new Request('https://example.com/api?provider=github&username=octocat');
    const res = await handleRequest(req);

    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    const svg = await res.text();
    expect(svg).toContain('<svg');
    expect(svg).toContain('Serviço Indisponível');
  });

  describe('Security Headers (CSP and nosniff)', () => {
    it('includes Content-Security-Policy and X-Content-Type-Options: nosniff on error responses', async () => {
      const res = await handleRequest(new Request('https://example.com/api?provider=github'));
      expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'none'; style-src 'unsafe-inline'; img-src data:");
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('includes Content-Security-Policy and X-Content-Type-Options: nosniff on success responses', async () => {
      vi.mocked(fetch).mockResolvedValue(Response.json({
        data: {
          user: {
            name: 'Octocat', login: 'octocat', avatarUrl: '', createdAt: '2020-01-01',
            followers: { totalCount: 10 },
            repositories: { totalCount: 5, nodes: [] },
            contributionsCollection: {
              totalCommitContributions: 10, totalPullRequestContributions: 2, totalIssueContributions: 1,
              contributionCalendar: { totalContributions: 13, weeks: [] },
            },
          },
        },
      }));

      const res = await handleRequest(new Request('https://example.com/api/github?username=octocat'), 'github');
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'none'; style-src 'unsafe-inline'; img-src data:");
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });
  });

  describe('Format and Length Validation (GitHub, Twitch, Stack Overflow)', () => {
    it.each([
      '-startwithhyphen',
      'endwithhyphen-',
      'consecutive--hyphen',
      'invalid/char',
      'has@special',
      'a'.repeat(40), // Length 40 exceeds GitHub max 39
    ])('rejects invalid GitHub username "%s" with 400 without invoking upstream fetch', async (username) => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const res = await handleRequest(new Request(`https://example.com/api/github?username=${encodeURIComponent(username)}`), 'github');
      expect(res.status).toBe(400);
      expect(fetchSpy).not.toHaveBeenCalled();

      const svg = await res.text();
      expect(svg).toContain('formato');
      expect(svg).toContain('inválido');
    });

    it.each([
      'ab',              // Length 2 < min 3 (3 e aceito: canais legados da Twitch)
      'a'.repeat(26),    // Length 26 > max 25
      'invalid-hyphen',  // Twitch only allows [a-zA-Z0-9_]
      'special!char',
    ])('rejects invalid Twitch channel "%s" with 400 without invoking upstream fetch', async (channel) => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const res = await handleRequest(new Request(`https://example.com/api/twitch?channel=${encodeURIComponent(channel)}`), 'twitch');
      expect(res.status).toBe(400);
      expect(fetchSpy).not.toHaveBeenCalled();

      const svg = await res.text();
      expect(svg).toContain('formato');
      expect(svg).toContain('inválido');
    });

    it('rejects non-numeric Stack Overflow id with 400 without invoking upstream fetch', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const res = await handleRequest(new Request('https://example.com/api/stackoverflow?id=abc_not_number'), 'stackoverflow');
      expect(res.status).toBe(400);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiting per IP and Provider', () => {
    it('returns HTTP 429 when client exceeds rate limit without calling upstream API', async () => {
      vi.stubEnv('RATE_LIMIT_MAX_PER_MINUTE', '2');
      const fetchSpy = vi.fn().mockImplementation(() => new Response(JSON.stringify({
        error_id: 502, error_name: 'throttle', error_message: 'slow down',
      }), { status: 400 }));
      vi.stubGlobal('fetch', fetchSpy);

      const reqHeaders = { 'x-forwarded-for': '203.0.113.195' };

      // Request 1: allowed
      const res1 = await handleRequest(new Request('https://example.com/api/stackoverflow?id=1', { headers: reqHeaders }), 'stackoverflow');
      expect(res1.status).toBe(429); // SO throttle response from mock
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Request 2: allowed
      const res2 = await handleRequest(new Request('https://example.com/api/stackoverflow?id=2', { headers: reqHeaders }), 'stackoverflow');
      expect(res2.status).toBe(429);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Request 3: blocked by rate limiter BEFORE any upstream fetch call
      const res3 = await handleRequest(new Request('https://example.com/api/stackoverflow?id=3', { headers: reqHeaders }), 'stackoverflow');
      expect(res3.status).toBe(429);
      expect(fetchSpy).toHaveBeenCalledTimes(2); // No 3rd fetch call!
      expect(res3.headers.get('Cache-Control')).toContain('no-store');
      expect(res3.headers.get('Retry-After')).toBeTruthy();
      expect(res3.headers.get('X-RateLimit-Remaining')).toBe('0');

      const svg = await res3.text();
      expect(svg).toContain('Limite Atingido');
      expect(svg).toContain('Limite de requisições excedido');
    });
  });

  describe('Information Disclosure Prevention', () => {
    it('never leaks upstream error body text into the returned SVG', async () => {
      const sensitiveBody = 'SECRET_INTERNAL_DB_ERROR: password hash leak';
      vi.mocked(fetch).mockResolvedValue(new Response(sensitiveBody, { status: 400 }));

      const res = await handleRequest(new Request('https://example.com/api/github?username=octocat'), 'github');
      const svg = await res.text();
      expect(svg).not.toContain(sensitiveBody);
      expect(svg).not.toContain('SECRET_INTERNAL_DB_ERROR');
      expect(svg).toContain('Serviço Indisponível');
    });

    it('returns generic error when Twitch credentials are placeholder and does not leak variable names', async () => {
      vi.stubEnv('TWITCH_CLIENT_ID', 'your_twitch_client_id_here');
      vi.stubEnv('TWITCH_CLIENT_SECRET', 'your_twitch_client_secret_here');

      const res = await handleRequest(new Request('https://example.com/api/twitch?channel=streamer'), 'twitch');
      expect(res.status).toBe(500);

      const svg = await res.text();
      expect(svg).not.toContain('TWITCH_CLIENT_ID');
      expect(svg).not.toContain('TWITCH_CLIENT_SECRET');
      expect(svg).not.toContain('.env');
      expect(svg).toContain('Serviço Indisponível');
    });

    it('returns generic error when GITHUB_TOKEN is placeholder and does not leak variable names', async () => {
      vi.stubEnv('GITHUB_TOKEN', 'your_github_token_here');

      const res = await handleRequest(new Request('https://example.com/api/github?username=octocat'), 'github');
      expect(res.status).toBe(500);

      const svg = await res.text();
      expect(svg).not.toContain('GITHUB_TOKEN');
      expect(svg).not.toContain('.env');
      expect(svg).toContain('Serviço Indisponível');
    });

    it('replaces unhandled runtime Error message with generic card text', async () => {
      const { GitHubProvider } = await import('../src/providers/github');
      vi.spyOn(GitHubProvider.prototype, 'fetch').mockRejectedValueOnce(
        new Error('Database connection failed at postgres://admin:secret@internal:5432')
      );

      const res = await handleRequest(new Request('https://example.com/api/github?username=octocat'), 'github');
      expect(res.status).toBe(503);

      const svg = await res.text();
      expect(svg).not.toContain('Database connection failed');
      expect(svg).not.toContain('postgres://admin:secret');
      expect(svg).toContain('Ocorreu um erro interno');
      expect(svg).toContain('cartão.');
    });

    it('does not leak internal Twitch network error details into public SVG (A-03)', async () => {
      vi.stubEnv('TWITCH_CLIENT_ID', 'test-client-id');
      vi.stubEnv('TWITCH_CLIENT_SECRET', 'test-client-secret');

      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/oauth2/token')) {
          return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        throw new Error('INTERNAL_AUDIT_MARKER: proxy socket reset at 10.0.0.12:8080');
      }));

      const res = await handleRequest(new Request('https://example.com/api/twitch?channel=ninja'), 'twitch');
      expect(res.status).toBe(503);

      const svg = await res.text();
      expect(svg).not.toContain('INTERNAL_AUDIT_MARKER');
      expect(svg).not.toContain('proxy socket reset');
      expect(svg).not.toContain('10.0.0.12');
      expect(svg).toContain('Serviço Indisponível');
      expect(svg).toContain('Erro de rede ao acessar a Twitch.');

      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    });

    it('preserves AbortError timeout message in Twitch Helix without leaking internal stack', async () => {
      vi.stubEnv('TWITCH_CLIENT_ID', 'test-client-id');
      vi.stubEnv('TWITCH_CLIENT_SECRET', 'test-client-secret');

      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/oauth2/token')) {
          return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      }));

      const res = await handleRequest(new Request('https://example.com/api/twitch?channel=ninja'), 'twitch');
      expect(res.status).toBe(503);

      const svg = await res.text();
      expect(svg).toContain('A solicitação à Twitch expirou');
      expect(svg).toContain('(timeout).');

      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    });
  });
});

describe('handleRequest - canal legado de 3 caracteres da Twitch', () => {
  it('aceita canal de 3 caracteres em vez de rejeitar com 400', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubEnv('TWITCH_CLIENT_ID', 'real-client-id');
    vi.stubEnv('TWITCH_CLIENT_SECRET', 'real-client-secret');

    const res = await handleRequest(new Request('https://example.com/api/twitch?channel=ppp'), 'twitch');
    expect(res.status).not.toBe(400);
    expect(fetchSpy).toHaveBeenCalled();

    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
