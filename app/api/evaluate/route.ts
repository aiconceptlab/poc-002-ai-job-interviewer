import { env } from 'cloudflare:workers';
import { handleEvaluation, type AppEnv } from '@/lib/server';
export function POST(request: Request) { return handleEvaluation(request, env as AppEnv); }
