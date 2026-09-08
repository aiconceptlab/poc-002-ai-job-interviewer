import { env } from 'cloudflare:workers';
import { handleSession, type AppEnv } from '@/lib/server';
export function POST(request: Request) { return handleSession(request, env as AppEnv); }
