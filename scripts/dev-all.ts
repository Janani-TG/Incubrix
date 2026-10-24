import { spawn, ChildProcess } from 'child_process';
import path from 'path';

console.log('====================================================');
console.log('Starting IncuBrix Full-Stack Development Environment');
console.log('Backend:  http://localhost:3000 (Express API)');
console.log('Frontend: http://localhost:5173 (Vite + React Dashboard)');
console.log('====================================================\n');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const rootDir = process.cwd();
const frontendDir = path.join(rootDir, 'frontend');

// Spawn backend development process
const backendProcess: ChildProcess = spawn(npmCmd, ['run', 'dev'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: isWindows,
  env: { ...process.env, NODE_ENV: 'development' },
});

// Spawn frontend development process
const frontendProcess: ChildProcess = spawn(npmCmd, ['run', 'dev'], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: isWindows,
  env: { ...process.env },
});

const cleanup = (code = 0) => {
  console.log('\nShutting down development processes...');
  try {
    if (backendProcess && !backendProcess.killed) {
      if (isWindows && backendProcess.pid) {
        spawn('taskkill', ['/pid', backendProcess.pid.toString(), '/f', '/t']);
      } else {
        backendProcess.kill('SIGTERM');
      }
    }
  } catch {
    // Ignore error on exit
  }

  try {
    if (frontendProcess && !frontendProcess.killed) {
      if (isWindows && frontendProcess.pid) {
        spawn('taskkill', ['/pid', frontendProcess.pid.toString(), '/f', '/t']);
      } else {
        frontendProcess.kill('SIGTERM');
      }
    }
  } catch {
    // Ignore error on exit
  }

  process.exit(code);
};

process.on('SIGINT', () => cleanup(0));
process.on('SIGTERM', () => cleanup(0));

backendProcess.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Backend process exited with code ${code}`);
    cleanup(code);
  }
});

frontendProcess.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Frontend process exited with code ${code}`);
    cleanup(code);
  }
});
