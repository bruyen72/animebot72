# Chrome GUI 24h Bot - Fly.io
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:99
ENV SCREEN_WIDTH=1920
ENV SCREEN_HEIGHT=1080
ENV SCREEN_DEPTH=24

# Instalar dependências básicas
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    curl \
    unzip \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Adicionar repositório do Google Chrome
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg
RUN echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list

# Instalar Chrome e dependências gráficas
RUN apt-get update && apt-get install -y \
    google-chrome-stable \
    xvfb \
    x11vnc \
    fluxbox \
    websockify \
    pulseaudio \
    pavucontrol \
    fonts-liberation \
    fonts-dejavu-core \
    fonts-noto-color-emoji \
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
    && rm -rf /var/lib/apt/lists/*

# Instalar noVNC para acesso web
RUN wget -qO- https://github.com/novnc/noVNC/archive/v1.4.0.tar.gz | tar xz -C /opt/ \
    && mv /opt/noVNC-1.4.0 /opt/novnc \
    && wget -qO- https://github.com/novnc/websockify/archive/v0.11.0.tar.gz | tar xz -C /opt/ \
    && mv /opt/websockify-0.11.0 /opt/novnc/utils/websockify

# Criar usuário não-root
RUN groupadd -r chrome && useradd -r -g chrome -G audio,video chrome \
    && mkdir -p /home/chrome/.config/google-chrome \
    && mkdir -p /home/chrome/.vnc \
    && chown -R chrome:chrome /home/chrome

# Configurar supervisor para manter processos rodando 24h
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Scripts de inicialização
COPY start-chrome.sh /usr/local/bin/start-chrome.sh
COPY start-vnc.sh /usr/local/bin/start-vnc.sh
COPY start-novnc.sh /usr/local/bin/start-novnc.sh
COPY healthcheck.sh /usr/local/bin/healthcheck.sh

# Tornar scripts executáveis
RUN chmod +x /usr/local/bin/*.sh

# Configurar Chrome para performance
RUN mkdir -p /home/chrome/.config/google-chrome/Default
COPY chrome-preferences.json /home/chrome/.config/google-chrome/Default/Preferences
RUN chown -R chrome:chrome /home/chrome/.config

# Volumes para persistir dados
VOLUME ["/home/chrome/.config", "/home/chrome/Downloads"]

# Expor portas
EXPOSE 6080 5900

# Health check para manter bot ativo
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh

# Iniciar supervisor (mantém tudo rodando 24h)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
