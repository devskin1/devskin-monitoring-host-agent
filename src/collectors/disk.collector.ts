import * as si from 'systeminformation';
import { BaseCollector, CollectorMetrics } from './base.collector';

export class DiskCollector extends BaseCollector {
  private lastIoStats: any = null;
  private lastTimestamp: number = 0;

  async collect(): Promise<CollectorMetrics> {
    const [fsData, ioData] = await Promise.all([
      si.fsSize(),
      si.disksIO(),
    ]);

    const metrics: CollectorMetrics = {};

    // Filesystem usage (aggregate across all filesystems)
    let totalUsed = 0;
    let totalSize = 0;

    fsData.forEach((fs) => {
      totalUsed += fs.used;
      totalSize += fs.size;
    });

    if (totalSize > 0) {
      metrics.disk_usage_percent = Math.round((totalUsed / totalSize) * 10000) / 100;
      metrics.disk_used_bytes = totalUsed;
      metrics.disk_total_bytes = totalSize;
    }

    // Disk I/O rates (bytes per second)
    const currentTimestamp = Date.now();

    if (this.lastIoStats && this.lastTimestamp > 0) {
      const timeDelta = (currentTimestamp - this.lastTimestamp) / 1000; // seconds

      if (timeDelta > 0) {
        const readDelta = ioData.rIO - this.lastIoStats.rIO;
        const writeDelta = ioData.wIO - this.lastIoStats.wIO;

        metrics.disk_read_bytes = Math.round(readDelta / timeDelta);
        metrics.disk_write_bytes = Math.round(writeDelta / timeDelta);
      }
    } else {
      // First run, no rate calculation possible
      metrics.disk_read_bytes = 0;
      metrics.disk_write_bytes = 0;
    }

    this.lastIoStats = ioData;
    this.lastTimestamp = currentTimestamp;

    return metrics;
  }

  getName(): string {
    return 'disk';
  }
}
