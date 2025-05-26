#!/bin/bash
# chrome-install.sh - Instala Chrome no Render GARANTIDO

echo "🚀 INSTALANDO CHROME NO RENDER - MÉTODO DEFINITIVO"

# Criar diretórios
mkdir -p /opt/render/project/chrome-bin
mkdir -p /opt/render/.cache/puppeteer

# Atualizar sistema
apt-get update -qq

# Instalar dependências do Chrome
apt-get install -y wget gnupg ca-certificates fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 libdrm2 libgtk-3-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 xdg-utils libxss1 libgconf-2-4

# Método 1: Download direto do Google Chrome
echo "📥 Baixando Chrome diretamente..."
cd /tmp
wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb

if [ -f "google-chrome-stable_current_amd64.deb" ]; then
    echo "✅ Chrome baixado com sucesso"
    
    # Instalar Chrome
    dpkg -i google-chrome-stable_current_amd64.deb || apt-get install -f -y
    
    # Verificar instalação
    if [ -f "/usr/bin/google-chrome-stable" ]; then
        echo "✅ Chrome instalado em /usr/bin/google-chrome-stable"
        
        # Criar link simbólico na pasta do projeto
        ln -sf /usr/bin/google-chrome-stable /opt/render/project/chrome-bin/chrome
        
        # Definir variável de ambiente
        echo "export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable" >> ~/.bashrc
        echo "export CHROME_BIN=/usr/bin/google-chrome-stable" >> ~/.bashrc
        
        echo "🎉 Chrome instalado e configurado com sucesso!"
        exit 0
    fi
fi

# Método 2: Puppeteer install forçado
echo "🔧 Tentando Puppeteer install..."
cd /opt/render/project/src
export PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer
npx puppeteer browsers install chrome --force

# Verificar se Puppeteer instalou
CHROME_DIRS="/opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome"
for chrome_path in $CHROME_DIRS; do
    if [ -f "$chrome_path" ]; then
        echo "✅ Chrome do Puppeteer encontrado: $chrome_path"
        
        # Criar link simbólico
        ln -sf "$chrome_path" /opt/render/project/chrome-bin/chrome
        
        # Definir variável
        echo "export PUPPETEER_EXECUTABLE_PATH=$chrome_path" >> ~/.bashrc
        echo "export CHROME_BIN=$chrome_path" >> ~/.bashrc
        
        echo "🎉 Chrome do Puppeteer configurado!"
        exit 0
    fi
done

# Método 3: Download Chromium
echo "🔧 Baixando Chromium como fallback..."
cd /tmp
wget -q https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/1083080/chrome-linux.zip

if [ -f "chrome-linux.zip" ]; then
    unzip -q chrome-linux.zip
    if [ -d "chrome-linux" ]; then
        # Mover para pasta do projeto
        mv chrome-linux /opt/render/project/chrome-bin/
        chmod +x /opt/render/project/chrome-bin/chrome-linux/chrome
        
        # Criar link
        ln -sf /opt/render/project/chrome-bin/chrome-linux/chrome /opt/render/project/chrome-bin/chrome
        
        # Definir variável
        echo "export PUPPETEER_EXECUTABLE_PATH=/opt/render/project/chrome-bin/chrome-linux/chrome" >> ~/.bashrc
        echo "export CHROME_BIN=/opt/render/project/chrome-bin/chrome-linux/chrome" >> ~/.bashrc
        
        echo "✅ Chromium instalado como fallback!"
        exit 0
    fi
fi

echo "❌ Falha em todos os métodos de instalação do Chrome"
exit 1
