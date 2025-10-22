#!/usr/bin/env node

/**
 * Klassi-AI - AI-powered test automation platform
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
    console.log('🚀 Starting Klassi-AI development server...');
    return this.runCommand('dev');
  }

  /**
   * Start the production server
   */
  async start() {
    console.log('🚀 Starting Klassi-AI production server...');
    return this.runCommand('start');
  }

  /**
   * Build the application
   */
  async build() {
    console.log('🔨 Building Klassi-AI...');
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
        console.error(`❌ Error running klassi-ai:`, error);
        reject(error);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          console.error(`❌ klassi-ai exited with code ${code}`);
          reject(new Error(`Process exited with code ${code}`));
        } else {
          console.log(`✅ klassi-ai completed successfully`);
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
      console.log('Available commands: dev, start, build');
      process.exit(1);
  }
}
