#!/bin/bash
# chrome-install.sh - SOLUÇÃO DEFINITIVA para Chrome no Render

echo "🔍 DIAGNÓSTICO COMPLETO DO CHROME NO RENDER"
echo "=============================================="

# Função para verificar Chrome
check_chrome() {
    local path="$1"
    if [ -f "$path" ]; then
        echo "✅ ENCONTRADO: $path"
        ls -la "$path"
        return 0
    else
        echo "❌ NÃO EXISTE: $path"
        return 1
    fi
}

# Função para testar Chrome
test_chrome() {
    local path="$1"
    echo "🧪 Testando: $path"
    if "$path" --version 2>/dev/null; then
        echo "✅ FUNCIONAL: $path"
        return 0
    else
        echo "❌ NÃO FUNCIONAL: $path"
        return 1
    fi
}

echo "📋 VERIFICANDO AMBIENTE RENDER..."
echo "Usuário: $(whoami)"
echo "Diretório: $(pwd)"
echo "Arquitetura: $(uname -m)"
echo "Sistema: $(cat /etc/os-release | grep PRETTY_NAME)"

echo ""
echo "🔍 PROCURANDO CHROME EXISTENTE..."
echo "================================="

# Lista de locais para verificar
CHROME_LOCATIONS=(
    "/usr/bin/google-chrome-stable"
    "/usr/bin/google-chrome"
    "/usr/bin/chromium-browser"
    "/usr/bin/chromium"
    "/opt/google/chrome/chrome"
    "/opt/render/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome"
    "/opt/render/project/chrome-bin/chrome"
)

WORKING_CHROME=""
for location in "${CHROME_LOCATIONS[@]}"; do
    if check_chrome "$location"; then
        if test_chrome "$location"; then
            WORKING_CHROME="$location"
            echo "🎯 CHROME FUNCIONAL ENCONTRADO: $location"
            break
        fi
    fi
done

if [ -n "$WORKING_CHROME" ]; then
    echo "✅ Chrome já disponível, configurando..."
    export PUPPETEER_EXECUTABLE_PATH="$WORKING_CHROME"
    export CHROME_BIN="$WORKING_CHROME"
    echo "export PUPPETEER_EXECUTABLE_PATH=$WORKING_CHROME" >> ~/.bashrc
    echo "export CHROME_BIN=$WORKING_CHROME" >> ~/.bashrc
    echo "🎉 Chrome configurado com sucesso!"
    exit 0
fi

echo ""
echo "🚀 INICIANDO INSTALAÇÃO DO CHROME..."
echo "===================================="

# Limpar npm e instalar dependências primeiro
echo "📦 Limpando npm e instalando dependências..."
rm -f .npmrc
npm install --legacy-peer-deps --force

# Criar diretórios necessários
mkdir -p /opt/render/project/chrome-bin
mkdir -p /opt/render/.cache/puppeteer

# MÉTODO 1: Puppeteer install com configuração correta
echo ""
echo "🔧 MÉTODO 1: Instalação via Puppeteer..."
echo "========================================"

export PUPPETEER_CACHE_DIR="/opt/render/.cache/puppeteer"
export PUPPETEER_DOWNLOAD_HOST="https://storage.googleapis.com"

echo "Configurações Puppeteer:"
echo "PUPPETEER_CACHE_DIR: $PUPPETEER_CACHE_DIR"
echo "PUPPETEER_DOWNLOAD_HOST: $PUPPETEER_DOWNLOAD_HOST"

# Instalar Chrome via Puppeteer
npx puppeteer browsers install chrome --force

echo "Verificando instalação do Puppeteer..."
find /opt/render/.cache/puppeteer -name "chrome" -type f 2>/dev/null | head -10

# Procurar Chrome instalado pelo Puppeteer
PUPPETEER_CHROME=$(find /opt/render/.cache/puppeteer -name "chrome" -type f -executable 2>/dev/null | head -1)

if [ -n "$PUPPETEER_CHROME" ]; then
    echo "✅ Chrome do Puppeteer encontrado: $PUPPETEER_CHROME"
    
    if test_chrome "$PUPPETEER_CHROME"; then
        export PUPPETEER_EXECUTABLE_PATH="$PUPPETEER_CHROME"
        export CHROME_BIN="$PUPPETEER_CHROME"
        echo "export PUPPETEER_EXECUTABLE_PATH=$PUPPETEER_CHROME" >> ~/.bashrc
        echo "export CHROME_BIN=$PUPPETEER_CHROME" >> ~/.bashrc
        echo "🎉 Chrome do Puppeteer configurado com sucesso!"
        exit 0
    fi
else
    echo "❌ Chrome do Puppeteer não encontrado"
fi

# MÉTODO 2: Instalação manual do Google Chrome
echo ""
echo "🔧 MÉTODO 2: Instalação do Google Chrome..."
echo "==========================================="

# Atualizar sistema e instalar dependências
echo "Atualizando sistema..."
apt-get update -qq

echo "Instalando dependências do Chrome..."
apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libxss1 \
    libgconf-2-4 \
    libxtst6 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libgbm-dev

# Baixar e instalar Google Chrome
echo "Baixando Google Chrome..."
cd /tmp
wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb

if [ -f "google-chrome-stable_current_amd64.deb" ]; then
    echo "Instalando Google Chrome..."
    dpkg -i google-chrome-stable_current_amd64.deb || apt-get install -f -y
    
    if [ -f "/usr/bin/google-chrome-stable" ]; then
        echo "✅ Google Chrome instalado com sucesso!"
        
        if test_chrome "/usr/bin/google-chrome-stable"; then
            export PUPPETEER_EXECUTABLE_PATH="/usr/bin/google-chrome-stable"
            export CHROME_BIN="/usr/bin/google-chrome-stable"
            echo "export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable" >> ~/.bashrc
            echo "export CHROME_BIN=/usr/bin/google-chrome-stable" >> ~/.bashrc
            echo "🎉 Google Chrome configurado com sucesso!"
            exit 0
        fi
    fi
fi

# MÉTODO 3: Chromium via apt
echo ""
echo "🔧 MÉTODO 3: Instalação do Chromium..."
echo "====================================="

echo "Instalando Chromium..."
apt-get install -y chromium-browser

if [ -f "/usr/bin/chromium-browser" ]; then
    echo "✅ Chromium instalado!"
    
    if test_chrome "/usr/bin/chromium-browser"; then
        export PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"
        export CHROME_BIN="/usr/bin/chromium-browser"
        echo "export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser" >> ~/.bashrc
        echo "export CHROME_BIN=/usr/bin/chromium-browser" >> ~/.bashrc
        echo "🎉 Chromium configurado com sucesso!"
        exit 0
    fi
fi

# MÉTODO 4: Download direto do Chromium
echo ""
echo "🔧 MÉTODO 4: Download direto do Chromium..."
echo "==========================================="

echo "Baixando Chromium..."
cd /tmp
wget -q https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/1083080/chrome-linux.zip

if [ -f "chrome-linux.zip" ]; then
    echo "Extraindo Chromium..."
    unzip -q chrome-linux.zip
    
    if [ -d "chrome-linux" ]; then
        mv chrome-linux /opt/render/project/chrome-bin/
        chmod +x /opt/render/project/chrome-bin/chrome-linux/chrome
        
        CHROMIUM_PATH="/opt/render/project/chrome-bin/chrome-linux/chrome"
        
        if test_chrome "$CHROMIUM_PATH"; then
            export PUPPETEER_EXECUTABLE_PATH="$CHROMIUM_PATH"
            export CHROME_BIN="$CHROMIUM_PATH"
            echo "export PUPPETEER_EXECUTABLE_PATH=$CHROMIUM_PATH" >> ~/.bashrc
            echo "export CHROME_BIN=$CHROMIUM_PATH" >> ~/.bashrc
            echo "🎉 Chromium baixado configurado com sucesso!"
            exit 0
        fi
    fi
fi

# MÉTODO 5: Chrome via repositório Google
echo ""
echo "🔧 MÉTODO 5: Repositório oficial Google..."
echo "=========================================="

echo "Adicionando repositório Google..."
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list

apt-get update -qq
apt-get install -y google-chrome-stable

if [ -f "/usr/bin/google-chrome-stable" ]; then
    if test_chrome "/usr/bin/google-chrome-stable"; then
        export PUPPETEER_EXECUTABLE_PATH="/usr/bin/google-chrome-stable"
        export CHROME_BIN="/usr/bin/google-chrome-stable"
        echo "export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable" >> ~/.bashrc
        echo "export CHROME_BIN=/usr/bin/google-chrome-stable" >> ~/.bashrc
        echo "🎉 Chrome via repositório configurado!"
        exit 0
    fi
fi

echo ""
echo "❌ FALHA EM TODOS OS MÉTODOS DE INSTALAÇÃO"
echo "=========================================="
echo "O sistema continuará em modo fallback."
echo "Verifique os logs acima para debug."

# Listar tudo que temos
echo ""
echo "📋 LISTAGEM FINAL DE ARQUIVOS:"
find /usr/bin -name "*chrome*" -o -name "*chromium*" 2>/dev/null || true
find /opt -name "*chrome*" -type f 2>/dev/null || true
find /opt/render -name "*chrome*" -type f 2>/dev/null || true

echo ""
echo "🔧 TENTATIVA FINAL: Configurar Puppeteer para usar qualquer Chrome disponível..."

# Última tentativa: encontrar qualquer executável parecido com Chrome
LAST_RESORT=$(find /usr/bin /opt -name "*chrome*" -o -name "*chromium*" 2>/dev/null | grep -E "(chrome|chromium)" | head -1)

if [ -n "$LAST_RESORT" ] && [ -f "$LAST_RESORT" ]; then
    echo "🎯 ÚLTIMA TENTATIVA: $LAST_RESORT"
    export PUPPETEER_EXECUTABLE_PATH="$LAST_RESORT"
    export CHROME_BIN="$LAST_RESORT"
    echo "export PUPPETEER_EXECUTABLE_PATH=$LAST_RESORT" >> ~/.bashrc
    echo "export CHROME_BIN=$LAST_RESORT" >> ~/.bashrc
    echo "⚠️ Configuração de emergência aplicada!"
fi

echo "✅ Script finalizado. Verifique os logs acima."
exit 0
