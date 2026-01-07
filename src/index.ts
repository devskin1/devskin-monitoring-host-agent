#!/usr/bin/env node

import { HostAgent } from './agent';
import { ConfigLoader } from './config';
import * as path from 'path';
import * as fs from 'fs';

// Check Docker environment and warn if volumes not mounted
function checkDockerEnvironment() {
  const isDocker = fs.existsSync('/.dockerenv') ||
                   process.env.DEVSKIN_DOCKER_MODE === 'true';

  if (isDocker) {
    console.log('🐳 Docker environment detected');

    // With --pid=host and volume mounts, systeminformation will read host metrics
    if (!fs.existsSync('/proc/1/cgroup')) {
      console.warn('⚠️  Running in Docker without --pid=host!');
      console.warn('   Metrics may not be accurate. Use: docker run --pid=host ...');
    }
  }
}

function printUsage() {
  console.log(`
DevSkin Host Monitoring Agent

Usage:
  devskin-agent [options]

Options:
  --config <path>    Path to configuration file (default: ./config.json)
  --help            Show this help message

Example:
  devskin-agent --config /etc/devskin/config.json
  `);
}

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let configPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    if (arg === '--config' || arg === '-c') {
      configPath = args[i + 1];
      i++;
    }
  }

  try {
    // Check Docker environment
    checkDockerEnvironment();

    // Load configuration
    console.log('Loading configuration...');
    const config = ConfigLoader.load(configPath);

    // Create and start agent
    const agent = new HostAgent(config);

    // Handle shutdown signals
    let isShuttingDown = false;

    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      console.log(`\nReceived ${signal}, shutting down gracefully...`);

      try {
        await agent.stop();
        console.log('Shutdown complete');
        process.exit(0);
      } catch (error: any) {
        console.error(`Error during shutdown: ${error.message}`);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });

    // Start agent
    await agent.start();

    console.log('Agent is running. Press Ctrl+C to stop.');
  } catch (error: any) {
    console.error('Failed to start agent:', error.message);
    process.exit(1);
  }
}

main();
