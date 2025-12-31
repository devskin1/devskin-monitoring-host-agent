import * as si from 'systeminformation';
import { BaseCollector, CollectorMetrics } from './base.collector';

export class LoadCollector extends BaseCollector {
  async collect(): Promise<CollectorMetrics> {
    const loadData = await si.currentLoad();

    return {
      load_avg_1m: loadData.avgLoad || 0,
      load_avg_5m: 0, // systeminformation doesn't provide 5/15 min averages in currentLoad
      load_avg_15m: 0,
    };
  }

  getName(): string {
    return 'load';
  }
}
