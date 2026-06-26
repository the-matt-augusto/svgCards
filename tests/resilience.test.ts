import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout, handleRequest, ProviderError } from '../api/core';

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const signal = init?.signal;
      return new Promise<Response>((resolve, reject) => {
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
    // Mock the environment variables for Twitch
    process.env.TWITCH_CLIENT_ID = 'mock_id';
    process.env.TWITCH_CLIENT_SECRET = 'mock_secret';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TWITCH_CLIENT_ID;
    delete process.env.TWITCH_CLIENT_SECRET;
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
});
