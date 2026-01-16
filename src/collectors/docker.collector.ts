import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: 'online' | 'offline' | 'degraded';
  state: string;
  ports: string[];
  created: string;
  restartCount: number;
  // Docker Compose info
  composeProject?: string;
  composeService?: string;
  // Additional labels
  labels: Record<string, string>;
}

export class DockerCollector {
  private isDockerAvailable: boolean | null = null;
  private lastCheck: number = 0;
  private checkInterval: number = 60000; // Check availability every minute

  /**
   * Check if Docker is available on this system
   */
  async isAvailable(): Promise<boolean> {
    const now = Date.now();

    // Cache the availability check
    if (this.isDockerAvailable !== null && now - this.lastCheck < this.checkInterval) {
      return this.isDockerAvailable;
    }

    try {
      // Check if docker socket exists
      const socketExists = fs.existsSync('/var/run/docker.sock') ||
                          fs.existsSync('/rootfs/var/run/docker.sock');

      if (!socketExists) {
        this.isDockerAvailable = false;
        this.lastCheck = now;
        return false;
      }

      // Try to run docker info
      await execAsync('docker info --format "{{.ID}}"', { timeout: 5000 });
      this.isDockerAvailable = true;
      this.lastCheck = now;
      return true;
    } catch (error) {
      this.isDockerAvailable = false;
      this.lastCheck = now;
      return false;
    }
  }

  /**
   * Collect all Docker containers
   */
  async collectContainers(): Promise<DockerContainer[]> {
    const available = await this.isAvailable();
    if (!available) {
      return [];
    }

    try {
      // Use docker ps with JSON format
      const { stdout } = await execAsync(
        'docker ps -a --format \'{"id":"{{.ID}}","name":"{{.Names}}","image":"{{.Image}}","state":"{{.State}}","status":"{{.Status}}","ports":"{{.Ports}}","created":"{{.CreatedAt}}"}\'',
        { timeout: 30000 }
      );

      if (!stdout.trim()) {
        return [];
      }

      const lines = stdout.trim().split('\n');
      const containers: DockerContainer[] = [];

      for (const line of lines) {
        try {
          const container = JSON.parse(line);

          // Get detailed info from docker inspect (restart count, labels)
          let restartCount = 0;
          let labels: Record<string, string> = {};
          let composeProject: string | undefined;
          let composeService: string | undefined;

          try {
            const { stdout: inspectOut } = await execAsync(
              `docker inspect --format '{{json .}}' ${container.id}`,
              { timeout: 5000 }
            );
            const inspectData = JSON.parse(inspectOut.trim());

            restartCount = inspectData.RestartCount || 0;
            labels = inspectData.Config?.Labels || {};

            // Extract docker-compose labels
            composeProject = labels['com.docker.compose.project'];
            composeService = labels['com.docker.compose.service'];
          } catch {
            // Ignore inspect errors
          }

          // Parse ports
          const ports = container.ports
            ? container.ports.split(',').map((p: string) => p.trim()).filter((p: string) => p)
            : [];

          // Map state to status
          let status: 'online' | 'offline' | 'degraded' = 'offline';
          const stateLower = container.state.toLowerCase();
          if (stateLower === 'running') {
            status = 'online';
          } else if (stateLower === 'restarting' || stateLower === 'paused') {
            status = 'degraded';
          }

          containers.push({
            id: container.id,
            name: container.name,
            image: container.image,
            status,
            state: container.state,
            ports,
            created: container.created,
            restartCount,
            composeProject,
            composeService,
            labels,
          });
        } catch (parseError) {
          console.error('Failed to parse container JSON:', line, parseError);
        }
      }

      return containers;
    } catch (error: any) {
      console.error('Failed to collect Docker containers:', error.message);
      return [];
    }
  }

  getName(): string {
    return 'docker';
  }
}
