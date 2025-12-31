FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm install -D typescript @types/node

# Copy source code
COPY src ./src

# Build
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Install system dependencies for host monitoring
RUN apk add --no-cache \
    procps \
    sysstat \
    util-linux

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy entrypoint script
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Create config directory
RUN mkdir -p /app/config && chown node:node /app/config

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD ps aux | grep -v grep | grep "node dist/index.js" || exit 1

# Run as non-root user (but needs some host access)
USER node

ENTRYPOINT ["/app/docker-entrypoint.sh"]
