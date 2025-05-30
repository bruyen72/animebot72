# YakaBot WhatsApp + Chrome GUI - Dockerfile otimizado
FROM node:18-bullseye

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:99
ENV SCREEN_WIDTH=1920
ENV SCREEN_HEIGHT=1080

# Instalar dependências do YakaBot + Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    software-properties-common \
    supervisor \
    xvfb \
    x11vnc \
    fluxbox \
    websockify \
    pulseaudio \
    fonts-liberation \
    fonts-dejavu-core \
    fonts-noto-color-emoji \
    fonts-noto-cjk \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    libgbm-dev \
    libxshmfence1 \
    python3 \
    python3-pip \
    build-essential \
    ffmpeg \
    imagemagick \
    libmagick++-dev \
    libpng-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Instalar Google Chrome
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Instalar noVNC para acesso web
RUN wget -qO- https://github.com/novnc/noVNC/archive/v1.4.0.tar.gz | tar xz -C /opt/ \
    && mv /opt/noVNC-1.4.0 /opt/novnc \
    && wget -qO- https://github.com/novnc/websockify/archive/v0.11.0.tar.gz | tar xz -C /opt/ \
    && mv /opt/websockify-0.11.0 /opt/novnc/utils/websockify

# Configurar diretório de trabalho
WORKDIR /app

# Copiar arquivos do YakaBot
COPY package*.json ./

# Instalar dependências com configurações otimizadas
RUN npm ci --only=production --no-audit --no-fund \
    && npm cache clean --force

# Copiar código do YakaBot
COPY . .

# Configurar Puppeteer para usar Chrome instalado no sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Configurar supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Scripts para Chrome GUI
COPY start-chrome.sh /usr/local/bin/start-chrome.sh
COPY start-vnc.sh /usr/local/bin/start-vnc.sh
COPY start-novnc.sh /usr/local/bin/start-novnc.sh
COPY healthcheck.sh /usr/local/bin/healthcheck.sh

# Tornar scripts executáveis
RUN chmod +x /usr/local/bin/*.sh

# Criar usuário para Chrome
RUN groupadd -r chrome && useradd -r -g chrome -G audio,video chrome \
    && mkdir -p /home/chrome/.config/google-chrome \
    && chown -R chrome:chrome /home/chrome

# Expor portas (YakaBot + Chrome GUI)
EXPOSE 3000 6080 5900

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh

# Iniciar supervisor (roda bot NodeJS + Chrome GUI)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
