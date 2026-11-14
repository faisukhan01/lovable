import { NextResponse } from 'next/server';
import { spawn, execFile } from 'child_process';
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
 *
 * Self-healing, part 2: sandbox resets can wipe pip-installed packages from
 * the shared venv (this exact bug once killed the backend with
 * "ModuleNotFoundError: No module named 'sqlalchemy'" and every "Build it"
 * click showed "Something went wrong"). If the FastAPI port is down we now
 * verify the Python deps first, reinstall them in the background when
 * missing, and only then boot uvicorn.
 */

const VENV_PY = '/home/z/.venv/bin/python';
const VENV_PIP = '/home/z/.venv/bin/pip';
const API_DIR = '/home/z/my-project/mini-services/api';

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

/** Cheap probe: are the backend's Python dependencies importable? */
function depsOk(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      VENV_PY,
      ['-c', 'import sqlalchemy, fastapi, jose, passlib'],
      { timeout: 15000 },
      (err) => resolve(!err)
    );
  });
}

/**
 * Reinstall backend requirements, then boot uvicorn once the install
 * finishes. Fire-and-forget — the next keeper ping picks the service up.
 */
function installDepsThenBoot(logFile: string): void {
  const out = fs.openSync(logFile, 'a');
  fs.appendFileSync(logFile, `\n[boot-services] ${new Date().toISOString()} python deps missing — reinstalling requirements.txt\n`);
  const pip = spawn(VENV_PIP, ['install', '-r', 'requirements.txt'], {
    cwd: API_DIR,
    stdio: ['ignore', out, out],
    env: process.env,
  });
  pip.on('close', (code) => {
    fs.appendFileSync(logFile, `[boot-services] pip install exited with ${code}; booting uvicorn\n`);
    spawnService(API_DIR, '/home/z/.venv/bin/uvicorn', ['index:app', '--host', '0.0.0.0', '--port', '8000'], logFile);
  });
  pip.on('error', () => {
    // pip itself failed to launch — still try uvicorn so the failure is at least visible in the log
    spawnService(API_DIR, '/home/z/.venv/bin/uvicorn', ['index:app', '--host', '0.0.0.0', '--port', '8000'], logFile);
  });
  pip.unref();
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
  } else if (await depsOk()) {
    spawnService(
      API_DIR,
      '/home/z/.venv/bin/uvicorn',
      ['index:app', '--host', '0.0.0.0', '--port', '8000'],
      '/home/z/my-project/api-service.log'
    );
    services.api = 'starting';
  } else {
    // Sandbox reset wiped the venv — reinstall first, then boot (self-healing).
    installDepsThenBoot('/home/z/my-project/api-service.log');
    services.api = 'installing-deps';
  }

  return NextResponse.json({ ok: true, services, ts: Date.now() });
}
