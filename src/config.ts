import * as fs from 'fs';
import * as path from 'path';

export interface CollectorConfig {
  enabled: boolean;
  [key: string]: any;
}

export interface AgentConfig {
  apiUrl: string;
  agentKey: string;
  tenantId: string;
  resourceId?: string;
  hostname?: string;
  collectionInterval: number;
  batchSize: number;
  retryAttempts: number;
  retryDelay: number;
  logLevel: string;
  collectors: {
    cpu: CollectorConfig;
    memory: CollectorConfig;
    disk: CollectorConfig & {
      mountPoints?: string[];
    };
    network: CollectorConfig & {
      interfaces?: string[];
    };
    process: CollectorConfig;
  };
}

export class ConfigLoader {
  static load(configPath?: string): AgentConfig {
    const defaultConfigPath = path.join(process.cwd(), 'config.json');
    const finalConfigPath = configPath || defaultConfigPath;

    if (!fs.existsSync(finalConfigPath)) {
      throw new Error(`Config file not found: ${finalConfigPath}`);
    }

    const configContent = fs.readFileSync(finalConfigPath, 'utf-8');
    const config: AgentConfig = JSON.parse(configContent);

    // Validate required fields
    if (!config.apiUrl) {
      throw new Error('apiUrl is required in config');
    }
    if (!config.agentKey) {
      throw new Error('agentKey is required in config');
    }
    if (!config.tenantId) {
      throw new Error('tenantId is required in config');
    }

    // Set defaults
    config.collectionInterval = config.collectionInterval || 60000;
    config.batchSize = config.batchSize || 10;
    config.retryAttempts = config.retryAttempts || 3;
    config.retryDelay = config.retryDelay || 5000;
    config.logLevel = config.logLevel || 'info';

    return config;
  }

  static save(config: AgentConfig, configPath?: string): void {
    const defaultConfigPath = path.join(process.cwd(), 'config.json');
    const finalConfigPath = configPath || defaultConfigPath;

    fs.writeFileSync(
      finalConfigPath,
      JSON.stringify(config, null, 2),
      'utf-8'
    );
  }
}
