#!/bin/sh
set -e

# Generate config.json from environment variables
cat > /app/config/config.json <<EOF
{
  "apiUrl": "${DEVSKIN_API_URL:-https://api-monitoring.devskin.com}",
  "agentKey": "${DEVSKIN_API_KEY}",
  "tenantId": "${DEVSKIN_TENANT_ID}",
  "hostname": "${DEVSKIN_HOSTNAME:-$(hostname)}",
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
