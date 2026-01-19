import axios, { AxiosInstance, AxiosError } from 'axios';
import { AgentConfig } from './config';

export interface MetricData {
  timestamp: Date;
  cpu_usage_percent?: number;
  cpu_user_percent?: number;
  cpu_system_percent?: number;
  cpu_idle_percent?: number;
  memory_usage_percent?: number;
  memory_used_bytes?: number;
  memory_available_bytes?: number;
  memory_total_bytes?: number;
  disk_usage_percent?: number;
  disk_used_bytes?: number;
  disk_total_bytes?: number;
  disk_read_bytes?: number;
  disk_write_bytes?: number;
  disk_io_read_ops?: number;
  disk_io_write_ops?: number;
  network_rx_bytes?: number;
  network_tx_bytes?: number;
  network_rx_packets?: number;
  network_tx_packets?: number;
  network_rx_errors?: number;
  network_tx_errors?: number;
  load_avg_1m?: number;
  load_avg_5m?: number;
  load_avg_15m?: number;
}

export interface HostRegistrationData {
  hostname: string;
  ip_address?: string;
  os?: string;
  os_version?: string;
  metadata?: object;
}

export interface ContainerData {
  id: string;
  name: string;
  image: string;
  status: 'online' | 'offline' | 'degraded';
  state: string;
  ports: string[];
  restartCount: number;
  composeProject?: string;
  composeService?: string;
  labels: Record<string, string>;
}

export interface ProcessData {
  pid: number;
  ppid: number;
  name: string;
  command: string;
  path: string;
  user: string;
  state: 'running' | 'sleeping' | 'stopped' | 'zombie' | 'idle' | 'disk-sleep' | 'unknown';
  cpuPercent: number;
  memPercent: number;
  memRss: number;
  memVms: number;
  nice: number;
  started: Date | null;
  numThreads: number;
}

export class ApiClient {
  private client: AxiosInstance;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-DevSkin-Agent-Key': config.agentKey,
        'X-Tenant-ID': config.tenantId,
      },
    });
  }

  /**
   * Register host with the backend
   */
  async registerHost(data: HostRegistrationData): Promise<string> {
    try {
      const response = await this.retryRequest(() =>
        this.client.post('/api/infrastructure/hosts', {
          ...data,
          tenant_id: this.config.tenantId,
        })
      );

      return response.data.data.id;
    } catch (error) {
      throw this.handleError(error, 'Failed to register host');
    }
  }

  /**
   * Send metrics batch to the backend
   */
  async sendMetrics(resourceId: string, metrics: MetricData[]): Promise<void> {
    try {
      await this.retryRequest(() =>
        this.client.post('/api/infrastructure/metrics', {
          tenant_id: this.config.tenantId,
          resource_id: resourceId,
          metrics: metrics.map(m => ({
            ...m,
            timestamp: m.timestamp.toISOString(),
          })),
        })
      );
    } catch (error) {
      throw this.handleError(error, 'Failed to send metrics');
    }
  }

  /**
   * Send heartbeat to update host status
   */
  async sendHeartbeat(resourceId: string): Promise<void> {
    try {
      await this.retryRequest(() =>
        this.client.post('/api/infrastructure/heartbeat', {
          resource_id: resourceId,
          tenant_id: this.config.tenantId,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (error) {
      throw this.handleError(error, 'Failed to send heartbeat');
    }
  }

  /**
   * Send container data to backend
   */
  async sendContainers(hostId: string, hostname: string, containers: ContainerData[]): Promise<void> {
    try {
      await this.retryRequest(() =>
        this.client.post('/api/infrastructure/containers', {
          host_id: hostId,
          hostname: hostname,
          tenant_id: this.config.tenantId,
          containers: containers.map(c => ({
            container_id: c.id,
            name: c.name,
            image: c.image,
            status: c.status,
            state: c.state,
            ports: c.ports,
            restart_count: c.restartCount,
            compose_project: c.composeProject,
            compose_service: c.composeService,
            labels: c.labels,
          })),
        })
      );
    } catch (error) {
      throw this.handleError(error, 'Failed to send containers');
    }
  }

  /**
   * Send process data to backend
   */
  async sendProcesses(hostId: string, processes: ProcessData[]): Promise<void> {
    try {
      await this.retryRequest(() =>
        this.client.post('/api/infrastructure/processes', {
          host_id: hostId,
          tenant_id: this.config.tenantId,
          collected_at: new Date().toISOString(),
          processes: processes.map(p => ({
            pid: p.pid,
            ppid: p.ppid,
            name: p.name,
            command: p.command,
            exe_path: p.path,
            username: p.user,
            status: p.state,
            cpu_percent: p.cpuPercent,
            memory_percent: p.memPercent,
            memory_rss: p.memRss,
            memory_vms: p.memVms,
            nice: p.nice,
            started_at: p.started ? p.started.toISOString() : null,
            num_threads: p.numThreads,
          })),
        })
      );
    } catch (error) {
      throw this.handleError(error, 'Failed to send processes');
    }
  }

  /**
   * Retry request with exponential backoff
   */
  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error) {
      if (attempt >= this.config.retryAttempts) {
        throw error;
      }

      const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
      console.log(`Retry attempt ${attempt} after ${delay}ms...`);

      await this.sleep(delay);
      return this.retryRequest(requestFn, attempt + 1);
    }
  }

  /**
   * Handle API errors
   */
  private handleError(error: unknown, message: string): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        return new Error(
          `${message}: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`
        );
      } else if (axiosError.request) {
        return new Error(`${message}: No response received from server`);
      }
    }

    return new Error(`${message}: ${error}`);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
