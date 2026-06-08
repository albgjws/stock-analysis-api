// Kill all node.exe processes except current one
const { execSync } = require('child_process');
const os = require('os');

const currentPid = process.pid;
console.log(`Current PID: ${currentPid}`);

try {
  const output = execSync('wmic process where "name=\'node.exe\'" get ProcessId,CommandLine /FORMAT:CSV', { encoding: 'utf8' });
  const lines = output.trim().split('\n').filter(l => l.trim());

  for (const line of lines) {
    if (line.startsWith('Node')) continue; // skip header
    const parts = line.split(',');
    if (parts.length < 2) continue;
    const pid = parseInt(parts[1].trim());
    if (pid && pid !== currentPid) {
      try {
        process.kill(pid, 'SIGKILL');
        console.log(`Killed process ${pid}`);
      } catch (e) {
        console.log(`Process ${pid} already gone or access denied`);
      }
    }
  }
} catch (e) {
  console.log('No node processes found or wmic not available');
}

console.log('Done killing node processes');
