FROM node:20-buster

# Instala dependências e Chrome
RUN apt-get update && apt-get install -y \
    ffmpeg \
    imagemagick \
    webp \
    wget \
    gnupg \
    ca-certificates \
    curl \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && npm i pm2 -g \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia dependências
COPY package.json yarn.lock* ./
RUN yarn install --production

# Copia código
COPY . .

# 🔥 HEALTH CHECK ENDPOINT SIMPLES
RUN echo 'const express = require("express"); \
const app = express(); \
app.get("/", (req, res) => res.json({status: "ok", bot: "online", uptime: process.uptime()})); \
app.get("/health", (req, res) => res.json({status: "healthy", timestamp: new Date()})); \
app.listen(3000, () => console.log("Health server running on port 3000")); \
console.log("Starting main bot..."); \
require("./index.js");' > server.js

# Variáveis de ambiente
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV CHROME_BIN=/usr/bin/google-chrome-stable
ENV NODE_ENV=production
ENV PORT=3000

# 🔥 HEALTHCHECK PARA MANTER VIVO
HEALTHCHECK --interval=60s --timeout=30s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

EXPOSE 3000

# 🔥 COMANDO QUE NUNCA FALHA
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]
