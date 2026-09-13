import { CACHE_SETTINGS } from './constants';
import { renderErrorCard, renderSvg } from './render';
import { resolveTheme } from './themes';
import { Provider, ProviderError, ProviderType, ThemeConfig } from './types';
import { fetchAvatarBase64 } from './utils/http';
import { checkRateLimit, isIdentifierAllowed } from './utils/ratelimit';
import { validateProviderConfig } from './utils/config';

export * from './types';
export * from './constants';
export * from './themes';
export * from './utils/xml';
export * from './utils/color';
export * from './utils/format';
export * from './utils/http';
export * from './utils/ratelimit';
export * from './utils/config';
export * from './render';

const ERROR_TITLES = {
  not_found: 'Não Encontrado',
  unavailable: 'Serviço Indisponível',
  rate_limited: 'Limite Atingido',
} as const;

const ERROR_STATUSES = {
  not_found: 404,
  rate_limited: 429,
  unavailable: 503,
} as const;

const GITHUB_USERNAME_REGEX = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const STACKOVERFLOW_ID_REGEX = /^\d+$/;
// Mínimo 3: a Twitch exige 4 para contas novas, mas canais legados de 3 existem.
const TWITCH_CHANNEL_REGEX = /^[A-Za-z0-9_]{3,25}$/;
const CSP_HEADER = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";

/**
 * Unified request handler for Vercel Edge Serverless functions.
 */
export async function handleRequest(req: Request, defaultProvider?: string): Promise<Response> {
  const url = new URL(req.url);

  // 1. Resolve theme and color overrides
  const theme: ThemeConfig = resolveTheme(
    url.searchParams.get('theme'),
    (key) => url.searchParams.get(key)
  );

  // 2. Resolve target provider
  const providerParam = url.searchParams.get('provider');
  let providerName: ProviderType = 'github';
  const candidateProvider = defaultProvider || providerParam || 'github';
  if (candidateProvider === 'stackoverflow' || candidateProvider === 'twitch') {
    providerName = candidateProvider;
  }

  // 3. Configure Cache and Security Headers (CSP + nosniff)
  const cacheConfig = providerName === 'twitch' ? CACHE_SETTINGS.twitch : CACHE_SETTINGS.default;
  const responseHeaders = new Headers({
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': `public, max-age=${cacheConfig.maxAge}, s-maxage=${cacheConfig.maxAge}, stale-while-revalidate=${cacheConfig.staleWhileRevalidate}`,
    'Content-Security-Policy': CSP_HEADER,
    'X-Content-Type-Options': 'nosniff',
  });

  const errorHeaders = new Headers({
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Content-Security-Policy': CSP_HEADER,
    'X-Content-Type-Options': 'nosniff',
  });

  try {
    // 4. Resolve ID parameter name based on provider
    let idParam = 'username';
    if (providerName === 'stackoverflow') {
      idParam = 'id';
    } else if (providerName === 'twitch') {
      idParam = 'channel';
    }

    const id = url.searchParams.get(idParam);
    if (!id) {
      return new Response(
        renderErrorCard('Não Encontrado', `Parâmetro ?${idParam}= ausente na URL.`, theme),
        { status: 400, headers: errorHeaders }
      );
    }

    // 5. Strict input format and length validation prior to dynamic import or network calls
    if (providerName === 'github' && !GITHUB_USERNAME_REGEX.test(id)) {
      return new Response(
        renderErrorCard('Não Encontrado', 'O parâmetro ?username= possui formato inválido.', theme),
        { status: 400, headers: errorHeaders }
      );
    }

    if (providerName === 'stackoverflow' && !STACKOVERFLOW_ID_REGEX.test(id)) {
      return new Response(
        renderErrorCard('Não Encontrado', 'O parâmetro ?id= deve ser um valor numérico.', theme),
        { status: 400, headers: errorHeaders }
      );
    }

    if (providerName === 'twitch' && !TWITCH_CHANNEL_REGEX.test(id)) {
      return new Response(
        renderErrorCard('Não Encontrado', 'O parâmetro ?channel= possui formato inválido.', theme),
        { status: 400, headers: errorHeaders }
      );
    }

    // 6. Optional identifier allowlist validation for private setups
    if (!isIdentifierAllowed(id)) {
      console.warn(`[Access Control] Identificador "${id}" bloqueado pela allowlist.`);
      return new Response(
        renderErrorCard('Não Autorizado', 'Identificador não permitido nesta instância.', theme),
        { status: 403, headers: errorHeaders }
      );
    }

    // 7. Rate limit enforcement before fetching upstream API
    const rateLimit = checkRateLimit(req, providerName);
    if (!rateLimit.allowed) {
      const rlHeaders = new Headers(errorHeaders);
      rlHeaders.set('Retry-After', rateLimit.resetSeconds.toString());
      rlHeaders.set('X-RateLimit-Limit', rateLimit.limit.toString());
      rlHeaders.set('X-RateLimit-Remaining', '0');
      rlHeaders.set('X-RateLimit-Reset', (Math.floor(Date.now() / 1000) + rateLimit.resetSeconds).toString());

      return new Response(
        renderErrorCard('Limite Atingido', 'Limite de requisições excedido. Tente novamente mais tarde.', theme),
        { status: 429, headers: rlHeaders }
      );
    }

    // 8. Startup/Environment credentials check (avoid leaking env names in error cards)
    const configCheck = validateProviderConfig(providerName);
    if (!configCheck.valid) {
      return new Response(
        renderErrorCard('Serviço Indisponível', configCheck.message, theme),
        { status: 500, headers: errorHeaders }
      );
    }

    // 9. Dynamic import and instantiate provider
    let provider: Provider;
    if (providerName === 'github') {
      const { GitHubProvider } = await import('./providers/github');
      provider = new GitHubProvider();
    } else if (providerName === 'stackoverflow') {
      const { StackOverflowProvider } = await import('./providers/stackoverflow');
      provider = new StackOverflowProvider();
    } else {
      const { TwitchProvider } = await import('./providers/twitch');
      provider = new TwitchProvider();
    }

    // 10. Fetch and normalize card data
    const data = await provider.fetch(id);

    // 11. Base64 encode the avatar url with strict host allowlist and payload size cap
    data.avatarUrl = await fetchAvatarBase64(data.avatarUrl, providerName);

    // 12. Render SVG output
    const svg = renderSvg(data, theme);
    return new Response(svg, { headers: responseHeaders });

  } catch (error) {
    let category: 'not_found' | 'unavailable' | 'rate_limited' = 'unavailable';
    let message = 'Erro de rede ou serviço indisponível.';

    if (error instanceof ProviderError) {
      category = error.category;
      message = error.message;
    } else if (error instanceof Error) {
      console.error('[Unhandled Error]', error);
      if (
        error.name === 'AbortError' ||
        error.name === 'TimeoutError' ||
        error.message.includes('timeout') ||
        error.message.includes('abort')
      ) {
        message = 'A solicitação para a API externa expirou (timeout).';
      } else {
        // Prevent arbitrary runtime exception messages from leaking to client
        message = 'Ocorreu um erro interno ao processar o cartão.';
      }
    } else {
      console.error('[Unhandled Unknown Error]', error);
    }

    const title = ERROR_TITLES[category];
    const responseStatus = ERROR_STATUSES[category];

    return new Response(renderErrorCard(title, message, theme), {
      status: responseStatus,
      headers: errorHeaders,
    });
  }
}
