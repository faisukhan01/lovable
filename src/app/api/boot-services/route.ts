import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import net from 'net';
import fs from 'fs';

/**
 * Service keeper: spawns the Lovify backend services (FastAPI :8000 and the
 * Z.AI brain :8001) as children of the long-lived Next.js server process.
 *
 * Background processes spawned from one-shot tool shells get reaped in this
 * sandbox, but children of the persistent Next.js server survive. The
 * platform's /start.sh also auto-starts mini-services on cold boots — this
 * route guarantees they are up in the current session, self-healing on every
 * app load (the frontend pings this endpoint once on mount).
 */

function isUp(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(900);
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.once('timeout', () => done(false));
  });
}

function spawnService(cwd: string, cmd: string, args: string[], logFile: string): number | null {
  try {
    const out = fs.openSync(logFile, 'a');
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', out, out], env: process.env });
    child.unref();
    return child.pid ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const services: Record<string, string> = {};

  // Z.AI brain service (port 8001)
  if (await isUp(8001)) {
    services.aiBrain = 'running';
  } else {
    spawnService(
      '/home/z/my-project/mini-services/ai-service',
      'bun',
      ['run', 'dev'],
      '/home/z/my-project/ai-service.log'
    );
    services.aiBrain = 'starting';
  }

  // FastAPI main backend (port 8000)
  if (await isUp(8000)) {
    services.api = 'running';
  } else {
    spawnService(
      '/home/z/my-project/mini-services/api',
      '/home/z/.venv/bin/uvicorn',
      ['index:app', '--host', '0.0.0.0', '--port', '8000'],
      '/home/z/my-project/api-service.log'
    );
    services.api = 'starting';
  }

  return NextResponse.json({ ok: true, services, ts: Date.now() });
}
