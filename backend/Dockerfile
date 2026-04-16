FROM node:20-bookworm-slim

# Install libheif for HEIC support in sharp, and other sharp dependencies
RUN apt-get update && apt-get install -y \
    libvips-dev \
    libheif-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json ./

# Install dependencies as root, then hand off to node user
RUN npm install --omit=dev

# Create upload and data directories and assign to node user
RUN mkdir -p /app/uploads/thumbnails /app/data \
    && chown -R node:node /app

# Copy source code
COPY --chown=node:node src/ ./src/

# Switch to non-root user
USER node

EXPOSE 3001

CMD ["node", "src/server.js"]
