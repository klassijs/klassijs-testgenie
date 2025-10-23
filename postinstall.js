const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  const packageDir = __dirname;

  // Check if we have a workspace configuration
  if (fs.existsSync(path.join(packageDir, 'pnpm-workspace.yaml'))) {
    // Check if frontend and backend node_modules already exist
    const frontendNodeModules = path.join(packageDir, 'frontend', 'node_modules');
    const backendNodeModules = path.join(packageDir, 'backend', 'node_modules');

    if (!fs.existsSync(frontendNodeModules) || !fs.existsSync(backendNodeModules)) {

      const pnpmProcess = spawn('pnpm', ['install'], {
        cwd: packageDir,
        stdio: 'inherit',
        shell: false
      });

      pnpmProcess.on('close', (code) => {
        if (code === 0) {
        } else {
          process.exit(code);
        }
      });

      pnpmProcess.on('error', (error) => {
        process.exit(1);
      });
    } else {
      // Workspace dependencies already installed, skipping...
    }
  } else {
    // No pnpm workspace found, skipping...
  }
} catch (error) {
  console.error('❌ Error in postinstall:', error.message);
  process.exit(1);
}
