# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN npm install -g pnpm@8.15.1
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/web/ ./apps/web/

# Build the application
WORKDIR /app/apps/web
RUN pnpm build

# Production stage
FROM nginx:alpine AS runtime

# Create non-root user
RUN addgroup -g 1000 -S app && \
    adduser -u 1000 -S app -G app

# Copy built application
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy custom nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Create necessary directories with correct permissions
RUN mkdir -p /var/cache/nginx /var/run /var/log/nginx && \
    chown -R app:app /var/cache/nginx /var/run /var/log/nginx /usr/share/nginx/html && \
    chmod -R 755 /var/cache/nginx /var/run

# Change to non-root user
USER app

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]