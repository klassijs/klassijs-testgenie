const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Running klassijs-ai postinstall...');

try {
  const packageDir = __dirname;
  console.log('Package directory:', packageDir);

  if (fs.existsSync(path.join(packageDir, 'pnpm-workspace.yaml'))) {
    // Check if key dependencies are missing
    const frontendMissing = !fs.existsSync(path.join(packageDir, 'frontend', 'node_modules', 'react-dev-utils'));
    const backendMissing = !fs.existsSync(path.join(packageDir, 'backend', 'node_modules', 'chokidar'));

    if (frontendMissing || backendMissing) {
      console.log('Installing missing workspace dependencies...');

      const pnpmProcess = spawn('pnpm', ['install'], {
        cwd: packageDir,
        stdio: 'inherit',
        shell: false
      });

      pnpmProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ klassijs-ai dependencies installed successfully!');
        } else {
          console.error('❌ pnpm install failed with code:', code);
          process.exit(code);
        }
      });

      pnpmProcess.on('error', (error) => {
        console.error('❌ Error running pnpm install:', error.message);
        process.exit(1);
      });
    } else {
      console.log('✅ Dependencies already installed, skipping installation...');
    }
  } else {
    console.log('No pnpm workspace found, skipping...');
  }
} catch (error) {
  console.error('❌ Error in postinstall:', error.message);
  process.exit(1);
}
