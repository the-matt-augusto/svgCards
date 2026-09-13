/**
 * LIMITAÇÃO CONHECIDA: este contador vive na memória do isolate. Em Vercel Edge
 * Functions cada isolate (e cada região) mantém o seu, então o teto efetivo é
 * `limite x isolates ativos`. Serve como primeira camada contra abuso trivial;
 * para conter abuso distribuído é necessário um contador compartilhado (KV) ou
 * uma regra no Vercel Firewall, fora do escopo deste módulo.
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const IPV4_REGEX = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const IPV6_REGEX = /^[0-9a-fA-F:]+$/;

function isIpLike(value: string): boolean {
  if (IPV4_REGEX.test(value)) {
    return value.split('.').every((octet) => Number(octet) <= 255);
  }
  return value.includes(':') && IPV6_REGEX.test(value);
}

/**
 * Resets the in-memory rate limit store (useful for automated testing).
 */
export function resetRateLimits(): void {
  rateLimitStore.clear();
}

/**
 * Extracts the client IP from request headers, resisting client-supplied spoofing.
 *
 * `x-real-ip` e `cf-connecting-ip` são escritos pela borda e carregam um único
 * valor, então vêm primeiro. Já `x-forwarded-for` acumula "cliente, proxy1,
 * proxy2...": o PRIMEIRO segmento é escrito pelo cliente e é forjável, enquanto
 * o ÚLTIMO é inserido pelo proxy mais próximo do servidor. Por isso lemos de
 * trás para frente. Use TRUSTED_PROXY_HOPS para recuar N saltos quando houver
 * proxies próprios na frente da aplicação.
 */
export function getClientIp(req: Request): string {
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp && isIpLike(realIp)) return realIp;

  const cfIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cfIp && isIpLike(cfIp)) return cfIp;

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map((s) => s.trim()).filter(Boolean);
    const configured = Number(process.env.TRUSTED_PROXY_HOPS);
    const hops = Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 1;
    const candidate = parts[parts.length - Math.min(hops, parts.length)];
    if (candidate && isIpLike(candidate)) return candidate;
  }

  // Sem cabeçalho confiável, todo o tráfego cai num único balde compartilhado.
  // É deliberadamente conservador: prefere limitar demais a não limitar nada.
  return 'unknown';
}

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  clientIp: string;
}

/**
 * Checks rate limit for a given request and provider.
 * Implements a 60-second window per client IP and provider.
 */
export function checkRateLimit(req: Request, provider: string): RateLimitCheckResult {
  const clientIp = getClientIp(req);
  const key = `${clientIp}:${provider}`;
  const now = Date.now();
  const windowMs = 60_000;

  const envLimit = process.env.RATE_LIMIT_MAX_PER_MINUTE;
  const limit = envLimit && !Number.isNaN(Number(envLimit)) ? Math.max(1, Number(envLimit)) : 60;

  let entry = rateLimitStore.get(key);

  if (!entry || now >= entry.resetTime) {
    entry = { count: 1, resetTime: now + windowMs };
    rateLimitStore.set(key, entry);
  } else {
    entry.count += 1;
  }

  const resetSeconds = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));
  const remaining = Math.max(0, limit - entry.count);
  const allowed = entry.count <= limit;

  // Observability & metrics
  if (allowed) {
    console.info(`[RateLimit] IP ${clientIp} [${provider}] consumo: ${entry.count}/${limit}`);
  } else {
    console.warn(`[RateLimit] IP ${clientIp} atingiu o limite para ${provider} (${entry.count}/${limit})`);
  }

  // Periodic cleanup of stale entries when map grows
  if (rateLimitStore.size > 1000) {
    for (const [storedKey, storedEntry] of rateLimitStore.entries()) {
      if (now >= storedEntry.resetTime) {
        rateLimitStore.delete(storedKey);
      }
    }
  }

  return {
    allowed,
    limit,
    remaining,
    resetSeconds,
    clientIp,
  };
}

/**
 * Validates identifier against optional allowlist for private installations.
 */
export function isIdentifierAllowed(id: string): boolean {
  const allowlistEnv = process.env.ALLOWED_USERS || process.env.ALLOWED_IDENTIFIERS;
  if (!allowlistEnv) return true;

  const allowed = allowlistEnv
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length === 0) return true;

  return allowed.includes(id.trim().toLowerCase());
}
