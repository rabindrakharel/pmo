# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN npm install -g pnpm@8.15.1
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api/ ./apps/api/
COPY tsconfig.json ./

# Build the application
WORKDIR /app/apps/api
RUN pnpm build

# Production stage
FROM node:20-alpine AS runtime

# Create non-root user
RUN addgroup -g 1000 -S app && \
    adduser -u 1000 -S app -G app

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/

# Install production dependencies only
RUN npm install -g pnpm@8.15.1
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Change to non-root user
USER app

WORKDIR /app/apps/api

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:4000/healthz').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

EXPOSE 4000

CMD ["node", "dist/server.js"]