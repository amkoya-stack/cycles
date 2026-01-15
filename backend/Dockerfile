# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (force fresh install)
RUN rm -rf node_modules && npm install

# Copy source code
COPY . .

# Clean and build fresh
RUN rm -rf dist/ && npm run build

# Debug: Check dist folder
RUN ls -la dist/src/ || echo "dist/src not found"

# Expose port
EXPOSE 3001

# Create startup script that runs migrations then starts app
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "Running migrations..."' >> /app/start.sh && \
    echo 'node dist/src/scripts/run-migrations.js up || echo "Migrations failed or already applied"' >> /app/start.sh && \
    echo 'echo "Starting application..."' >> /app/start.sh && \
    echo 'node --require ./dist/src/polyfills.js dist/src/main.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Run the application with migrations
CMD ["/bin/sh", "/app/start.sh"]
