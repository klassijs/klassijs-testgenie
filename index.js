#!/usr/bin/env node

/**
 * klassijs-testgenie - AI-powered test automation platform
 * Main entry point for the NPM package
 */

const { spawn } = require('child_process');
const path = require('path');

class KlassiAI {
  constructor() {
    this.packageDir = path.dirname(__dirname);
  }

  /**
   * Start the development server
   */
  async startDev() {
    return this.runCommand('dev');
  }

  /**
   * Start the production server
   */
  async start() {
    return this.runCommand('start');
  }

  /**
   * Build the application
   */
  async build() {
    return this.runCommand('build:all');
  }

  /**
   * Run a pnpm command
   */
  runCommand(command) {
    return new Promise((resolve, reject) => {
      const child = spawn('pnpm', [command], {
        stdio: 'inherit',
        shell: true,
        cwd: this.packageDir
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Process exited with code ${code}`));
        } else {
          resolve();
        }
      });
    });
  }
}

// Export for programmatic use
module.exports = KlassiAI;

// CLI functionality
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'dev';
  
  const klassiAI = new KlassiAI();
  
  switch (command) {
    case 'dev':
      klassiAI.startDev().catch(process.exit);
      break;
    case 'start':
      klassiAI.start().catch(process.exit);
      break;
    case 'build':
      klassiAI.build().catch(process.exit);
      break;
    default:
      process.exit(1);
  }
}
