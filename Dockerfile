# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Cache busting - force fresh build
ARG CACHEBUST=1

# Copy package files
COPY backend/package*.json ./

# Install ALL dependencies
RUN npm install

# Copy backend source code
COPY backend/ ./

# Build the application
RUN npm run build

# Check if dist folder was created
RUN ls -la dist/ || echo "Dist folder not found"

# Expose port
EXPOSE 3001

# Run the application
CMD ["node", "dist/main"]
