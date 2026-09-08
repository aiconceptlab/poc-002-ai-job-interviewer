import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
const args = ['node_modules/wrangler/bin/wrangler.js', 'dev', '--config', 'dist/server/wrangler.json', '--ip', '127.0.0.1', '--port', '3002'];
// Wrangler resolves env files relative to its built config, so use an absolute path.
if (existsSync('.dev.vars')) args.push('--env-file', resolve('.dev.vars'));
args.push(...process.argv.slice(2));
const child = spawn(process.execPath, args, { stdio: 'inherit', env: { ...process.env, WRANGLER_WRITE_LOGS: 'false' } });
child.on('exit', code => process.exit(code ?? 1));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
