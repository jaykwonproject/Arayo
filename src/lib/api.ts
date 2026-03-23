import type { ExtractRequest, ExtractResponse, ExtractError, HealthResponse } from '../types';

const BASE_URL = __DEV__
  ? 'http://10.20.172.30:8000'
  : 'https://korean-vocab-api.fly.dev';

// NOTE: For local dev on physical device, update the IP above to your Mac's WiFi IP.
// For production builds, the app uses the Fly.io URL.

class ApiError extends Error {
  constructor(
    public code: ExtractError['error'],
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function extractVocab(request: ExtractRequest): Promise<ExtractResponse> {
  const response = await fetch(`${BASE_URL}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const body = (await response.json()) as ExtractError;
    throw new ApiError(body.error, body.message, response.status);
  }

  return response.json() as Promise<ExtractResponse>;
}

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${BASE_URL}/health`);
  return response.json() as Promise<HealthResponse>;
}

export { ApiError };
