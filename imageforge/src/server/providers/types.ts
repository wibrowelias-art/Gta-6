import type { AspectRatio, ProviderId } from "@/server/settings/schema";

export type GenerateRequest = {
  prompt: string;
  negativePrompt?: string | null;
  aspectRatio: AspectRatio;
  count: number;
  model: string; // provider-local model id, e.g. "gpt-image-1"
  signal: AbortSignal;
};

export type GeneratedImage = { data: Buffer; mime: string };

export type GenerateResult = {
  images: GeneratedImage[];
  revisedPrompt?: string | null;
  seed?: string | null;
  model: string;
};

export interface ImageProvider {
  id: ProviderId;
  label: string;
  /** Known model ids for the developer UI. Others can be added in settings. */
  knownModels: string[];
  isConfigured(): boolean;
  generate(req: GenerateRequest): Promise<GenerateResult>;
}

export class ProviderError extends Error {
  constructor(public provider: ProviderId, public code: string, message: string, public retryable = true) {
    super(message);
  }
}
