/** Chromium hint; unsupported browsers ignore it and still enforce CORS. */
export function loopbackRequestOptions(baseUrl: string): RequestInit & { targetAddressSpace?: 'loopback' } {
  const host = new URL(baseUrl).hostname;
  return ['localhost', '127.0.0.1', '[::1]'].includes(host) ? { targetAddressSpace: 'loopback' } : {};
}
