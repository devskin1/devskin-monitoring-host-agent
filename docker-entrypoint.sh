#!/bin/sh
set -e

# Detect hostname - prefer /etc/hostname file (mounted from host) over hostname command
# The hostname command in Docker returns container ID, but /etc/hostname has the real host name
if [ -n "${DEVSKIN_HOSTNAME}" ]; then
  DETECTED_HOSTNAME="${DEVSKIN_HOSTNAME}"
elif [ -f "/etc/hostname" ]; then
  DETECTED_HOSTNAME=$(cat /etc/hostname | tr -d '\n')
  echo "Using hostname from /etc/hostname: ${DETECTED_HOSTNAME}"
else
  DETECTED_HOSTNAME=$(hostname)
  echo "Warning: Using container hostname (may not be accurate): ${DETECTED_HOSTNAME}"
fi

# Generate config.json from environment variables
cat > /app/config/config.json <<EOF
{
  "apiUrl": "${DEVSKIN_API_URL:-https://api-monitoring.devskin.com}",
  "agentKey": "${DEVSKIN_API_KEY}",
  "tenantId": "${DEVSKIN_TENANT_ID}",
  "hostname": "${DETECTED_HOSTNAME}",
  "environment": "${DEVSKIN_ENVIRONMENT:-production}",
  "collectionInterval": ${DEVSKIN_COLLECTION_INTERVAL:-60000},
  "batchSize": ${DEVSKIN_BATCH_SIZE:-10},
  "retryAttempts": ${DEVSKIN_RETRY_ATTEMPTS:-3},
  "retryDelay": ${DEVSKIN_RETRY_DELAY:-5000},
  "debug": ${DEVSKIN_DEBUG:-false},
  "logLevel": "${DEVSKIN_LOG_LEVEL:-info}"
}
EOF

echo "Configuration generated successfully"
cat /app/config/config.json

# Start the agent
exec node dist/index.js --config /app/config/config.json
