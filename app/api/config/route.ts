import { env } from 'cloudflare:workers';
import { capabilities, json, type AppEnv } from '@/lib/server';
export function GET() { return json(capabilities(env as AppEnv)); }
