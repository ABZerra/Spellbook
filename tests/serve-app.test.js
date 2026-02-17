import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        if (!port) {
          reject(new Error('Unable to allocate port'));
          return;
        }
        resolve(port);
      });
    });
  });
}

function startServeApp(port) {
  const proc = spawn(process.execPath, ['scripts/serve-app.mjs'], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return new Promise((resolve, reject) => {
    let stderr = '';
    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Timed out waiting for serve-app startup. stderr: ${stderr}`));
    }, 20_000);

    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    proc.stdout.on('data', (chunk) => {
      if (chunk.includes('Spellbook UI listening on')) {
        clearTimeout(timeout);
        resolve(proc);
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`serve-app exited early with code ${code}. stderr: ${stderr}`));
    });
  });
}

test('serve-app exposes integrated API health/config endpoints', async () => {
  const port = await getFreePort();
  const proc = await startServeApp(port);

  try {
    const healthResponse = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(healthResponse.status, 200);
    const health = await healthResponse.json();
    assert.equal(health.ok, true);
    assert.equal(typeof health.totalSpells, 'number');

    const configResponse = await fetch(`http://127.0.0.1:${port}/api/config`);
    assert.equal(configResponse.status, 200);
    const config = await configResponse.json();
    assert.equal(typeof config.characterId, 'string');
    assert.equal(typeof config.remotePendingPlanEnabled, 'boolean');
  } finally {
    proc.kill('SIGTERM');
  }
});
