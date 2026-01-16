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

# Railway will auto-detect the port from the running application
# No EXPOSE needed - app uses process.env.PORT which Railway provides

# Run the application directly without migrations to avoid startup timeout
# Cache bust: v2
CMD ["node", "dist/src/main.js"]
