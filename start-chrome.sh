#!/bin/bash
# start-chrome.sh - Inicializar Chrome otimizado

export DISPLAY=:99

# Aguardar display estar pronto
while ! xset q &>/dev/null; do
    echo "Aguardando display :99..."
    sleep 1
done

echo "Display :99 pronto! Iniciando Chrome..."

# Limpar cache antigo se necessário
if [ -d "/home/chrome/.config/google-chrome/SingletonLock" ]; then
    rm -rf /home/chrome/.config/google-chrome/SingletonLock
fi

# Iniciar Chrome com configurações otimizadas
exec /usr/bin/google-chrome-stable \
    --no-sandbox \
    --disable-setuid-sandbox \
    --disable-dev-shm-usage \
    --disable-gpu-sandbox \
    --disable-software-rasterizer \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    --disable-field-trial-config \
    --disable-ipc-flooding-protection \
    --force-gpu-mem-available-mb=2048 \
    --max_old_space_size=2048 \
    --memory-pressure-off \
    --max_unused_resource_memory_usage_percentage=5 \
    --enable-gpu-rasterization \
    --enable-zero-copy \
    --ignore-gpu-blocklist \
    --remote-debugging-port=9222 \
    --user-data-dir=/home/chrome/.config/google-chrome \
    --no-first-run \
    --no-default-browser-check \
    --disable-translate \
    --disable-notifications \
    --disable-plugins-discovery \
    --aggressive-cache-discard \
    --enable-fast-unload \
    --window-size=1920,1080 \
    --start-maximized \
    "$@"

---

#!/bin/bash
# start-vnc.sh - Inicializar servidor VNC

export DISPLAY=:99

# Aguardar Xvfb estar pronto
while ! xset q &>/dev/null; do
    echo "Aguardando Xvfb..."
    sleep 1
done

echo "Iniciando servidor VNC..."

# Matar processos VNC antigos
pkill -f x11vnc

# Iniciar VNC server otimizado
exec /usr/bin/x11vnc \
    -display :99 \
    -nopw \
    -listen 0.0.0.0 \
    -xkb \
    -ncache 10 \
    -ncache_cr \
    -ncache_no_moveraise \
    -ncache_no_dtchange \
    -ncache_no_rootpixmap \
    -threads \
    -noxdamage \
    -forever \
    -shared \
    -permitfiletransfer \
    -tightfilexfer \
    -ultrafilexfer \
    -noipv6 \
    -nossl \
    -http \
    -http_ssl \
    -httpport 5800 \
    -httpdir /opt/novnc \
    -httpsport 5801

---

#!/bin/bash
# start-novnc.sh - Inicializar noVNC

echo "Iniciando noVNC..."

# Aguardar VNC server estar pronto
while ! nc -z localhost 5900; do
    echo "Aguardando VNC server..."
    sleep 1
done

echo "VNC server pronto! Iniciando noVNC..."

cd /opt/novnc

# Iniciar websockify + noVNC
exec /opt/novnc/utils/websockify/run \
    --web /opt/novnc \
    --wrap-mode=ignore \
    6080 \
    localhost:5900

---

#!/bin/bash
# healthcheck.sh - Monitoramento 24h

# Verificar se Xvfb está rodando
if ! pgrep -f "Xvfb :99" > /dev/null; then
    echo "ERRO: Xvfb não está rodando!"
    exit 1
fi

# Verificar se VNC está rodando
if ! pgrep -f "x11vnc" > /dev/null; then
    echo "ERRO: VNC server não está rodando!"
    exit 1
fi

# Verificar se noVNC está rodando
if ! pgrep -f "websockify" > /dev/null; then
    echo "ERRO: noVNC não está rodando!"
    exit 1
fi

# Verificar se Chrome está rodando
if ! pgrep -f "google-chrome" > /dev/null; then
    echo "AVISO: Chrome não está rodando, tentando reiniciar..."
    supervisorctl restart chrome
    exit 1
fi

# Verificar se portas estão abertas
if ! nc -z localhost 5900; then
    echo "ERRO: Porta VNC 5900 não está acessível!"
    exit 1
fi

if ! nc -z localhost 6080; then
    echo "ERRO: Porta noVNC 6080 não está acessível!"
    exit 1
fi

# Verificar uso de memória
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100)}')
if [ "$MEMORY_USAGE" -gt 90 ]; then
    echo "AVISO: Uso de memória alto: ${MEMORY_USAGE}%"
fi

# Verificar uso de CPU
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 | cut -d' ' -f1)
if (( $(echo "$CPU_USAGE > 95" | bc -l) )); then
    echo "AVISO: Uso de CPU alto: ${CPU_USAGE}%"
fi

echo "OK: Todos os serviços estão funcionando - Memory: ${MEMORY_USAGE}% CPU: ${CPU_USAGE}%"
exit 0
