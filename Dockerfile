# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Cache busting - force fresh build
ARG CACHEBUST=1

# Copy package files
COPY backend/package*.json ./

# Install ALL dependencies (force fresh install)
RUN rm -rf node_modules package-lock.json && npm install

# Copy backend source code
COPY backend/ ./

# Clean any cached build files and build fresh
RUN rm -rf dist/ && npm run build

# Check if dist folder was created
RUN echo "Checking dist folder..." && ls -la dist/ || echo "Dist folder not found"

# List all files to see what we have
RUN echo "All files in app:" && ls -la /app/

# Expose port
EXPOSE 3001

# Run the application
CMD ["node", "dist/src/main.js"]
