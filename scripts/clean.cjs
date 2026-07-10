const fs = require('node:fs');
const path = require('node:path');

const targets = ['dist', 'server.js'];

for (const target of targets) {
  const resolved = path.resolve(process.cwd(), target);
  fs.rmSync(resolved, { recursive: true, force: true });
}

console.log('Cleaned generated build artifacts.');
