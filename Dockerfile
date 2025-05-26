# Dockerfile OTIMIZADO para WhatsApp Bot com Chrome
FROM node:20-slim

# INSTALA CHROME E DEPENDÊNCIAS ESSENCIAIS
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxkbcommon0 \
    libatspi2.0-0 \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# CONFIGURA USUÁRIO NÃO-ROOT
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser

# CONFIGURA DIRETÓRIO DE TRABALHO
WORKDIR /app

# COPIA E INSTALA DEPENDÊNCIAS
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# COPIA CÓDIGO DA APLICAÇÃO
COPY . .

# AJUSTA PERMISSÕES
RUN chown -R pptruser:pptruser /app

# CONFIGURA VARIÁVEIS DE AMBIENTE
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    CHROME_BIN=/usr/bin/google-chrome-stable \
    DISPLAY=:99 \
    NODE_ENV=production \
    PORT=3000

# MUDA PARA USUÁRIO NÃO-ROOT
USER pptruser

# HEALTHCHECK
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('Bot rodando')" || exit 1

# EXPÕE PORTA
EXPOSE 3000

# COMANDO DE INICIALIZAÇÃO
CMD ["node", "--max-old-space-size=768", "index.js"]
