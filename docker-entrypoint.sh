#!/bin/sh
set -e

# Generate config.json from environment variables
cat > /app/config/config.json <<EOF
{
  "apiUrl": "${DEVSKIN_API_URL:-https://api-monitoring.devskin.com}",
  "apiKey": "${DEVSKIN_API_KEY}",
  "hostname": "${DEVSKIN_HOSTNAME:-$(hostname)}",
  "environment": "${DEVSKIN_ENVIRONMENT:-production}",
  "collectionInterval": ${DEVSKIN_COLLECTION_INTERVAL:-60000},
  "debug": ${DEVSKIN_DEBUG:-false}
}
EOF

echo "Configuration generated successfully"
cat /app/config/config.json

# Start the agent
exec node dist/index.js --config /app/config/config.json
