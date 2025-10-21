# Multi-stage build for Map-Ping Application

# Stage 1: Backend Build
FROM node:18-alpine AS backend-builder

WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./

# Install backend dependencies
RUN npm ci --only=production

# Copy backend source
COPY backend/ ./

# Stage 2: Frontend Build
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Create public directory if it doesn't exist
RUN mkdir -p public

# Build Next.js application
RUN npm run build

# Stage 3: Production
FROM node:18-alpine

# Install system dependencies for ping
RUN apk add --no-cache iputils

# Create app directory
WORKDIR /app

# Copy backend from builder
COPY --from=backend-builder /app/backend ./backend

# Copy frontend build from builder
COPY --from=frontend-builder /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /app/frontend/public ./frontend/public
COPY --from=frontend-builder /app/frontend/package*.json ./frontend/
COPY --from=frontend-builder /app/frontend/next.config.js ./frontend/
COPY --from=frontend-builder /app/frontend/node_modules ./frontend/node_modules

# Install frontend production dependencies
WORKDIR /app/frontend
RUN npm ci --only=production

WORKDIR /app

# Create startup script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Expose ports
EXPOSE 4000 5000

# Set environment variables
ENV NODE_ENV=production
ENV BACKEND_PORT=5000
ENV FRONTEND_PORT=4000

# Start both services
ENTRYPOINT ["./docker-entrypoint.sh"]

