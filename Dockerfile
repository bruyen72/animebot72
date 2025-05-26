# Dockerfile ULTRA OTIMIZADO para WhatsApp Bot 24/7 no Fly.io
FROM node:lts-buster

# ⚡ INSTALA CHROME + DEPENDÊNCIAS ESSENCIAIS
RUN apt-get update && apt-get install -y \
    # Dependências existentes
    ffmpeg \
    imagemagick \
    webp \
    # Chrome e dependências
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libnss3 \
    libgconf-2-4 \
    libxtst6 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxext6 \
    libxfixes3 \
    libnss3-dev \
    libdrm2 \
    libxss1 \
    libgbm1 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libatk-bridge2.0-0 \
    # Fontes para renderização
    fonts-liberation \
    fonts-dejavu-core \
    fontconfig \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    # Utilitários
    xvfb \
    && apt-get upgrade -y \
    && npm i pm2 -g

# ⚡ INSTALA GOOGLE CHROME STABLE
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# ⚡ CRIA USUÁRIO NÃO-ROOT PARA SEGURANÇA
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads /app \
    && chown -R pptruser:pptruser /home/pptruser /app

# ⚡ CONFIGURA DIRETÓRIO DE TRABALHO
WORKDIR /app

# ⚡ COPIA E INSTALA DEPENDÊNCIAS
COPY package.json yarn.lock* ./
RUN yarn install --production --frozen-lockfile \
    && yarn cache clean \
    && npm cache clean --force

# ⚡ COPIA TODO O CÓDIGO
COPY . .

# ⚡ AJUSTA PERMISSÕES
RUN chown -R pptruser:pptruser /app

# ⚡ CONFIGURA VARIÁVEIS DE AMBIENTE PARA CHROME
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    CHROME_BIN=/usr/bin/google-chrome-stable \
    GOOGLE_CHROME_BIN=/usr/bin/google-chrome-stable \
    CHROMIUM_BIN=/usr/bin/google-chrome-stable \
    DISPLAY=:99 \
    NODE_ENV=production \
    PORT=3000 \
    # Otimizações de performance
    NODE_OPTIONS="--max-old-space-size=768" \
    # Variáveis para WhatsApp
    WA_VERSION=2.2412.54 \
    WA_AUTOMATE_VERSION=4.60.3

# ⚡ CRIA ARQUIVO PM2 ECOSYSTEM
RUN echo '{\
  "apps": [{\
    "name": "yakabot",\
    "script": "index.js",\
    "instances": 1,\
    "exec_mode": "fork",\
    "max_memory_restart": "768M",\
    "node_args": "--max-old-space-size=768",\
    "restart_delay": 5000,\
    "max_restarts": 50,\
    "min_uptime": "10s",\
    "kill_timeout": 30000,\
    "wait_ready": true,\
    "listen_timeout": 30000,\
    "env": {\
      "NODE_ENV": "production",\
      "PORT": 3000,\
      "PUPPETEER_EXECUTABLE_PATH": "/usr/bin/google-chrome-stable"\
    },\
    "error_file": "/app/logs/err.log",\
    "out_file": "/app/logs/out.log",\
    "log_file": "/app/logs/combined.log",\
    "time": true,\
    "autorestart": true,\
    "watch": false\
  }]\
}' > ecosystem.config.json

# ⚡ CRIA DIRETÓRIO DE LOGS
RUN mkdir -p /app/logs && chown -R pptruser:pptruser /app/logs

# ⚡ CRIA ENDPOINT DE HEALTH CHECK
RUN echo 'const express = require("express");\
const app = express();\
app.get("/health", (req, res) => {\
  res.status(200).json({\
    status: "ok",\
    bot: "online", \
    uptime: process.uptime(),\
    memory: process.memoryUsage(),\
    timestamp: new Date().toISOString(),\
    chrome: process.env.PUPPETEER_EXECUTABLE_PATH\
  });\
});\
app.get("/", (req, res) => {\
  res.status(200).json({ message: "YakaBot WhatsApp 24/7 Online!" });\
});\
app.listen(3000, () => {\
  console.log("🔥 Health check server rodando na porta 3000");\
});' > health-server.js

# ⚡ SCRIPT DE INICIALIZAÇÃO CUSTOMIZADO
RUN echo '#!/bin/bash\
echo "🚀 Iniciando YakaBot WhatsApp 24/7..."\
echo "🔍 Verificando Chrome..."\
google-chrome-stable --version || echo "⚠️ Chrome não encontrado"\
echo "📱 Verificando dependências do WhatsApp..."\
node -e "console.log(\"Node.js:\", process.version)"\
echo "🔧 Verificando PM2..."\
pm2 --version\
echo "💾 Limpando cache..."\
npm cache clean --force 2>/dev/null || true\
echo "🎯 Iniciando health server em background..."\
node health-server.js &\
echo "🚀 Iniciando bot principal com PM2..."\
exec pm2-runtime start ecosystem.config.json --no-daemon' > start.sh \
    && chmod +x start.sh

# ⚡ MUDA PARA USUÁRIO NÃO-ROOT
USER pptruser

# ⚡ HEALTHCHECK OTIMIZADO
HEALTHCHECK --interval=60s --timeout=30s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# ⚡ EXPÕE PORTA
EXPOSE 3000

# ⚡ COMANDO DE INICIALIZAÇÃO FINAL
CMD ["./start.sh"]
