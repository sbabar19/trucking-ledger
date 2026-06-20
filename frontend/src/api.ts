import type { TripPlanRequest, TripPlanResponse } from '@/types';

export async function planTrip(input: TripPlanRequest): Promise<TripPlanResponse> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/trips/plan/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return response.json() as Promise<TripPlanResponse>;
}

async function getErrorMessage(response: Response): Promise<string> {
  const fallback = `Trip planning failed (${response.status})`;

  try {
    const payload = (await response.json()) as unknown;
    return extractErrorMessage(payload) ?? fallback;
  } catch {
    return fallback;
  }
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const fields = payload as Record<string, unknown>;
  if (typeof fields.detail === 'string') {
    return fields.detail;
  }

  const [field, value] = Object.entries(fields)[0] ?? [];
  if (!field) {
    return null;
  }

  if (Array.isArray(value)) {
    return `${field}: ${value.join(', ')}`;
  }

  if (typeof value === 'string') {
    return `${field}: ${value}`;
  }

  return fallbackFieldMessage(field);
}

function fallbackFieldMessage(field: string): string {
  return `${field}: invalid value`;
}
