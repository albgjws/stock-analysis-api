const { spawn, execSync } = require('child_process');
const path = require('path');

// Kill other node processes
try {
  const result = execSync('wmic process where "name=\'node.exe\'" get ProcessId /FORMAT:CSV', { encoding: 'utf8', timeout: 5000 });
  const lines = result.trim().split('\n').filter(l => l.trim());
  for (const line of lines) {
    if (line.includes('Node')) continue;
    const pid = parseInt(line.split(',')[1]?.trim());
    if (pid && pid !== process.pid) {
      try { process.kill(pid, 'SIGKILL'); console.log('Killed node process: ' + pid); }
      catch(e) { console.log('Could not kill ' + pid); }
    }
  }
} catch(e) { console.log('No other node processes found'); }

// Clear cache
const fs = require('fs');
const cacheDir = path.join(process.cwd(), 'node_modules', '.cache');
if (fs.existsSync(cacheDir)) {
  fs.rmSync(cacheDir, { recursive: true, force: true });
  console.log('Cache cleared');
}

// Start the dev server
console.log('Starting dev server...');
const server = spawn('npx.cmd', ['tsx', 'watch', 'server/index.ts'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true
});

server.stdout.on('data', (data) => {
  process.stdout.write(data.toString());
});

server.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

server.on('error', (err) => {
  console.error('Failed to start server:', err.message);
});

console.log('Server process started with PID: ' + server.pid);
