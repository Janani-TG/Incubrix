# ==============================================================================
# Stage 1: Build stage
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies required for building
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source code and build TypeScript
COPY src/ ./src
RUN npm run build

# ==============================================================================
# Stage 2: Production runtime stage
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV API_PREFIX=/api/v1

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript output from builder
COPY --from=builder /app/dist ./dist

# Create runtime artifacts directory with proper node user permissions
RUN mkdir -p /app/artifacts/assisted_packs /app/artifacts/certification \
    && chown -R node:node /app

# Run as non-root user for container security
USER node

EXPOSE 3000

# Container healthcheck querying the /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
