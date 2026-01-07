import * as si from 'systeminformation';
import * as fs from 'fs';
import * as os from 'os';
import { BaseCollector, CollectorMetrics } from './base.collector';

export class DiskCollector extends BaseCollector {
  private lastIoStats: any = null;
  private lastTimestamp: number = 0;
  private isDocker: boolean = false;

  constructor() {
    super();
    // Detect if running in Docker
    this.isDocker = fs.existsSync('/.dockerenv') || process.env.DEVSKIN_DOCKER_MODE === 'true';
  }

  async collect(): Promise<CollectorMetrics> {
    let fsData: any[] = [];

    // If running in Docker with /rootfs mounted, use statfs directly on /rootfs
    if (this.isDocker && fs.existsSync('/rootfs')) {
      try {
        const stats = fs.statfsSync('/rootfs');
        const size = Number(stats.blocks) * Number(stats.bsize);
        const available = Number(stats.bavail) * Number(stats.bsize);
        const free = Number(stats.bfree) * Number(stats.bsize);
        const used = size - free;

        fsData.push({
          fs: '/dev/root',
          type: 'unknown',
          size: size,
          used: used,
          available: available,
          mount: '/'
        });

        console.log('[DiskCollector] Read filesystem from /rootfs:', {
          size: size,
          used: used,
          available: available,
          percent: Math.round((used / size) * 10000) / 100
        });
      } catch (err) {
        console.error('[DiskCollector] Error reading /rootfs filesystem:', err);
      }
    }

    // Fallback to systeminformation
    if (fsData.length === 0) {
      console.log('[DiskCollector] Falling back to systeminformation');
      fsData = await si.fsSize();
    }

    const ioData = await si.disksIO();

    const metrics: CollectorMetrics = {};

    // Debug: Log what we found
    if (fsData.length === 0) {
      console.error('[DiskCollector] No filesystem data available');
    } else {
      console.log('[DiskCollector] Found filesystems:', fsData.map(fs => ({
        fs: fs.fs,
        type: fs.type,
        size: fs.size,
        used: fs.used,
        mount: fs.mount
      })));
    }

    // Filesystem usage (aggregate across all filesystems)
    // Filter out temporary filesystems and focus on main filesystems
    let totalUsed = 0;
    let totalSize = 0;

    fsData.forEach((fs) => {
      // Skip small/special filesystems (tmpfs, devtmpfs, etc) and focus on real filesystems
      // Include: ext4, xfs, btrfs, ntfs, apfs, etc.
      const isRealFS = fs.size > 1024 * 1024 * 100; // > 100MB
      const notTmpFS = !fs.fs.includes('tmpfs') && !fs.fs.includes('devtmpfs');

      if (isRealFS && notTmpFS) {
        totalUsed += fs.used;
        totalSize += fs.size;
      }
    });

    if (totalSize > 0) {
      metrics.disk_usage_percent = Math.round((totalUsed / totalSize) * 10000) / 100;
      metrics.disk_used_bytes = totalUsed;
      metrics.disk_total_bytes = totalSize;
    } else {
      // Fallback: if no real FS found, use all filesystems
      fsData.forEach((fs) => {
        totalUsed += fs.used;
        totalSize += fs.size;
      });

      if (totalSize > 0) {
        metrics.disk_usage_percent = Math.round((totalUsed / totalSize) * 10000) / 100;
        metrics.disk_used_bytes = totalUsed;
        metrics.disk_total_bytes = totalSize;
      }
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
