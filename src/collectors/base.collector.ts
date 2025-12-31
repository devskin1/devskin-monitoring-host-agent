export interface CollectorMetrics {
  [key: string]: number | string | boolean | null;
}

export abstract class BaseCollector {
  /**
   * Collect metrics from this source
   */
  abstract collect(): Promise<CollectorMetrics>;

  /**
   * Get collector name
   */
  abstract getName(): string;

  /**
   * Check if collector is enabled
   */
  isEnabled(): boolean {
    return true;
  }
}
