import * as si from 'systeminformation';
import { BaseCollector, CollectorMetrics } from './base.collector';

export interface ProcessInfo {
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

/**
 * ProcessCollector - Collects information about running processes
 *
 * Uses systeminformation to gather detailed process data including:
 * - CPU and memory usage
 * - Process state and lifecycle
 * - Command line and path
 * - User ownership
 */
export class ProcessCollector extends BaseCollector {
  private topN: number;
  private collectAll: boolean;

  constructor(options?: { topN?: number; collectAll?: boolean }) {
    super();
    this.topN = options?.topN || 50;
    this.collectAll = options?.collectAll || false;
  }

  async collect(): Promise<CollectorMetrics> {
    const processes = await this.collectProcesses();

    return {
      process_count: processes.length,
      process_running_count: processes.filter(p => p.state === 'running').length,
      process_sleeping_count: processes.filter(p => p.state === 'sleeping').length,
      process_zombie_count: processes.filter(p => p.state === 'zombie').length,
    };
  }

  getName(): string {
    return 'process';
  }

  /**
   * Collect detailed process information
   * Returns top processes by CPU + memory or all processes if collectAll is true
   */
  async collectProcesses(): Promise<ProcessInfo[]> {
    try {
      const processes = await si.processes();
      let processList = processes.list;

      // If not collecting all, get top N by combined CPU + memory usage
      if (!this.collectAll && processList.length > this.topN) {
        processList = processList
          .sort((a, b) => (b.cpu + b.mem) - (a.cpu + a.mem))
          .slice(0, this.topN);
      }

      return processList.map(proc => ({
        pid: proc.pid,
        ppid: proc.parentPid || 0,
        name: proc.name || 'unknown',
        command: proc.command || '',
        path: proc.path || '',
        user: proc.user || '',
        state: this.normalizeState(proc.state),
        cpuPercent: Math.round(proc.cpu * 100) / 100,
        memPercent: Math.round(proc.mem * 100) / 100,
        memRss: proc.memRss * 1024 || 0,
        memVms: proc.memVsz * 1024 || 0,
        nice: proc.nice || 0,
        started: proc.started ? new Date(proc.started) : null,
        numThreads: 1,
      }));
    } catch (error) {
      console.error('Failed to collect processes:', error);
      return [];
    }
  }

  /**
   * Normalize process state to our standard format
   */
  private normalizeState(state: string): ProcessInfo['state'] {
    const stateLower = (state || '').toLowerCase();

    if (stateLower.includes('run')) return 'running';
    if (stateLower.includes('sleep') || stateLower === 's' || stateLower === 'interruptible') return 'sleeping';
    if (stateLower.includes('stop') || stateLower === 't') return 'stopped';
    if (stateLower.includes('zombie') || stateLower === 'z') return 'zombie';
    if (stateLower.includes('idle') || stateLower === 'i') return 'idle';
    if (stateLower.includes('disk') || stateLower === 'd' || stateLower === 'uninterruptible') return 'disk-sleep';

    return 'unknown';
  }

  /**
   * Get processes matching a pattern
   */
  async findProcesses(pattern: string, matchType: 'exact' | 'contains' | 'regex' = 'contains'): Promise<ProcessInfo[]> {
    const processes = await this.collectProcesses();

    return processes.filter(proc => {
      const searchStr = `${proc.name} ${proc.command}`.toLowerCase();
      const patternLower = pattern.toLowerCase();

      switch (matchType) {
        case 'exact':
          return proc.name.toLowerCase() === patternLower;
        case 'contains':
          return searchStr.includes(patternLower);
        case 'regex':
          try {
            const regex = new RegExp(pattern, 'i');
            return regex.test(searchStr);
          } catch {
            return false;
          }
        default:
          return false;
      }
    });
  }

  /**
   * Get process by PID
   */
  async getProcess(pid: number): Promise<ProcessInfo | null> {
    const processes = await this.collectProcesses();
    return processes.find(p => p.pid === pid) || null;
  }

  /**
   * Get top N processes by CPU usage
   */
  async getTopByCpu(n: number = 10): Promise<ProcessInfo[]> {
    const processes = await this.collectProcesses();
    return processes
      .sort((a, b) => b.cpuPercent - a.cpuPercent)
      .slice(0, n);
  }

  /**
   * Get top N processes by memory usage
   */
  async getTopByMemory(n: number = 10): Promise<ProcessInfo[]> {
    const processes = await this.collectProcesses();
    return processes
      .sort((a, b) => b.memPercent - a.memPercent)
      .slice(0, n);
  }
}
