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

# Run the application with correct path
CMD ["node", "dist/src/main.js"]
