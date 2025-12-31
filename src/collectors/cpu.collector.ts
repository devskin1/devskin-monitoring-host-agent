import * as si from 'systeminformation';
import { BaseCollector, CollectorMetrics } from './base.collector';

export class CpuCollector extends BaseCollector {
  async collect(): Promise<CollectorMetrics> {
    const cpuData = await si.currentLoad();

    return {
      cpu_usage_percent: Math.round(cpuData.currentLoad * 100) / 100,
      cpu_user_percent: Math.round(cpuData.currentLoadUser * 100) / 100,
      cpu_system_percent: Math.round(cpuData.currentLoadSystem * 100) / 100,
      cpu_idle_percent: Math.round(cpuData.currentLoadIdle * 100) / 100,
    };
  }

  getName(): string {
    return 'cpu';
  }
}
