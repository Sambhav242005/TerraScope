import type { LocalModelConfig } from './llmAdapter.ts';

/** Dedicated loopback server; never silently substitutes a cloud model. */
export const LOCAL_MODEL_PRESET: Readonly<LocalModelConfig> = {
  baseUrl: 'http://127.0.0.1:11435', model: 'lfm3:1.7b',
};

export function requireLoopback(config: LocalModelConfig): void {
  const url = new URL(config.baseUrl);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Local planning requires a loopback endpoint without embedded credentials.');
  }
  if (config.model !== LOCAL_MODEL_PRESET.model) throw new Error('Local planning requires the requested lfm3:1.7b model.');
}
