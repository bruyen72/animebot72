FROM node:lts-buster

# Instala dependências
RUN apt-get update && apt-get install -y \
    ffmpeg \
    imagemagick \
    webp \
    wget \
    gnupg \
    ca-certificates \
    google-chrome-stable \
    && apt-get upgrade -y \
    && npm i pm2 -g \
    && rm -rf /var/lib/apt/lists/*

# Adiciona repositório do Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable

WORKDIR /app

# Copia dependências
COPY package.json yarn.lock* ./
RUN yarn install --production

# Copia código
COPY . .

# Variáveis de ambiente
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV CHROME_BIN=/usr/bin/google-chrome-stable
ENV NODE_ENV=production
ENV PORT=3000

# Health check simples
RUN echo 'const express = require("express"); const app = express(); app.get("/health", (req, res) => res.json({status: "ok"})); app.listen(3000);' > health.js

EXPOSE 3000

CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]
