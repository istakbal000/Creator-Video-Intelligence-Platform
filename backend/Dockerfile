FROM node:20-slim

# Install system dependencies for yt-dlp, ffmpeg, and whisper
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN pip3 install yt-dlp --break-system-packages

# Install Whisper
RUN pip3 install openai-whisper --break-system-packages

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p tmp logs

EXPOSE 5000

CMD ["node", "src/server.js"]
