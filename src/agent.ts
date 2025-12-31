import * as os from 'os';
import { AgentConfig } from './config';
import { ApiClient, MetricData } from './api-client';
import * as winston from 'winston';
import { BaseCollector } from './collectors/base.collector';
import { CpuCollector } from './collectors/cpu.collector';
import { MemoryCollector } from './collectors/memory.collector';
import { DiskCollector } from './collectors/disk.collector';
import { NetworkCollector } from './collectors/network.collector';
import { LoadCollector } from './collectors/load.collector';

export class HostAgent {
  private config: AgentConfig;
  private apiClient: ApiClient;
  private logger: winston.Logger;
  private resourceId?: string;
  private collectionTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private metricBuffer: MetricData[] = [];
  private isRunning = false;
  private collectors: BaseCollector[] = [];

  constructor(config: AgentConfig) {
    this.config = config;
    this.apiClient = new ApiClient(config);
    this.logger = this.createLogger();
    this.initializeCollectors();
  }

  /**
   * Initialize metric collectors
   */
  private initializeCollectors(): void {
    this.collectors = [
      new CpuCollector(),
      new MemoryCollector(),
      new DiskCollector(),
      new NetworkCollector(),
      new LoadCollector(),
    ];

    this.logger.info(`Initialized ${this.collectors.length} collectors: ${this.collectors.map(c => c.getName()).join(', ')}`);
  }

  /**
   * Create Winston logger
   */
  private createLogger(): winston.Logger {
    return winston.createLogger({
      level: this.config.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level.toUpperCase()}] ${message}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: 'devskin-agent.log',
          maxsize: 10485760, // 10MB
          maxFiles: 5,
        }),
      ],
    });
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    try {
      this.logger.info('Starting DevSkin Host Agent...');

      // Register or verify host
      await this.registerHost();

      // Start collection loop
      this.isRunning = true;
      this.startCollectionLoop();
      this.startHeartbeatLoop();

      this.logger.info('Agent started successfully');
    } catch (error: any) {
      this.logger.error(`Failed to start agent: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping agent...');
    this.isRunning = false;

    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    // Flush remaining metrics
    if (this.metricBuffer.length > 0 && this.resourceId) {
      await this.flushMetrics();
    }

    this.logger.info('Agent stopped');
  }

  /**
   * Register host with backend
   */
  private async registerHost(): Promise<void> {
    if (this.config.resourceId && this.config.resourceId !== 'auto-generate-on-first-run') {
      this.resourceId = this.config.resourceId;
      this.logger.info(`Using existing resource ID: ${this.resourceId}`);
      return;
    }

    const hostname = this.config.hostname === 'auto-detect'
      ? os.hostname()
      : this.config.hostname || os.hostname();

    const networkInterfaces = os.networkInterfaces();
    let ipAddress: string | undefined;

    // Find first non-internal IPv4 address
    for (const iface of Object.values(networkInterfaces)) {
      if (iface) {
        for (const addr of iface) {
          if (addr.family === 'IPv4' && !addr.internal) {
            ipAddress = addr.address;
            break;
          }
        }
      }
      if (ipAddress) break;
    }

    this.logger.info(`Registering host: ${hostname}`);

    this.resourceId = await this.apiClient.registerHost({
      hostname,
      ip_address: ipAddress,
      os: `${os.type()} ${os.release()}`,
      os_version: os.version(),
      metadata: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        total_memory: os.totalmem(),
      },
    });

    this.logger.info(`Host registered with ID: ${this.resourceId}`);

    // Save resource ID to config
    this.config.resourceId = this.resourceId;
  }

  /**
   * Start metric collection loop
   */
  private startCollectionLoop(): void {
    // Collect immediately
    this.collectMetrics();

    // Then collect at intervals
    this.collectionTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.collectionInterval);
  }

  /**
   * Start heartbeat loop
   */
  private startHeartbeatLoop(): void {
    // Send heartbeat every 30 seconds
    this.heartbeatTimer = setInterval(async () => {
      if (this.resourceId) {
        try {
          await this.apiClient.sendHeartbeat(this.resourceId);
          this.logger.debug('Heartbeat sent');
        } catch (error: any) {
          this.logger.error(`Failed to send heartbeat: ${error.message}`);
        }
      }
    }, 30000);
  }

  /**
   * Collect metrics from all enabled collectors
   */
  private async collectMetrics(): Promise<void> {
    if (!this.resourceId) {
      this.logger.warn('Cannot collect metrics: resource not registered');
      return;
    }

    try {
      const metric: MetricData = {
        timestamp: new Date(),
      };

      // Collect metrics from all enabled collectors
      const collectionPromises = this.collectors
        .filter(collector => collector.isEnabled())
        .map(async (collector) => {
          try {
            const collectorMetrics = await collector.collect();
            return { collector: collector.getName(), metrics: collectorMetrics };
          } catch (error: any) {
            this.logger.error(`Failed to collect from ${collector.getName()}: ${error.message}`);
            return { collector: collector.getName(), metrics: {} };
          }
        });

      const results = await Promise.all(collectionPromises);

      // Aggregate all metrics into one object
      results.forEach(({ collector, metrics }) => {
        Object.assign(metric, metrics);
      });

      this.logger.debug(`Collected metrics from ${results.length} collectors`);

      this.metricBuffer.push(metric);

      // Flush if buffer is full
      if (this.metricBuffer.length >= this.config.batchSize) {
        await this.flushMetrics();
      }
    } catch (error: any) {
      this.logger.error(`Failed to collect metrics: ${error.message}`);
    }
  }

  /**
   * Flush metrics buffer to API
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricBuffer.length === 0 || !this.resourceId) {
      return;
    }

    const metricsToSend = [...this.metricBuffer];
    this.metricBuffer = [];

    try {
      await this.apiClient.sendMetrics(this.resourceId, metricsToSend);
      this.logger.debug(`Sent ${metricsToSend.length} metrics`);
    } catch (error: any) {
      this.logger.error(`Failed to send metrics: ${error.message}`);
      // Put metrics back in buffer
      this.metricBuffer.unshift(...metricsToSend);
    }
  }
}
