const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔧 Running klassijs-ai postinstall...');

try {
  const packageDir = __dirname;
  console.log('Package directory:', packageDir);

  if (fs.existsSync(path.join(packageDir, 'pnpm-workspace.yaml'))) {
    console.log('Found pnpm workspace, installing dependencies...');

    // Use spawn instead of execSync to avoid shell issues
    const { spawn } = require('child_process');

    const pnpmProcess = spawn('pnpm', ['install'], {
      cwd: packageDir,
      stdio: 'inherit',
      shell: false  // Don't use shell, run pnpm directly
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
    console.log('No pnpm workspace found, skipping...');
  }
} catch (error) {
  console.error('❌ Error in postinstall:', error.message);
  process.exit(1);
}
