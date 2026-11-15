import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET_DIR = path.resolve(__dirname, '..');

console.log(`🚀 Starting Vite preview server in ${TARGET_DIR}...`);
const viteBin = path.join(TARGET_DIR, 'node_modules', '.bin', 'vite.cmd');

let detectedPort = null;

const preview = spawn(viteBin, ['preview', '--port', '5173'], {
  cwd: TARGET_DIR,
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,
});

preview.stdout.on('data', (d) => {
  const str = d.toString();
  process.stdout.write(`[preview] ${str}`);
  const clean = str.replace(/\x1b\[[0-9;]*m/g, '');
  const match = clean.match(/localhost:(\d+)/);
  if (match) {
    detectedPort = parseInt(match[1], 10);
  }
});

preview.stderr.on('data', (d) => process.stderr.write(`[preview err] ${d}`));

function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function ping() {
      const port = detectedPort || 5174;
      const url = `http://localhost:${port}`;
      http.get(url, (res) => {
        if (res.statusCode) {
          detectedPort = port;
          resolve(port);
        } else {
          setTimeout(ping, 500);
        }
      }).on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server did not respond on port ${port} within ${timeoutMs}ms`));
        } else {
          setTimeout(ping, 500);
        }
      });
    }
    setTimeout(ping, 1000);
  });
}

try {
  const port = await waitForServer();
  console.log(`✅ Server is ready on port ${port}. Running test suite...`);

  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const tests = spawn(npmBin, ['test'], {
    cwd: TARGET_DIR,
    stdio: 'inherit',
    shell: true,
    env: { 
      ...process.env, 
      PORT: String(port),
      TEST_BASE_URL: `http://localhost:${port}`,
    },
  });

  tests.on('exit', (code) => {
    console.log(`\n🏁 Test suite completed with exit code: ${code}`);
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', preview.pid.toString(), '/f', '/t'], { shell: true });
      } else {
        preview.kill();
      }
    } catch {
      // ignore
    }
    process.exit(code || 0);
  });
} catch (err) {
  console.error('❌ Failed starting test environment:', err.message);
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', preview.pid.toString(), '/f', '/t'], { shell: true });
    } else {
      preview.kill();
    }
  } catch {
    // ignore
  }
  process.exit(1);
}
