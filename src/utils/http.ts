/**
 * Allowed avatar hosts per provider to prevent SSRF and internal network scanning.
 */
export function isAllowedAvatarHost(hostname: string, provider: string): boolean {
  const host = hostname.toLowerCase();
  if (provider === 'github') {
    return host === 'avatars.githubusercontent.com';
  }
  if (provider === 'stackoverflow') {
    return (
      host === 'sstatic.net' ||
      host.endsWith('.sstatic.net') ||
      host === 'gravatar.com' ||
      host.endsWith('.gravatar.com')
    );
  }
  if (provider === 'twitch') {
    return host === 'static-cdn.jtvnw.net' || host.endsWith('.static-cdn.jtvnw.net');
  }
  return false;
}

// Apenas formatos raster. 'image/svg+xml' fica de fora de propósito: nenhum dos
// hosts permitidos serve avatar em SVG, e aceitá-lo embutiria markup de terceiro
// dentro do SVG que o serviço publica.
export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const MAX_AVATAR_BYTES = 512 * 1024; // 512 KB

/**
 * Performs a fetch request bounded by a timeout controller and an optional byte size limit.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 5000,
  maxBytes?: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (init?.signal) {
    init.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    if (!response.body) return response;

    const contentLength = response.headers.get('content-length');
    if (maxBytes && contentLength) {
      const length = parseInt(contentLength, 10);
      if (Number.isFinite(length) && length > maxBytes) {
        controller.abort();
        throw new Error(`Response size exceeds limit of ${maxBytes} bytes`);
      }
    }

    if (typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (maxBytes && totalBytes > maxBytes) {
            await reader.cancel().catch(() => {});
            controller.abort();
            throw new Error(`Response stream size exceeds limit of ${maxBytes} bytes`);
          }
          chunks.push(value);
        }
      }

      const combined = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
      }

      return new Response(combined, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    const body = await response.arrayBuffer();
    if (maxBytes && body.byteLength > maxBytes) {
      controller.abort();
      throw new Error(`Response size exceeds limit of ${maxBytes} bytes`);
    }

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Converts an ArrayBuffer to a Base64-encoded string safely and efficiently.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  const uint8 = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Fetches an avatar from an HTTPS URL and encodes it as a base64 Data URI.
 * Enforces strict destination host allowlist per provider, bounds HTTP redirects,
 * imposes a 512 KB payload size ceiling, and validates image MIME types against
 * an allowlist before embedding in SVG.
 */
export async function fetchAvatarBase64(url: string, provider: string): Promise<string> {
  if (!url || typeof url !== 'string' || !url.startsWith('https://')) return '';

  let currentUrl = url;
  const maxRedirects = 3;

  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      let parsed: URL;
      try {
        parsed = new URL(currentUrl);
      } catch {
        return '';
      }

      if (parsed.protocol !== 'https:') return '';
      if (!isAllowedAvatarHost(parsed.hostname, provider)) return '';

      const res = await fetchWithTimeout(
        currentUrl,
        { redirect: 'manual' },
        5000,
        MAX_AVATAR_BYTES
      );

      // Revalidate host after each manual redirect jump
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location || hop === maxRedirects) return '';
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }

      if (!res.ok) return '';

      const rawContentType = res.headers.get('content-type') || '';
      const contentType = rawContentType.split(';')[0].trim().toLowerCase();
      if (!ALLOWED_IMAGE_MIME_TYPES.has(contentType)) {
        return '';
      }

      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_AVATAR_BYTES) {
        return '';
      }

      const base64 = arrayBufferToBase64(arrayBuffer);
      return `data:${contentType};base64,${base64}`;
    }
    return '';
  } catch {
    return '';
  }
}
