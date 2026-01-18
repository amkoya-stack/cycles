# Use Node.js 18 LTS
FROM node:18-alpine

# Cache bust: force rebuild v5
ARG CACHEBUST=1

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

# Run migrations and seed ledger, then start the app
# Use sh -c to run multiple commands
CMD ["sh", "-c", "npm run migrate:prod && npm run seed:ledger:prod && node dist/src/main.js"]
