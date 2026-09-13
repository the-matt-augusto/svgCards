import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { AddressInfo } from 'node:net';
// @ts-expect-error server.mjs is an ES module without dedicated TypeScript declarations
import { buildWebHeaders, createRequestListener } from '../server.mjs';
import * as core from '../src/core';

describe('server.mjs - Segurança e Controle de Abuso do Adaptador Local (A-02)', () => {
  beforeEach(() => {
    core.resetRateLimits();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    core.resetRateLimits();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('buildWebHeaders - higienização de cabeçalhos de proxy', () => {
    it('descarta x-real-ip, cf-connecting-ip e x-forwarded-for fornecidos pelo cliente por padrão', () => {
      const clientHeaders = {
        'x-real-ip': '198.51.100.22',
        'cf-connecting-ip': '198.51.100.33',
        'x-forwarded-for': '198.51.100.44, 203.0.113.55',
        'x-forwarded-host': 'malicious.com',
        'x-forwarded-proto': 'https',
        'user-agent': 'TestClient/1.0',
        'accept': 'image/svg+xml',
      };

      const headers = buildWebHeaders(clientHeaders, '127.0.0.1');

      expect(headers.get('x-real-ip')).toBe('127.0.0.1');
      expect(headers.get('cf-connecting-ip')).toBeNull();
      expect(headers.get('x-forwarded-for')).toBeNull();
      expect(headers.get('x-forwarded-host')).toBeNull();
      expect(headers.get('x-forwarded-proto')).toBeNull();
      expect(headers.get('user-agent')).toBe('TestClient/1.0');
      expect(headers.get('accept')).toBe('image/svg+xml');
    });

    it('remove prefixo ::ffff: do socket remoto IPv4-mapped IPv6', () => {
      const headers = buildWebHeaders({}, '::ffff:127.0.0.1');
      expect(headers.get('x-real-ip')).toBe('127.0.0.1');
    });

    it('mantém cabeçalhos de encaminhamento quando TRUST_PROXY=true', () => {
      vi.stubEnv('TRUST_PROXY', 'true');
      const clientHeaders = {
        'x-forwarded-for': '203.0.113.99',
        'x-real-ip': '203.0.113.99',
      };

      const headers = buildWebHeaders(clientHeaders, '10.0.0.1');
      expect(headers.get('x-forwarded-for')).toBe('203.0.113.99');
      expect(headers.get('x-real-ip')).toBe('203.0.113.99');
    });

    it('mantém cabeçalhos de encaminhamento quando socket remoto está em TRUSTED_PROXIES', () => {
      vi.stubEnv('TRUSTED_PROXIES', '10.0.0.1, 10.0.0.2');
      const clientHeaders = {
        'x-forwarded-for': '203.0.113.123',
        'x-real-ip': '203.0.113.123',
      };

      const trustedHeaders = buildWebHeaders(clientHeaders, '10.0.0.1');
      expect(trustedHeaders.get('x-forwarded-for')).toBe('203.0.113.123');

      const untrustedHeaders = buildWebHeaders(clientHeaders, '10.0.0.99');
      expect(untrustedHeaders.get('x-forwarded-for')).toBeNull();
      expect(untrustedHeaders.get('x-real-ip')).toBe('10.0.0.99');
    });
  });

  describe('Integração HTTP - mitigação de spoofing de IP e rate limiting', () => {
    it('impede que cliente contorne limite alternando x-real-ip e retorna 429 sem chamar upstream', async () => {
      vi.stubEnv('RATE_LIMIT_MAX_PER_MINUTE', '1');

      let upstreamCalls = 0;
      const mockCore = {
        ...core,
        handleRequest: vi.fn().mockImplementation(async (req: Request, provider?: string) => {
          const rateCheck = core.checkRateLimit(req, provider || 'github');
          if (!rateCheck.allowed) {
            return new Response('<svg>Limite Atingido</svg>', {
              status: 429,
              headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' },
            });
          }
          upstreamCalls++;
          return new Response('<svg>Card Sucesso</svg>', {
            status: 200,
            headers: { 'Content-Type': 'image/svg+xml' },
          });
        }),
      };

      const listener = createRequestListener(mockCore as any);
      const testServer = http.createServer(listener);

      await new Promise<void>((resolve) => testServer.listen(0, '127.0.0.1', () => resolve()));
      const port = (testServer.address() as AddressInfo).port;

      const makeRequest = (forgedIp: string): Promise<{ status: number; body: string }> => {
        return new Promise((resolve, reject) => {
          const req = http.request({
            hostname: '127.0.0.1',
            port,
            path: '/api/github?username=octocat',
            method: 'GET',
            headers: {
              'x-real-ip': forgedIp,
              'cf-connecting-ip': forgedIp,
              'x-forwarded-for': `${forgedIp}, 10.0.0.1`,
            },
          }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
          });
          req.on('error', reject);
          req.end();
        });
      };

      try {
        // Primeira requisição: consome a cota de 1 req/min para o socket 127.0.0.1
        const res1 = await makeRequest('192.0.2.1');
        expect(res1.status).toBe(200);
        expect(upstreamCalls).toBe(1);

        // Segunda requisição com x-real-ip forjado: NÃO deve criar outro contador
        const res2 = await makeRequest('192.0.2.2');
        expect(res2.status).toBe(429);
        expect(res2.body).toContain('Limite Atingido');
        // Não chamou upstream
        expect(upstreamCalls).toBe(1);

        // Terceira requisição com outro IP forjado: ainda bloqueada em 429
        const res3 = await makeRequest('192.0.2.3');
        expect(res3.status).toBe(429);
        expect(upstreamCalls).toBe(1);
      } finally {
        await new Promise<void>((resolve) => testServer.close(() => resolve()));
      }
    });
  });
});
