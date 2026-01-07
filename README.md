# DevSkin Host Monitoring Agent

A lightweight agent for collecting infrastructure metrics from hosts and sending them to the DevSkin monitoring platform.

## Features

- **System Metrics Collection**: CPU, memory, disk, network
- **Automatic Registration**: Self-registers with the monitoring backend
- **Batch Processing**: Efficient metric batching to reduce API calls
- **Retry Logic**: Automatic retry with exponential backoff
- **Heartbeat**: Regular status updates to detect offline hosts
- **Systemd Integration**: Run as a system service

## Installation

### Prerequisites

- Node.js 18+ or 20+
- npm or yarn
- Access to DevSkin backend API

### Steps

1. Clone the repository or download the agent package:

```bash
cd /opt
git clone <repository-url> devskin-agent
cd devskin-agent/packages/host-agent
```

2. Install dependencies:

```bash
npm install
```

3. Build the agent:

```bash
npm run build
```

4. Create configuration file:

```bash
cp config.example.json /etc/devskin/config.json
```

5. Edit configuration with your API details:

```bash
nano /etc/devskin/config.json
```

**Required configuration:**
- `apiUrl`: DevSkin backend URL (e.g., `https://api-monitoring.devskin.com/api/infrastructure`)
- `agentKey`: Authentication key (get from DevSkin UI → Settings → Agents)
- `tenantId`: Your tenant ID from DevSkin (Settings → Account)

## Configuration

Example `config.json`:

```json
{
  "apiUrl": "https://api-monitoring.devskin.com/api/infrastructure",
  "agentKey": "dsk_agent_xxxxxxxxxxxxxxxx",
  "tenantId": "your-tenant-id-uuid",
  "hostname": "auto-detect",
  "environment": "production",
  "collectionInterval": 60000,
  "retryAttempts": 3,
  "retryDelay": 5000,
  "debug": false
}
```

**Configuration Options:**
- `apiUrl` (required): Backend API endpoint
- `agentKey` (required): Agent authentication key
- `tenantId` (required): Your tenant UUID
- `hostname` (optional): Host identifier (defaults to system hostname)
- `environment` (optional): Environment name (production, staging, etc.)
- `collectionInterval` (optional): Collection frequency in ms (default: 60000)
- `retryAttempts` (optional): Number of retry attempts on failure (default: 3)
- `retryDelay` (optional): Delay between retries in ms (default: 5000)
- `debug` (optional): Enable debug logging (default: false)

## Running the Agent

### Option 1: Docker (Recommended) 🐳

Docker is the easiest way to deploy the agent. The image is pre-configured to collect host metrics correctly.

**Quick Start:**

```bash
# Pull the image
docker pull devskin/host-agent:latest

# Run with docker-compose
curl -O https://raw.githubusercontent.com/devskin/monitoring-agents/main/host-agent/docker-compose.yml
# Edit docker-compose.yml with your API credentials
docker-compose up -d

# Or run directly with docker
docker run -d \
  --name devskin-host-agent \
  --restart unless-stopped \
  --network host \
  --pid host \
  --privileged \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -v /:/rootfs:ro \
  -v /etc/hostname:/etc/hostname:ro \
  -e DEVSKIN_API_URL=https://api-monitoring.devskin.com \
  -e DEVSKIN_API_KEY=your-agent-key \
  -e DEVSKIN_TENANT_ID=your-tenant-id \
  devskin/host-agent:latest
```

**Important Docker Notes:**
- `--network host`: Required for accurate network metrics
- `--pid host`: Required to see host processes
- `--privileged`: Required for full system access
- `-v /proc:/host/proc:ro`: Mounts host /proc for CPU, memory, process metrics
- `-v /sys:/host/sys:ro`: Mounts host /sys for disk and network metrics
- `-v /:/rootfs:ro`: Mounts host root for filesystem metrics

**Check logs:**
```bash
docker logs -f devskin-host-agent
```

### Option 2: Manual Mode

```bash
# Run directly
npm start -- --config /etc/devskin/config.json

# Or with tsx in development
npm run dev -- --config /etc/devskin/config.json
```

### Option 3: As a Systemd Service

1. Create user for the agent:

```bash
sudo useradd -r -s /bin/false devskin
```

2. Set permissions:

```bash
sudo mkdir -p /var/log/devskin
sudo chown devskin:devskin /var/log/devskin
sudo chown -R devskin:devskin /opt/devskin-agent
```

3. Install systemd service:

```bash
sudo cp systemd/devskin-host-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
```

4. Start and enable service:

```bash
sudo systemctl start devskin-host-agent
sudo systemctl enable devskin-host-agent
```

5. Check status:

```bash
sudo systemctl status devskin-host-agent
sudo journalctl -u devskin-host-agent -f
```

## Troubleshooting

### Check Logs

```bash
# Systemd logs
sudo journalctl -u devskin-host-agent -n 100

# Agent log file
tail -f /opt/devskin-agent/devskin-agent.log
```

### Common Issues

**Agent fails to start:**
- Check config.json is valid JSON
- Verify apiUrl is reachable
- Ensure agentKey and tenantId are correct

**No metrics appearing:**
- Check agent logs for errors
- Verify network connectivity to backend
- Check backend logs for API errors

**High CPU/Memory usage:**
- Increase collectionInterval in config
- Disable unnecessary collectors
- Check for network issues causing retries

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Watch mode
npm run watch
```

## License

MIT
