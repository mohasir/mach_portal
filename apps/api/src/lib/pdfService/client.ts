import { env } from '../../env';
import type { QuotePdfRequest, QuotePdfResponse } from './types';

export async function generateQuotePdf(payload: QuotePdfRequest): Promise<QuotePdfResponse> {
  let res: Response;
  try {
    res = await fetch(env.PDF_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': env.PDF_SERVICE_API_KEY },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new Error(`pdf service request failed: ${(err as Error).message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`pdf service responded ${res.status}: ${body}`);
  }

  return res.json();
}
