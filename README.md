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

Required configuration:
- `apiUrl`: DevSkin backend URL (e.g., `https://api-monitoring.devskin.com`)
- `agentKey`: Authentication key (generate in DevSkin UI)
- `tenantId`: Your tenant ID from DevSkin

## Configuration

Example `config.json`:

```json
{
  "apiUrl": "https://api-monitoring.devskin.com",
  "agentKey": "your-agent-key-here",
  "tenantId": "your-tenant-id-here",
  "hostname": "auto-detect",
  "collectionInterval": 60000,
  "batchSize": 10,
  "logLevel": "info",
  "collectors": {
    "cpu": { "enabled": true },
    "memory": { "enabled": true },
    "disk": {
      "enabled": true,
      "mountPoints": ["/", "/home"]
    },
    "network": {
      "enabled": true,
      "interfaces": ["eth0"]
    },
    "process": { "enabled": true }
  }
}
```

## Running the Agent

### Manual Mode

```bash
# Run directly
npm start -- --config /etc/devskin/config.json

# Or with tsx in development
npm run dev -- --config /etc/devskin/config.json
```

### As a Systemd Service (Recommended)

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
