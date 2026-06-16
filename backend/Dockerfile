FROM node:20-alpine

# Install Python (for yt-dlp) and FFmpeg
RUN apk update && \
    apk add --no-cache python3 py3-pip ffmpeg && \
    wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build TS code
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
