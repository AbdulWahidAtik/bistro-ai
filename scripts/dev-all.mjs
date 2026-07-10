import { exec } from 'node:child_process';
import net from 'node:net';

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

const commands = [
  { name: 'api', port: 3001, command: `${npmCommand} run dev:api` },
  { name: 'web', port: 3000, command: `${npmCommand} run dev` },
];

let isShuttingDown = false;
const children = [];

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    socket.setTimeout(500);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => resolve(false));
  });
}

function startProcess({ name, command }) {
  const child = exec(command, {
    cwd: process.cwd(),
    windowsHide: true,
  });

  child.stdout?.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr?.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on('exit', (code, signal) => {
    if (isShuttingDown || signal || code === 0) return;
    console.error(`[${name}] exited with code ${code}`);
    shutdown(code || 1);
  });

  children.push(child);
}

function shutdown(code = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  for (const child of children) {
    child.kill();
  }

  setTimeout(() => process.exit(code), 250);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('Bistro AI dev servers starting...');
console.log('Frontend: http://127.0.0.1:3000');
console.log('Backend:  http://localhost:3001');

for (const command of commands) {
  if (await isPortOpen(command.port)) {
    console.log(`[${command.name}] port ${command.port} is already running; reusing it.`);
    continue;
  }
  startProcess(command);
}

if (children.length === 0) {
  console.log('Both dev servers are already running.');
}
