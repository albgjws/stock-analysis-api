// Terminate old node processes
const { execSync } = require('child_process');
const currentPid = process.pid;

try {
  const output = execSync('wmic process where "name=\'node.exe\'" get ProcessId /FORMAT:CSV', { encoding: 'utf8' });
  const lines = output.trim().split('\n').filter(l => l.trim());
  for (const line of lines) {
    if (line.includes('Node')) continue;
    const parts = line.split(',');
    if (parts.length < 2) continue;
    const pid = parseInt(parts[1].trim());
    if (pid && pid !== currentPid) {
      try { process.kill(pid, 'SIGKILL'); console.log('Stopped pid ' + pid); }
      catch (e) { /* already gone */ }
    }
  }
} catch (e) {
  console.log('No other node processes');
}
console.log('Done');
