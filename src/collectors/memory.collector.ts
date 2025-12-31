import * as si from 'systeminformation';
import { BaseCollector, CollectorMetrics } from './base.collector';

export class MemoryCollector extends BaseCollector {
  async collect(): Promise<CollectorMetrics> {
    const memData = await si.mem();

    const usagePercent = (memData.used / memData.total) * 100;

    return {
      memory_usage_percent: Math.round(usagePercent * 100) / 100,
      memory_used_bytes: memData.used,
      memory_total_bytes: memData.total,
      memory_available_bytes: memData.available,
      memory_free_bytes: memData.free,
    };
  }

  getName(): string {
    return 'memory';
  }
}
