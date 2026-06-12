# Start with Node.js image
FROM node:18-alpine

# Set working directory inside container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy entire project
COPY . .

# Expose the port your server uses
EXPOSE 3000

# Command to run your app
CMD ["node", "server.js"]