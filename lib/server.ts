import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { answerSchema, evaluatorInstructions, feedbackSchema, makeReport, validateFeedback } from './evaluation';
import { getQuestion } from './questions';

export type AppEnv = {
  ELEVENLABS_API_KEY?: string; ELEVENLABS_AGENT_ID?: string;
  OPENAI_API_KEY?: string; OPENAI_MODEL?: string; DEMO_ACCESS_CODE?: string;
};
export function capabilities(env: AppEnv) {
  const gated = (env.DEMO_ACCESS_CODE?.length ?? 0) >= 24;
  return {
    voice: gated && !!env.ELEVENLABS_API_KEY && !!env.ELEVENLABS_AGENT_ID,
    evaluation: gated && !!env.OPENAI_API_KEY,
  };
}
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  } });
}
// Small private demos only: this limit is per isolate, not a distributed quota.
export class RateLimiter {
  private buckets = new Map<string, { count: number; until: number }>();
  constructor(private limit = 20, private window = 600_000, private now = () => Date.now()) {}
  take(key: string) {
    const now = this.now();
    for (const [id, bucket] of this.buckets) if (bucket.until <= now) this.buckets.delete(id);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= 1000) throw new HttpError(429, 'Demo is busy. Please try again later.');
      bucket = { count: 0, until: now + this.window };
      this.buckets.set(key, bucket);
    }
    if (++bucket.count > this.limit) throw new HttpError(429, 'Too many requests. Try again in ten minutes.');
  }
}
const limiter = new RateLimiter();
async function sameSecret(actual: string, expected: string) {
  const hash = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([hash(actual), hash(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
async function guard(request: Request, env: AppEnv, limit: RateLimiter) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new HttpError(403, 'Use this app to start a session.');
  }
  limit.take(request.headers.get('cf-connecting-ip') || 'local');
  if (!env.DEMO_ACCESS_CODE || env.DEMO_ACCESS_CODE.length < 24) throw new HttpError(503, 'Live mode has not been configured. You can explore the sample.');
  const code = request.headers.get('x-demo-access-code') || '';
  if (code.length > 256 || !await sameSecret(code, env.DEMO_ACCESS_CODE)) throw new HttpError(401, 'Check your live access code.');
}
export async function readJson(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Send JSON.');
  if (Number(request.headers.get('content-length')) > 32_000) throw new HttpError(413, 'Answer is too large.');
  if (!request.body) throw new HttpError(400, 'Request body is missing.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 32_000) { await reader.cancel(); throw new HttpError(413, 'Answer is too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown; }
  catch { throw new HttpError(400, 'Request is not valid JSON.'); }
}
function failure(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError) return json({ error: 'Check the question, consent and answer length (40–6,000 characters).' }, 400);
  // Never forward vendor bodies, SDK errors, signed URLs or credentials.
  return json({ error: 'The provider could not complete this request. Your draft is still here. Please retry.' }, 502);
}
export async function handleEvaluation(request: Request, env: AppEnv, fetchImpl: typeof fetch = fetch, limit = limiter) {
  try {
    await guard(request, env, limit);
    const input = answerSchema.parse(await readJson(request));
    if (!env.OPENAI_API_KEY) throw new HttpError(503, 'AI feedback is not configured. Explore the sample feedback.');
    const question = getQuestion(input.questionId)!;
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, fetch: fetchImpl, maxRetries: 0, timeout: 30_000 });
    const response = await client.responses.parse({
      model: env.OPENAI_MODEL || 'gpt-4.1-mini-2025-04-14', store: false, max_output_tokens: 2800,
      input: [
        { role: 'system', content: evaluatorInstructions },
        { role: 'user', content: JSON.stringify({ question: question.question, focus: question.focus, role: question.role, candidateAnswer: input.answer }) },
      ],
      text: { format: zodTextFormat(feedbackSchema, 'interview_feedback') },
    }).catch(() => { throw new HttpError(502, 'The provider could not complete this request. Your draft is still here. Please retry.'); });
    if (response.status !== 'completed' || !response.output_parsed) throw new HttpError(502, 'The evaluator could not produce complete feedback. Please try again.');
    let checked;
    try { checked = validateFeedback(response.output_parsed, input.answer); }
    catch { throw new HttpError(502, 'The feedback failed its evidence checks. Please try again.'); }
    return json(makeReport(checked, response.model));
  } catch (error) { return failure(error); }
}
const sessionSchema = z.object({
  questionId: z.string().max(80).refine(id => !!getQuestion(id)),
  consent: z.literal(true),
}).strict();
export async function handleSession(request: Request, env: AppEnv, fetchImpl: typeof fetch = fetch, limit = limiter) {
  try {
    await guard(request, env, limit);
    const input = sessionSchema.parse(await readJson(request));
    if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_AGENT_ID) throw new HttpError(503, 'Voice is not configured. You can type your answer.');
    const url = new URL('https://api.elevenlabs.io/v1/convai/conversation/get-signed-url');
    url.searchParams.set('agent_id', env.ELEVENLABS_AGENT_ID);
    const response = await fetchImpl(url, {
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('Voice provider error');
    const body = await response.json() as { signed_url?: unknown };
    if (typeof body.signed_url !== 'string') throw new Error('Missing signed URL');
    const signed = new URL(body.signed_url);
    if (signed.protocol !== 'wss:' || signed.hostname !== 'api.elevenlabs.io') throw new Error('Unexpected signed URL');
    const question = getQuestion(input.questionId)!;
    return json({ signedUrl: body.signed_url, dynamicVariables: {
      interview_role: question.role, interview_question: question.question, interview_focus: question.focus,
    } });
  } catch (error) { return failure(error); }
}
