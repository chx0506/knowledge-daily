import { mockProvider } from "./mock-provider";
import type { ContentProvider } from "./types";

const providers = new Map<string, ContentProvider>([[mockProvider.id, mockProvider]]);

export function registerProvider(provider: ContentProvider): void {
  providers.set(provider.id, provider);
}

export function listProviders(): ContentProvider[] {
  return [...providers.values()];
}
