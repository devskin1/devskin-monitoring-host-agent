import * as si from 'systeminformation';
import { BaseCollector, CollectorMetrics } from './base.collector';

export class NetworkCollector extends BaseCollector {
  private lastNetStats: any[] = [];
  private lastTimestamp: number = 0;

  async collect(): Promise<CollectorMetrics> {
    const netStats = await si.networkStats();
    const currentTimestamp = Date.now();

    const metrics: CollectorMetrics = {};

    // Aggregate network traffic across all interfaces
    let totalRx = 0;
    let totalTx = 0;
    let totalRxSec = 0;
    let totalTxSec = 0;

    netStats.forEach((iface) => {
      totalRx += iface.rx_bytes;
      totalTx += iface.tx_bytes;
      totalRxSec += iface.rx_sec;
      totalTxSec += iface.tx_sec;
    });

    metrics.network_rx_bytes = totalRx;
    metrics.network_tx_bytes = totalTx;

    // Calculate rates if we have previous data
    if (this.lastNetStats.length > 0 && this.lastTimestamp > 0) {
      const timeDelta = (currentTimestamp - this.lastTimestamp) / 1000; // seconds

      if (timeDelta > 0) {
        let lastRx = 0;
        let lastTx = 0;

        this.lastNetStats.forEach((iface) => {
          lastRx += iface.rx_bytes;
          lastTx += iface.tx_bytes;
        });

        metrics.network_rx_rate_bytes = Math.round((totalRx - lastRx) / timeDelta);
        metrics.network_tx_rate_bytes = Math.round((totalTx - lastTx) / timeDelta);
      }
    } else {
      // First run, use systeminformation's per-second values
      metrics.network_rx_rate_bytes = Math.round(totalRxSec);
      metrics.network_tx_rate_bytes = Math.round(totalTxSec);
    }

    this.lastNetStats = netStats;
    this.lastTimestamp = currentTimestamp;

    return metrics;
  }

  getName(): string {
    return 'network';
  }
}
