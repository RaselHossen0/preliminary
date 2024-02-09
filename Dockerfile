# Use the official Node.js image as a base image
FROM node:14

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install application dependencies
RUN npm install

# Copy the application files to the working directory
COPY . .

# Expose the port that the application will run on
EXPOSE 8000

# Kill any processes using port 5000
RUN lsof -ti :5000 | xargs kill -9 || true

# Run the application
CMD ["node", "app.js"]
