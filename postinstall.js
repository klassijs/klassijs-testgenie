const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Running klassijs-ai postinstall...');

try {
  const packageDir = __dirname;
  console.log('Package directory:', packageDir);

  // Check if we have a workspace configuration
  if (fs.existsSync(path.join(packageDir, 'pnpm-workspace.yaml'))) {
    // Check if frontend and backend node_modules already exist
    const frontendNodeModules = path.join(packageDir, 'frontend', 'node_modules');
    const backendNodeModules = path.join(packageDir, 'backend', 'node_modules');

    if (!fs.existsSync(frontendNodeModules) || !fs.existsSync(backendNodeModules)) {
      console.log('Installing workspace dependencies...');

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
      console.log('✅ Workspace dependencies already installed, skipping...');
    }
  } else {
    console.log('No pnpm workspace found, skipping...');
  }
} catch (error) {
  console.error('❌ Error in postinstall:', error.message);
  process.exit(1);
}
