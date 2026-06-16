FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run dev server, host 0.0.0.0 to be accessible from host machine
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
