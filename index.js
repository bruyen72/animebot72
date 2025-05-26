require("./config.js");
require("./Core.js");

const pino = require('pino');

// ✅ VERIFICAÇÃO DE MODO LOCAL - ADICIONADO AQUI
const useLocalDB = !global.mongodb || global.mongodb === "" || global.mongodb === "mongodb://localhost:27017/yakabot";

if (useLocalDB) {
    console.log("🚀 Modo local ativado - sem MongoDB");
    
    // Mock mongoose para evitar erros
    global.mongoose = {
        connect: () => Promise.resolve(),
        disconnect: () => Promise.resolve(),
        connection: {
            on: () => {},
            once: () => {},
            readyState: 1
        }
    };
    
    // Não tentar conectar ao MongoDB
    global.skipMongoConnect = true;
} else {
    console.log("🗄️ Modo MongoDB detectado");
    global.skipMongoConnect = false;
}

// Import do Baileys com fallback
let makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, jidDecode, proto, makeInMemoryStore;

try {
    const baileys = require("@whiskeysockets/baileys");
    ({
        default: makeWASocket,
        DisconnectReason,
        useMultiFileAuthState,
        fetchLatestBaileysVersion,
        jidDecode,
        proto,
        makeInMemoryStore
    } = baileys);
    
    // Se makeInMemoryStore não existir, usar fallback
    if (!makeInMemoryStore) {
        makeInMemoryStore = () => ({
            bind: () => {},
            loadMessage: () => null,
            writeToFile: () => {},
            readFromFile: () => {}
        });
    }
    
    console.log("✅ Baileys importado com sucesso");
} catch (err) {
    console.error("❌ Erro ao importar Baileys:", err.message);
    process.exit(1);
}

const fs = require("fs");
const chalk = require("chalk");
const path = require("path");
const figlet = require('figlet');
const express = require("express");
const { join } = require("path");
const { Boom } = require("@hapi/boom");
const PhoneNumber = require('awesome-phonenumber');
const qrcodeTerminal = require('qrcode-terminal');
const qrcode = require('qrcode');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const EventEmitter = require('events');

// ✅ IMPORTAR MONGOOSE APENAS SE NECESSÁRIO
let mongoose;
if (!global.skipMongoConnect) {
    try {
        mongoose = require("mongoose");
        console.log("✅ Mongoose carregado para conexão real");
    } catch (e) {
        console.log("⚠️ Mongoose não encontrado, usando sistema local");
        global.skipMongoConnect = true;
    }
} else {
    console.log("⚡ Mongoose não necessário - modo local ativo");
}

// Limpar listeners existentes para evitar duplicações
function cleanupExistingListeners() {
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    
    // Resetar flags
    global.listenersRegistered = {
        exit: false,
        memCheck: false,
        tempCleaner: false
    };
}

// Limpar listeners no início
cleanupExistingListeners();

// Aumentar limite de listeners para evitar avisos
EventEmitter.defaultMaxListeners = 15;
process.setMaxListeners(15);

// Flag para rastrear registro de listeners
global.listenersRegistered = {
    exit: false,
    memCheck: false,
    tempCleaner: false
};

// Promisify exec para melhor controle
const execPromise = util.promisify(exec);

// ✅ CONFIGURAÇÃO DE SISTEMA OTIMIZADA PARA RENDER
global.YakaBot = null;
const ULTRA_MODE = true;
const AUTO_RECOVERY = true;
const PERFORMANCE_MODE = "RENDER_OPTIMIZED"; // Otimizado para Render

// ✅ CONFIGURAÇÕES OTIMIZADAS PARA RENDER FREE TIER
const MAX_MEMORY_MB = useLocalDB ? 350 : 512; // Menos memória no modo local
const MEMORY_THRESHOLD_WARNING = 0.70;
const MEMORY_THRESHOLD_CRITICAL = 0.85;
const AGGRESSIVE_MEMORY_CLEANUP = useLocalDB; // Mais agressivo no modo local
const MEMORY_CHECK_INTERVAL = useLocalDB ? 60000 : 120000; // Verificar mais frequente no local
const CACHE_CLEANUP_INTERVAL = useLocalDB ? 15 * 60 * 1000 : 30 * 60 * 1000; // Limpeza mais frequente

// Diretórios de trabalho
const SESSION_DIR = './baileys-session';
const COMMAND_DIR = path.join(__dirname, "./Commands");
const TEMP_DIR = path.join(os.tmpdir(), 'yaka_temp');
const CACHE_DIR = path.join(__dirname, './cache');
const CACHE_FILE = path.join(CACHE_DIR, 'menu_cache.json');
const LOG_DIR = path.join(__dirname, './logs');

// ✅ CRIAR DIRETÓRIOS COM TRATAMENTO DE ERRO
[TEMP_DIR, CACHE_DIR, LOG_DIR].forEach(dir => {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    } catch (e) {
        console.log(`⚠️ Erro ao criar diretório ${dir}:`, e.message);
    }
});

// ✅ CONFIGURAÇÕES DE VELOCIDADE PARA RENDER
console.log(`🚀 Configuração ativa: ${PERFORMANCE_MODE}`);
console.log(`💾 Memória alocada: ${MAX_MEMORY_MB}MB`);
console.log(`⚡ Modo: ${useLocalDB ? 'Local (Ultra Rápido)' : 'Híbrido (MongoDB + Local)'}`);

// Continue com o resto do seu código aqui...

// Criar diretórios necessários
[TEMP_DIR, CACHE_DIR, LOG_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Limites de reconexão ajustados
const MAX_RECONNECT_ATTEMPTS = 8; // Reduzido para evitar loops longos
const BASE_RECONNECT_DELAY = 5000; // Aumentado para dar mais tempo
const MAX_RECONNECT_DELAY = 60000;
let reconnectCounter = 0;
let lastReconnectTime = 0;
let reconnectAttempts = 0;
let reconnectDelay = BASE_RECONNECT_DELAY;

// Sistema de log otimizado
const logger = pino({
    level: 'info',
    transport: {
        targets: [
            {
                level: 'info',
                target: 'pino/file',
                options: { destination: path.join(LOG_DIR, 'bot.log'), mkdir: true }
            },
            {
                level: 'error',
                target: 'pino/file',
                options: { destination: path.join(LOG_DIR, 'error.log'), mkdir: true }
            }
        ]
    }
});

// Store com mínimo consumo de memória
const store = makeInMemoryStore({
    logger: pino({ level: 'silent' }),
    maxCachedMessages: 5, // Minimizado para economizar memória
    clearInterval: 7200000 // Limpar a cada 2 horas
});

// Importações otimizadas
const { smsg, getBuffer } = require('./lib/myfunc');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif');
const welcomeLeft = require('./Processes/welcome.js');
const { Collection, Simple } = require("./lib");
const { serialize } = Simple;
const Auth = require('./Processes/Auth');
const mongoose = require("mongoose");

// Configuração principal
const prefix = global.prefa;
const Commands = new Collection();
Commands.prefix = prefix;
const PORT = global.port || 5000;
const app = express();
let QR_GENERATE = "invalid";
let status;

// Estruturas de dados otimizadas
const cooldowns = new Map();
const processedMessages = new Set();
const userCache = new Map();
const groupCache = new Map();
const cmdUsageStats = new Map();
const heavyCommandQueue = [];
let isProcessingHeavyCommand = false;
const activeConnections = new Set();
const commandBlacklist = new Set();
const memoryWarnings = [];
const connectionHistory = [];

// Configurações de rate limiting
let MESSAGE_LIMIT = 5; // Reduzido para mais estabilidade
let COOLDOWN_PERIOD = 3500; // Aumentado para menos carga
const GROUP_MESSAGE_LIMIT = 20; // Reduzido para grupos
const GROUP_COOLDOWN_PERIOD = 7000; // Aumentado para mais estabilidade

// Para processamento paralelo de comandos pesados
const MAX_PARALLEL_HEAVY_COMMANDS = 1; // Reduzido para 1 para estabilidade
let activeHeavyCommands = 0;

// Informações do hardware
const AVAILABLE_MEMORY = Math.floor(os.totalmem() / (1024 * 1024));
const CPU_COUNT = os.cpus().length;
console.log(`🖥️ Hardware: ${CPU_COUNT} CPUs, ${Math.round(AVAILABLE_MEMORY / 1024)}GB RAM`);
console.log(`⚙️ Configuração: ${MAX_MEMORY_MB}MB alocados, ${MESSAGE_LIMIT} mensagens/usuário`);

// Sistema de gerenciamento de memória com abordagem balanceada
const memoryManager = {
    lastGcTime: 0,
    
    getMemoryUsage: () => {
        const memoryUsage = process.memoryUsage();
        return {
            rss: Math.round(memoryUsage.rss / (1024 * 1024)),
            heapTotal: Math.round(memoryUsage.heapTotal / (1024 * 1024)),
            heapUsed: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
            external: Math.round(memoryUsage.external / (1024 * 1024))
        };
    },
    
    // Forçar coleta de lixo
    gc: () => {
        try {
            const now = Date.now();
            if (now - memoryManager.lastGcTime < 20000) {
                return false; // Não executar mais que uma vez a cada 20 segundos
            }
            
            if (global.gc) {
                global.gc();
                memoryManager.lastGcTime = now;
                return true;
            }
        } catch (e) {}
        return false;
    },
    
    // Limpeza de caches adaptada para ser menos agressiva
    adaptiveCacheCleanup: (level = 'normal') => {
        const now = Date.now();
        let cleaned = { users: 0, groups: 0, commands: 0, messages: 0 };
        
        // Definir timeout com base no nível
        const timeout = level === 'aggressive' ? 900000 : // 15 minutos
                        level === 'moderate' ? 1800000 : // 30 minutos
                        3600000; // 1 hora (normal)
        
        // Limpar processedMessages se tiver mais de 100 itens
        if (processedMessages.size > 100) {
            const msgCount = processedMessages.size;
            processedMessages.clear();
            cleaned.messages = msgCount;
        }
        
        // Limpar usuários inativos
        userCache.forEach((value, key) => {
            if (now - value.lastActive > timeout) {
                userCache.delete(key);
                cleaned.users++;
            }
        });
        
        // Limpar grupos inativos
        groupCache.forEach((value, key) => {
            if (now - value.lastActive > timeout) {
                groupCache.delete(key);
                cleaned.groups++;
            }
        });
        
        // Limpeza extra apenas para níveis mais agressivos
        if (level === 'aggressive') {
            // Limpar cooldowns
            cooldowns.clear();
            
            // Preservar apenas comandos essenciais e populares
            const essentialCommands = ['menu', 'help', 's', 'sticker', 'play'];
            
            // Identificar comandos mais usados
            const topCommands = [...cmdUsageStats.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([cmd]) => cmd);
            
            // Combinar comandos essenciais e populares
            const commandsToKeep = new Set([...essentialCommands, ...topCommands]);
            
            for (const cmd of Commands.keys()) {
                if (!commandsToKeep.has(cmd)) {
                    Commands.delete(cmd);
                    cleaned.commands++;
                }
            }
            
            // Limpar cache de menu
            delete Commands.menuCache;
        }
        
        if (cleaned.users > 0 || cleaned.groups > 0 || cleaned.commands > 0 || cleaned.messages > 0) {
            logger.info(`🧹 Limpeza ${level}: ${JSON.stringify(cleaned)}`);
        }
        
        return cleaned;
    },
    
    // Limpeza de emergência - menos agressiva
    emergencyCleanup: async () => {
        logger.warn("🚨 INICIANDO LIMPEZA DE EMERGÊNCIA!");
        
        // Forçar coleta de lixo
        memoryManager.gc();
        
        // Limpar todos os caches
        memoryManager.adaptiveCacheCleanup('aggressive');
        
        // Limpar arquivos temporários
        try {
            if (fs.existsSync(TEMP_DIR)) {
                const tempFiles = fs.readdirSync(TEMP_DIR);
                let removedCount = 0;
                
                for (const file of tempFiles) {
                    try {
                        fs.unlinkSync(path.join(TEMP_DIR, file));
                        removedCount++;
                    } catch (e) {}
                }
                
                if (removedCount > 0) {
                    logger.info(`🧹 Removidos ${removedCount} arquivos temporários`);
                }
            }
        } catch (e) {
            logger.error(e, "Erro ao limpar arquivos temporários");
        }
        
        // Limpar filas de processamento
        heavyCommandQueue.length = 0;
        isProcessingHeavyCommand = false;
        activeHeavyCommands = 0;
        
        // Forçar GC novamente após delay
        setTimeout(() => {
            memoryManager.gc();
            
            // Verificar memória após limpeza
            const memUsage = memoryManager.getMemoryUsage();
            logger.info(`🔄 Memória após limpeza: ${memUsage.heapUsed}MB`);
        }, 500);
        
        return true;
    },
    
    // Verificação de memória periódica
    checkMemory: async () => {
        const memUsage = memoryManager.getMemoryUsage();
        const memRatio = memUsage.heapUsed / MAX_MEMORY_MB;
        
        // Log periódico
        logger.info(`💾 Memória: ${memUsage.heapUsed}/${MAX_MEMORY_MB}MB (${Math.round(memRatio*100)}%)`);
        
        // Verificar nível crítico
        if (memRatio > MEMORY_THRESHOLD_CRITICAL) {
            logger.warn(`🔥 USO CRÍTICO DE MEMÓRIA: ${memUsage.heapUsed}MB (${Math.round(memRatio*100)}%)`);
            await memoryManager.emergencyCleanup();
            
            // Registrar aviso
            memoryWarnings.push({
                level: 'critical',
                timestamp: Date.now(),
                usage: memUsage.heapUsed
            });
            
            return 'critical';
        }
        
        // Verificar nível de alerta
        if (memRatio > MEMORY_THRESHOLD_WARNING) {
            logger.warn(`⚠️ Uso elevado de memória: ${memUsage.heapUsed}MB (${Math.round(memRatio*100)}%)`);
            
            memoryManager.gc();
            memoryManager.adaptiveCacheCleanup('moderate');
            
            // Registrar aviso
            memoryWarnings.push({
                level: 'warning',
                timestamp: Date.now(),
                usage: memUsage.heapUsed
            });
            
            return 'warning';
        }
        
        // Com AGGRESSIVE_MEMORY_CLEANUP, sempre limpar
        if (AGGRESSIVE_MEMORY_CLEANUP) {
            memoryManager.adaptiveCacheCleanup('normal');
            memoryManager.gc();
        }
        
        return 'normal';
    },
    
    // Iniciar monitoramento de memória
    start: () => {
        if (global.listenersRegistered.memCheck) return;
        global.listenersRegistered.memCheck = true;
        
        // Verificar memória periodicamente
        const memCheckInterval = setInterval(memoryManager.checkMemory, MEMORY_CHECK_INTERVAL);
        
        // Limpeza periódica
        const periodicCleanupInterval = setInterval(() => {
            memoryManager.adaptiveCacheCleanup('moderate');
            memoryManager.gc();
        }, CACHE_CLEANUP_INTERVAL);
        
        // Adicionar ao listener centralizado
        if (!global.listenersRegistered.exit) {
            global.listenersRegistered.exit = true;
            process.once('exit', () => {
                clearInterval(memCheckInterval);
                clearInterval(periodicCleanupInterval);
            });
        }
        
        return { memCheckInterval, periodicCleanupInterval };
    }
};

// Sistema otimizado de balanceamento de carga
const loadBalancer = {
    isHighLoad: false,
    commandsPending: 0,
    lastHighLoadTime: 0,
    
    registerCommand: () => {
        loadBalancer.commandsPending++;
        return loadBalancer.commandsPending;
    },
    
    completeCommand: () => {
        loadBalancer.commandsPending = Math.max(0, loadBalancer.commandsPending - 1);
        return loadBalancer.commandsPending;
    },
    
    checkLoad: () => {
        const now = Date.now();
        const memUsage = memoryManager.getMemoryUsage();
        
        const newHighLoad = memUsage.heapUsed > MAX_MEMORY_MB * 0.75 || 
                           loadBalancer.commandsPending > 8;
        
        if (newHighLoad && !loadBalancer.isHighLoad) {
            loadBalancer.isHighLoad = true;
            loadBalancer.lastHighLoadTime = now;
            logger.warn(`⚠️ ALTA CARGA ATIVADA (${memUsage.heapUsed}MB, ${loadBalancer.commandsPending} comandos)`);
            
            // Reduzir limites temporariamente
            MESSAGE_LIMIT = 3;
            COOLDOWN_PERIOD = 5000;
            
            // Limpeza de memória
            memoryManager.adaptiveCacheCleanup('moderate');
            memoryManager.gc();
        }
        
        if (loadBalancer.isHighLoad && !newHighLoad && (now - loadBalancer.lastHighLoadTime > 60000)) {
            loadBalancer.isHighLoad = false;
            logger.info("✅ Estado de alta carga desativado");
            
            // Restaurar limites
            MESSAGE_LIMIT = 5;
            COOLDOWN_PERIOD = 3500;
        }
        
        return loadBalancer.isHighLoad;
    },
    
    // Fila para comandos pesados com processamento melhorado
    processHeavyCommandQueue: async () => {
        if (activeHeavyCommands >= MAX_PARALLEL_HEAVY_COMMANDS || heavyCommandQueue.length === 0) return;
        
        activeHeavyCommands++;
        
        try {
            // Limitar tamanho da fila
            if (heavyCommandQueue.length > 10) {
                logger.warn(`⚠️ Fila muito grande: ${heavyCommandQueue.length}. Removendo comandos antigos.`);
                heavyCommandQueue.splice(0, heavyCommandQueue.length - 8);
            }
            
            const task = heavyCommandQueue.shift();
            
            // Verificar memória antes
            const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;
            
            try {
                const { Yaka, m, Commands, chatUpdate } = task;
                loadBalancer.registerCommand();
                
                // Executar com timeout
                const startTime = Date.now();
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout de comando pesado')), 60000)
                );
                
                await Promise.race([
                    require("./Core.js")(Yaka, m, Commands, chatUpdate),
                    timeoutPromise
                ]).catch(err => {
                    logger.error(err, "Erro ao processar comando pesado");
                    
                    try {
                        Yaka.sendMessage(m.chat, { 
                            text: `⚠️ O comando demorou muito e foi interrompido.`
                        }, { quoted: m }).catch(() => {});
                    } catch (e) {}
                });
                
                loadBalancer.completeCommand();
                
                // Análise de desempenho
                const execTime = Date.now() - startTime;
                const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;
                const memDiff = memAfter - memBefore;
                
                if (execTime > 15000 || memDiff > 30) {
                    logger.warn(`⚠️ Comando pesado: ${execTime}ms, ${Math.round(memDiff)}MB`);
                }
                
                // Verificar memória e limpar após comando pesado
                if (memDiff > 20) {
                    memoryManager.gc();
                    
                    // Aguardar um pouco para o GC fazer efeito
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (err) {
                logger.error(err, "Erro ao processar comando da fila");
                loadBalancer.completeCommand();
            }
        } finally {
            activeHeavyCommands--;
            
            // Processar próximo comando após delay
            setTimeout(() => {
                if (heavyCommandQueue.length > 0) {
                    loadBalancer.processHeavyCommandQueue();
                }
            }, 1000); // Delay maior entre comandos
        }
    },
    
    queueHeavyCommand: (Yaka, m, Commands, chatUpdate) => {
        if (heavyCommandQueue.length >= 10) { // Reduzido para 10
            try {
                Yaka.sendMessage(m.chat, { 
                    text: `⚠️ Sistema sobrecarregado. Por favor, tente novamente em alguns minutos.`
                }, { quoted: m }).catch(() => {});
            } catch (e) {}
            return -1;
        }
        
        heavyCommandQueue.push({ Yaka, m, Commands, chatUpdate });
        
        try {
            Yaka.sendMessage(m.chat, { 
                text: `⏳ Sistema ocupado. Seu comando será processado em breve (${heavyCommandQueue.length}° na fila)`
            }, { quoted: m }).catch(() => {});
        } catch (e) {}
        
        if (activeHeavyCommands < MAX_PARALLEL_HEAVY_COMMANDS) {
            loadBalancer.processHeavyCommandQueue();
        }
        
        return heavyCommandQueue.length;
    },
    
    start: () => {
        const loadCheckInterval = setInterval(loadBalancer.checkLoad, 15000); // A cada 15 segundos
        
        // Adicionar ao listener centralizado
        if (!global.listenersRegistered.exit) {
            global.listenersRegistered.exit = true;
            process.once('exit', () => {
                clearInterval(loadCheckInterval);
            });
        }
        
        return loadCheckInterval;
    }
};

// Carregar comandos sob demanda
const commandLoaders = {};
const readCommands = () => {
    try {
        if (!fs.existsSync(COMMAND_DIR)) {
            logger.error("❌ Pasta de comandos não encontrada!");
            return;
        }
        
        // Verificar cache do menu
        let hasMenuCache = false;
        if (fs.existsSync(CACHE_FILE)) {
            try {
                const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
                Commands.menuCache = cacheData;
                hasMenuCache = true;
                logger.info("✅ Cache de menu carregado do disco");
            } catch (e) {
                logger.warn(e, "Erro ao ler cache de menu");
            }
        }
        
        let dir = COMMAND_DIR;
        let dirs = fs.readdirSync(dir);
        Commands.category = dirs.filter(v => v !== "_").map(v => v);
        
        // Só carregar esqueleto dos comandos
        dirs.forEach((res) => {
            let groups = res.toLowerCase();
            Commands.list = Commands.list || {};
            Commands.list[groups] = [];
            
            commandLoaders[groups] = () => {
                const files = fs.readdirSync(`${dir}/${res}`).filter((file) => file.endsWith(".js"));
                const loadedCommands = [];
                
                for (const file of files) {
                    try {
                        const commandPath = `${dir}/${res}/${file}`;
                        delete require.cache[require.resolve(commandPath)];
                        const command = require(commandPath);
                        
                        if (command && command.name) {
                            if (commandBlacklist.has(command.name)) {
                                logger.warn(`⚠️ Comando na blacklist ignorado: ${command.name}`);
                                continue;
                            }
                            
                            loadedCommands.push(command);
                            Commands.set(command.name, command);
                            
                            if (command.alias && Array.isArray(command.alias)) {
                                command.alias.forEach(alias => {
                                    if (!commandBlacklist.has(alias)) {
                                        Commands.set(alias, command);
                                    }
                                });
                            }
                        }
                    } catch (err) {
                        logger.error(err, `Erro ao carregar comando ${file}`);
                    }
                }
                
                Commands.list[groups] = loadedCommands;
                logger.info(`✅ Categoria ${groups}: ${loadedCommands.length} comandos carregados`);
            };
            
            if (!hasMenuCache) {
                // Extrair informações básicas para o menu
                const files = fs.readdirSync(`${dir}/${res}`).filter((file) => file.endsWith(".js"));
                for (const file of files) {
                    try {
                        const fileContent = fs.readFileSync(`${dir}/${res}/${file}`, 'utf8');
                        const nameMatch = fileContent.match(/name:\s*["'](.+?)["']/);
                        const descMatch = fileContent.match(/desc:\s*["'](.+?)["']/);
                        const usageMatch = fileContent.match(/usage:\s*["'](.+?)["']/);
                        
                        if (nameMatch) {
                            Commands.list[groups].push({
                                name: nameMatch[1],
                                desc: descMatch ? descMatch[1] : 'Sem descrição',
                                usage: usageMatch ? usageMatch[1] : `.${nameMatch[1]}`
                            });
                        }
                    } catch (err) {}
                }
            }
        });
        
        logger.info(`📚 Menu de comandos carregado: ${Commands.category.length} categorias disponíveis`);
    } catch (error) {
        logger.error(error, "Erro ao carregar estrutura de comandos");
    }
};

readCommands();

// Carregar comando específico sob demanda
const loadCommandIfNeeded = (cmdName) => {
    if (commandBlacklist.has(cmdName)) {
        logger.warn(`⚠️ Tentativa de carregar comando na blacklist: ${cmdName}`);
        return null;
    }
    
    if (Commands.has(cmdName)) {
        return Commands.get(cmdName);
    }
    
    for (const category in Commands.list) {
        const found = Commands.list[category].find(cmd => 
            cmd.name === cmdName || 
            (cmd.alias && Array.isArray(cmd.alias) && cmd.alias.includes(cmdName))
        );
        
        if (found) {
            if (commandLoaders[category]) {
                try {
                    commandLoaders[category]();
                    logger.info(`🔄 Carregada categoria ${category} para comando ${cmdName}`);
                    return Commands.get(cmdName);
                } catch (err) {
                    logger.error(err, `Erro ao carregar categoria ${category}`);
                    return null;
                }
            }
        }
    }
    
    return null;
};

// Sistema de rate limiting otimizado
const rateLimit = (user, command, isGroup = false) => {
    const now = Date.now();
    const key = `${user}:${command || 'global'}`;
    
    if (!cooldowns.has(key)) {
        cooldowns.set(key, {
            timestamp: now,
            count: 1
        });
        return false;
    }
    
    const userData = cooldowns.get(key);
    
    if (userCache.has(user) && userCache.get(user).blocked) {
        const blockData = userCache.get(user);
        if (now < blockData.blockUntil) {
            return true;
        } else {
            blockData.blocked = false;
            delete blockData.blockUntil;
        }
    }
    
    const cooldownTime = isGroup ? GROUP_COOLDOWN_PERIOD : COOLDOWN_PERIOD;
    if (now - userData.timestamp > cooldownTime) {
        userData.timestamp = now;
        userData.count = 1;
        return false;
    }
    
    userData.count++;
    
    const limit = isGroup ? GROUP_MESSAGE_LIMIT : MESSAGE_LIMIT;
    if (userData.count > limit) {
        if (userData.count > limit * 2) {
            logger.warn(`🚫 Possível spam: ${user} (${userData.count} msgs em ${cooldownTime}ms)`);
            
            if (userData.count > limit * 3) {
                userCache.set(user, {
                    ...userCache.get(user) || {},
                    blocked: true,
                    blockUntil: now + 60000,
                    lastActive: now
                });
            }
        }
        return true;
    }
    
    return false;
};

// Limpeza de arquivos temporários
const cleanupTempFiles = () => {
    try {
        const now = Date.now();
        let count = 0;
        
        if (fs.existsSync(TEMP_DIR)) {
            const files = fs.readdirSync(TEMP_DIR);
            
            for (const file of files) {
                try {
                    const filePath = path.join(TEMP_DIR, file);
                    const stats = fs.statSync(filePath);
                    
                    // Remover arquivos depois de 30 minutos
                    if (now - stats.mtimeMs > 1800000) {
                        fs.unlinkSync(filePath);
                        count++;
                    }
                } catch (e) {}
            }
            
            if (count > 0) {
                logger.info(`🧹 Limpeza: removidos ${count} arquivos temporários`);
            }
        }
    } catch (err) {
        logger.error(err, "Erro na limpeza de temporários");
    }
};

// Rastreador de erros de comandos
const commandErrorTracker = {
    errors: new Map(),
    errorThreshold: 5, // Aumentado para mais tolerância
    thresholdTimeWindow: 3600000, // 1 hora (aumentado)
    
    trackError: (cmdName) => {
        if (!cmdName) return;
        
        const now = Date.now();
        
        if (!commandErrorTracker.errors.has(cmdName)) {
            commandErrorTracker.errors.set(cmdName, {
                count: 1,
                firstOccurrence: now,
                lastOccurrence: now,
                occurrences: [now]
            });
        } else {
            const data = commandErrorTracker.errors.get(cmdName);
            data.count++;
            data.lastOccurrence = now;
            data.occurrences.push(now);
            
            // Manter apenas ocorrências recentes
            data.occurrences = data.occurrences.filter(time => now - time < commandErrorTracker.thresholdTimeWindow);
            
            // Verificar se atingiu limiar de erros recentes
            if (data.occurrences.length >= commandErrorTracker.errorThreshold) {
                logger.warn(`🚫 Comando colocado na blacklist: ${cmdName} (${data.occurrences.length} falhas recentes)`);
                
                commandBlacklist.add(cmdName);
                Commands.delete(cmdName);
                
                // Verificar aliases
                for (const [name, cmd] of Commands.entries()) {
                    if (cmd && cmd.alias && Array.isArray(cmd.alias) && cmd.alias.includes(cmdName)) {
                        Commands.delete(name);
                        commandBlacklist.add(name);
                        logger.warn(`🚫 Alias também bloqueado: ${name}`);
                    }
                }
                
                return true;
            }
        }
        return false;
    },
    
    resetErrors: () => {
        commandErrorTracker.errors.clear();
        logger.info("🧹 Histórico de erros de comandos limpo");
    }
};

// Gerenciador de conexão
const connectionManager = {
    reconnectAttempts: 0,
    lastConnectTime: 0,
    connectionStates: [],
    
    getReconnectDelay: () => {
        connectionManager.reconnectAttempts++;
        
        // Backoff exponencial com jitter
        const baseDelay = Math.min(
            BASE_RECONNECT_DELAY * Math.pow(1.5, connectionManager.reconnectAttempts - 1),
            MAX_RECONNECT_DELAY
        );
        
        const jitter = Math.floor(Math.random() * (baseDelay * 0.2));
        
        return baseDelay + jitter;
    },
    
    logConnectionState: (state, reason = null) => {
        const now = Date.now();
        connectionManager.connectionStates.push({
            state,
            reason,
            timestamp: now,
            timeSinceLastConnect: now - connectionManager.lastConnectTime
        });
        
        // Limitar tamanho do histórico
        if (connectionManager.connectionStates.length > 30) {
            connectionManager.connectionStates.shift();
        }
        
        // Atualizar tempo de última conexão
        if (state === 'open') {
            connectionManager.lastConnectTime = now;
            connectionManager.reconnectAttempts = 0;
        }
        
        // Registrar para análise
        connectionHistory.push({
            state,
            reason,
            timestamp: now
        });
        
        // Manter histórico limitado
        if (connectionHistory.length > 50) {
            connectionHistory.shift();
        }
    },
    
    // Analisar padrões de conexão
    analyzeConnectionPatterns: () => {
        const now = Date.now();
        const last10Min = connectionManager.connectionStates.filter(
            state => now - state.timestamp < 600000
        );
        
        // Contar reconexões recentes
        const reconnects = last10Min.filter(state => state.state === 'close').length;
        
        // Identificar instabilidade
        let status = 'stable';
        let recommendation = null;
        
        if (reconnects >= 3) {
            status = 'unstable';
            recommendation = 'problemas_de_rede';
        }
        
        // Verificar reconexões rápidas
        const quickDisconnects = last10Min.filter(
            state => state.state === 'close' && state.timeSinceLastConnect < 30000
        ).length;
        
        if (quickDisconnects >= 2) {
            status = 'unstable';
            recommendation = 'conflito_de_sessao';
        }
        
        return {
            status,
            recommendation,
            reconnectsLast10Min: reconnects,
            quickDisconnects
        };
    },
    
    reset: () => {
        connectionManager.reconnectAttempts = 0;
        connectionManager.lastConnectTime = Date.now();
        connectionManager.connectionStates = [];
    }
};

async function startYaka() {
    try {
        console.clear();
        logger.info("🚀 Iniciando Yaka Bot - Versão Estável");
        
        // Limpar memória antes de iniciar
        memoryManager.gc();
        
        // Criar pasta de sessão
        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }

        // Limpar arquivos temporários na inicialização
        cleanupTempFiles();

        // Conectar ao MongoDB com tratamento de erro
        let dbConnected = false;
        try {
            console.log("Tentando conectar ao MongoDB...");
            await mongoose.connect(global.mongodb || '', {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                connectTimeoutMS: 15000,
                serverSelectionTimeoutMS: 15000,
                maxPoolSize: 10, // Reduzido para menor consumo
                minPoolSize: 2
            });
            console.log("\nDatabase 1 connected !\n");
            dbConnected = true;
        } catch (err) {
            console.log("\nTentando conectar ao Discord XP com MongoDB...\n");
            
            try {
                await mongoose.connect(global.mongodbUrl || '', {
                    useNewUrlParser: true,
                    useUnifiedTopology: true,
                    connectTimeoutMS: 15000,
                    serverSelectionTimeoutMS: 15000,
                    maxPoolSize: 10,
                    minPoolSize: 2
                });
                console.log("\nDatabase 2 connected !\n");
                dbConnected = true;
            } catch (err) {
                logger.warn("⚠️ Database 2 falhou. Continuando sem banco de dados.");
            }
        }
        
        // Autenticação
        const authModule = new Auth(global.sessionId);
        
        // Carregar estado
        let baileyState, saveCreds;
        try {
            const result = await useMultiFileAuthState(SESSION_DIR);
            baileyState = result.state;
            saveCreds = result.saveCreds;
            logger.info("✅ Estado de autenticação carregado com sucesso");
        } catch (err) {
            logger.error(err, "Erro ao carregar sessão");
            
            // Criar nova sessão em caso de erro
            try {
                logger.info("🔄 Criando nova sessão...");
                
                // Limpar pasta de sessão
                if (fs.existsSync(SESSION_DIR)) {
                    try {
                        const files = fs.readdirSync(SESSION_DIR);
                        for (const file of files) {
                            // Preservar creds.json se existir
                            if (file !== 'creds.json') {
                                fs.unlinkSync(path.join(SESSION_DIR, file));
                            }
                        }
                    } catch (e) {}
                } else {
                    fs.mkdirSync(SESSION_DIR, { recursive: true });
                }
                
                const result = await useMultiFileAuthState(SESSION_DIR);
                baileyState = result.state;
                saveCreds = result.saveCreds;
            } catch (e) {
                logger.error(e, "Falha crítica com sessão");
                return process.exit(1);
            }
        }

        // ASCII Art para console - Corrigido para evitar duplicação
        console.log("\nCarregando, por favor aguarde...\n");
        console.log("\nNão modifique este bot por conta própria!!");
        console.log("Pergunte ao proprietário antes de fazê-lo..\n");

        // Obter versão do Baileys
        const { version, isLatest } = await fetchLatestBaileysVersion();
        logger.info(`🔌 Versão: ${version}, Atualizado: ${isLatest ? 'Sim' : 'Não'}`);
        
        // Configurações otimizadas
        const socketConfig = {
            auth: baileyState,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['YakaBot', 'Chrome', '116.0.0.0'],
            version,
            
            // Configurações para desempenho
            syncFullHistory: false,
            fireInitQueries: false,
            downloadHistory: false,
            markOnlineOnConnect: true,
            
            // Otimizações de conexão
            keepAliveIntervalMs: 40000, // Aumentado para melhor estabilidade
            connectTimeoutMs: 90000,  // Aumentado para dar mais tempo
            defaultQueryTimeoutMs: 45000, // Aumentado para queries mais lentas
            
            // Reconexão
            retryRequestDelayMs: 800, // Aumentado para menos agressividade
            maxRetries: 4, // Reduzido para não sobrecarregar
            
            // Redução de overhead
            emitOwnEvents: false,
            shouldIgnoreJid: jid => jid.endsWith('@broadcast') || jid.includes('status@broadcast'),
            
            // Cache mínimo
            options: {
                maxCachedMessages: 5
            }
        };

        // Criar conexão
        const Yaka = makeWASocket(socketConfig);
        global.YakaBot = Yaka;
        
        // Configurar store
        try {
            store.bind(Yaka.ev);
        } catch (e) {
            logger.error(e, "Falha ao vincular store");
        }
        
        // Configuração do bot
        Yaka.public = true;
        Yaka.ev.on('creds.update', saveCreds);
        Yaka.serializeM = (m) => smsg(Yaka, m, store);
        
        // Iniciar gerenciadores
        memoryManager.start();
        loadBalancer.start();
        
        // Adicionar métodos de diagnóstico
        Yaka.performance = {
            getMetrics: () => {
                const memUsage = memoryManager.getMemoryUsage();
                
                return {
                    uptime: process.uptime(),
                    memory: memUsage,
                    timestamp: Date.now(),
                    commandQueue: heavyCommandQueue.length,
                    pendingCommands: loadBalancer.commandsPending,
                    isHighLoad: loadBalancer.isHighLoad,
                    connectionState: status
                };
            },
            
            // Modo de baixa memória
            optimizeForRecovery: () => {
                MESSAGE_LIMIT = 2;
                COOLDOWN_PERIOD = 6000;
                
                // Limpar comandos não essenciais
                const essentialCommands = ['menu', 'help', 's', 'sticker'];
                for (const cmd of Commands.keys()) {
                    if (!essentialCommands.includes(cmd)) {
                        Commands.delete(cmd);
                    }
                }
                
                // Limpar caches
                processedMessages.clear();
                memoryManager.adaptiveCacheCleanup('moderate');
                memoryManager.gc();
                
                logger.info("⚡ Modo de recuperação ativado!");
                return true;
            }
        };

        // Handler de conexão otimizado
        Yaka.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            const oldStatus = status;
            status = connection;
            
            // Registrar mudança de estado
            if (connection && oldStatus !== connection) {
                connectionManager.logConnectionState(
                    connection,
                    lastDisconnect?.error?.output?.statusCode || null
                );
                
                logger.info(`🤖 Bot Yaka => ${connection}`);
            }

            // QR code
            if (qr) {
                console.log('\n==========================================================');
                console.log('                 ESCANEIE ESTE QR CODE                    ');
                console.log('==========================================================\n');
                qrcodeTerminal.generate(qr, { small: true });
                console.log('\n==========================================================');
                console.log('    ABRA O WHATSAPP > APARELHOS VINCULADOS > VINCULAR     ');
                console.log('==========================================================');
                QR_GENERATE = qr;
            }

            // Tratamento de desconexão melhorado
            if (connection === 'close') {
                // Limpar conexões ativas
                activeConnections.clear();
                
                // Obter detalhes do erro
                let statusCode = 0;
                let reason = "Desconhecido";
                
                if (lastDisconnect?.error instanceof Boom) {
                    statusCode = lastDisconnect.error.output?.statusCode || 0;
                    reason = lastDisconnect.error.output?.payload?.error || 'Erro desconhecido';
                } else if (lastDisconnect?.error) {
                    statusCode = lastDisconnect.error.status || 0;
                    reason = lastDisconnect.error.message || lastDisconnect.error.name || 'Erro desconhecido';
                }
                
                logger.warn(`❌ Conexão fechada! Razão: ${reason} (${statusCode})`);
                
                // Limpar memória
                memoryManager.gc();
                
                // Não reconectar se foi logout deliberado
                if (statusCode === DisconnectReason.loggedOut) {
                    logger.warn("🚪 Sessão encerrada. Por favor reinicie o bot manualmente.");
                    return process.exit(0);
                }
                
                // Verificar loop de reconexão
                const now = Date.now();
                const isFrequentReconnect = now - lastReconnectTime < 30000;
                
                if (isFrequentReconnect) {
                    reconnectCounter++;
                    
                    // Em caso de reconexões frequentes, fazer limpeza
                    if (reconnectCounter >= 3) {
                        logger.warn("⚠️ Detectado possível loop de reconexão!");
                        
                        // Analisar padrões
                        const connAnalysis = connectionManager.analyzeConnectionPatterns();
                        
                        if (connAnalysis.status === 'unstable') {
                            logger.warn(`⚠️ Instabilidade de conexão: ${connAnalysis.recommendation}`);
                            
                            // Em caso de conflito de sessão, limpar sessão
                            if (connAnalysis.recommendation === 'conflito_de_sessao') {
                                logger.info("🔄 Realizando limpeza de sessão...");
                                
                                try {
                                    // Preservar apenas arquivo essencial
                                    if (fs.existsSync(SESSION_DIR)) {
                                        const files = fs.readdirSync(SESSION_DIR);
                                        for (const file of files) {
                                            if (file !== 'creds.json') {
                                                try {
                                                    fs.unlinkSync(path.join(SESSION_DIR, file));
                                                } catch (e) {}
                                            }
                                        }
                                    }
                                    
                                    logger.info("✅ Limpeza de sessão concluída");
                                    
                                    // Aguardar mais tempo após limpeza de sessão
                                    reconnectCounter = 0;
                                    setTimeout(startYaka, 15000);
                                    return;
                                } catch (e) {
                                    logger.error(e, "Erro na limpeza de sessão");
                                }
                            }
                        }
                    }
                } else {
                    // Resetar contador se não for reconexão frequente
                    reconnectCounter = 1;
                }
                
                lastReconnectTime = now;
                
                // Limpeza antes de reconectar
                await memoryManager.adaptiveCacheCleanup('moderate');
                
                // Incrementar contadores
                reconnectAttempts++;
                
                // Limitar tentativas
                if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
                    logger.warn("❌ Máximo de tentativas atingido. Reiniciando...");
                    process.exit(1);
                }
                
                // Calcular delay adaptativo com jitter
                const jitter = Math.floor(Math.random() * 3000) - 1500; // -1500 a +1500ms
                const finalDelay = Math.min(
                    BASE_RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts-1) + jitter,
                    MAX_RECONNECT_DELAY
                );
                
                logger.info(`🔄 Tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} em ${Math.round(finalDelay/1000)}s...`);
                
                // Iniciar nova tentativa
                setTimeout(startYaka, finalDelay);
            }
            
            // Conexão bem-sucedida
            if (connection === 'open') {
                reconnectAttempts = 0;
                reconnectCounter = 0;
                
                console.log('\n==========================================');
                console.log('       ✅ CONECTADO COM SUCESSO!          ');
                console.log('     Bot ativo e otimizado! .help         ');
                console.log('==========================================\n');
                
                // Limpar caches
                processedMessages.clear();
                
                // Limpar memória após conexão
                setTimeout(() => {
                    memoryManager.adaptiveCacheCleanup('normal');
                    memoryManager.gc();
                }, 30000);
                
                // Monitoramento periódico
                setInterval(() => {
                    const metrics = Yaka.performance.getMetrics();
                    logger.info(`📊 Métricas: ${metrics.memory.heapUsed}MB, Cmds ${metrics.pendingCommands}, Fila ${metrics.commandQueue}`);
                    
                    // Otimizar memória
                    if (metrics.memory.heapUsed > MAX_MEMORY_MB * 0.65) {
                        memoryManager.adaptiveCacheCleanup('moderate');
                        memoryManager.gc();
                    }
                }, 15 * 60 * 1000); // A cada 15 minutos
            }
        });

        // Handler para grupos - otimizado
        Yaka.ev.on("group-participants.update", async (m) => {
            try {
                const groupId = m.id;
                
                // Verificar grupo ignorado
                if (groupCache.has(groupId) && groupCache.get(groupId).ignored) {
                    return;
                }
                
                // Em alta carga, ignorar eventos
                if (loadBalancer.isHighLoad) {
                    return;
                }
                
                // Processar boas-vindas
                try {
                    await welcomeLeft(Yaka, m);
                } catch (e) {
                    logger.error(e, "Erro no processamento de boas-vindas");
                }
                
                // Atualizar cache do grupo
                if (!groupCache.has(groupId)) {
                    groupCache.set(groupId, { 
                        lastActive: Date.now(),
                        ignored: false,
                        memberCount: 0
                    });
                } else {
                    groupCache.get(groupId).lastActive = Date.now();
                }
                
                // Atualizar contador de membros
                if ((m.action === 'add' || m.action === 'remove') && m.participants && m.participants.length > 0) {
                    const groupInfo = groupCache.get(groupId);
                    if (groupInfo) {
                        if (m.action === 'add') {
                            groupInfo.memberCount = (groupInfo.memberCount || 0) + m.participants.length;
                        } else if (m.action === 'remove') {
                            groupInfo.memberCount = Math.max(0, (groupInfo.memberCount || 0) - m.participants.length);
                        }
                    }
                }
            } catch (err) {
                logger.error(err, "Erro em processamento de evento de grupo");
            }
        });

        // Sistema otimizado de processamento de mensagens
        Yaka.ev.on("messages.upsert", async (chatUpdate) => {
            try {
                // Verificações rápidas
                if (!chatUpdate.messages || chatUpdate.messages.length === 0) return;
                if (chatUpdate.type !== 'notify') return;
                
                const msg = chatUpdate.messages[0];
                
                // Verificações adicionais
                if (!msg.message) return;
                if (msg.key.remoteJid === "status@broadcast") return;
                if (msg.key.id.startsWith("BAE5") && msg.key.id.length === 16) return;
                
                // Verificar memória periodicamente
                if (Math.random() < 0.01) {
                    const memoryStatus = await memoryManager.checkMemory();
                    if (memoryStatus === 'critical') {
                        // Em estado crítico, ignorar mensagens não essenciais
                        const isCommand = msg.message?.conversation?.startsWith(prefix) || 
                                       msg.message?.extendedTextMessage?.text?.startsWith(prefix);
                        
                        if (!isCommand) return;
                    }
                }
                
                // Verificar mensagem duplicada
                const msgId = `${msg.key.id}`;
                if (processedMessages.has(msgId)) return;
                processedMessages.add(msgId);
                
                // Limitar tamanho do conjunto de mensagens processadas
                if (processedMessages.size > 200) {
                    // Converter para array, remover metade mais antiga, e recriar conjunto
                    const messagesArray = Array.from(processedMessages);
                    processedMessages = new Set(messagesArray.slice(Math.floor(messagesArray.length / 2)));
                }
                
                // Serializar mensagem
                let m;
                try {
                    m = serialize(Yaka, msg);
                } catch (serializeError) {
                    logger.error(serializeError, "Erro ao serializar mensagem");
                    return;
                }
                
                // Verificações básicas
                if (!m.sender) return;
                const isCmd = m.body ? m.body.startsWith(prefix) : false;
                const isGroup = m.key.remoteJid.endsWith('@g.us');
                const sender = m.sender;
                const chat = m.chat;
                
                // Se não for comando e não estiver em grupo, ignorar
                if (!isCmd && !isGroup) return;
                
                // Processar grupos
                if (isGroup) {
                    // Verificar cache do grupo
                    const groupInfo = groupCache.get(chat);
                    if (groupInfo) {
                        groupInfo.lastActive = Date.now();
                        
                        // Se o grupo está sendo ignorado, pular
                        if (groupInfo.ignored) return;
                    } else {
                        groupCache.set(chat, { 
                            lastActive: Date.now(),
                            ignored: false,
                            memberCount: 0
                        });
                        
                        // Obter info do grupo quando necessário
                        if (Math.random() < 0.2) {
                            try {
                                const metadata = await Yaka.groupMetadata(chat);
                                if (metadata && metadata.participants) {
                                    groupCache.get(chat).memberCount = metadata.participants.length;
                                    
                                    // Para grupos grandes, usar modo econômico
                                    if (metadata.participants.length > 200) {
                                        groupCache.get(chat).isLarge = true;
                                    }
                                }
                            } catch (e) {}
                        }
                    }
                    
                    // Rate limiting para grupo
                    if (rateLimit(chat, 'group', true)) return;
                }
                
                // Atualizar cache de usuário
                if (!userCache.has(sender)) {
                    userCache.set(sender, {
                        lastActive: Date.now(),
                        messageCount: 1,
                        commandCount: isCmd ? 1 : 0
                    });
                } else {
                    const userData = userCache.get(sender);
                    userData.lastActive = Date.now();
                    userData.messageCount = (userData.messageCount || 0) + 1;
                    if (isCmd) {
                        userData.commandCount = (userData.commandCount || 0) + 1;
                    }
                }
                
                // Rate limiting global
                if (rateLimit(sender, 'global')) {
                    return;
                }
                
                // Processamento de comandos otimizado
                if (isCmd) {
                    // Extrair nome do comando
                    const cmdName = m.body.slice(1).split(' ')[0].toLowerCase();
                    
                    // Verificar rate limiting específico
                    if (rateLimit(sender, cmdName)) {
                        // Informar usuário apenas uma vez
                        if (!userCache.get(sender)?.warned) {
                            try {
                                Yaka.sendMessage(chat, { 
                                    text: '⚠️ Por favor, aguarde um momento antes de usar comandos novamente.'
                                }, { quoted: m }).catch(() => {});
                            } catch (e) {}
                            
                            // Marcar como avisado
                            const userData = userCache.get(sender) || {};
                            userData.warned = true;
                            userData.lastActive = Date.now();
                            userCache.set(sender, userData);
                        }
                        return;
                    }
                    
                    // Estatísticas de uso
                    cmdUsageStats.set(cmdName, (cmdUsageStats.get(cmdName) || 0) + 1);
                    
                    // Log de comandos a cada 5 comandos
                    if (Math.random() < 0.2) {
                        logger.info(`📩 ${new Date().toLocaleTimeString()} | ${cmdName} | ${sender.split('@')[0]}`);
                    }
                    
                    // Carregar comando
                    const cmd = loadCommandIfNeeded(cmdName);
                    
                    // Verificar se existe
                    if (!cmd) {
                        return;
                    }
                    
                    // Verificar se é comando pesado
                    const isHeavyCommand = ['s', 'sticker', 'play', 'video', 'ytmp3', 'ytmp4'].includes(cmdName);
                    
                    // Tentar reagir ao comando
                    if (cmd.react) {
                        try {
                            Yaka.sendMessage(chat, {
                                react: {
                                    text: cmd.react,
                                    key: m.key
                                }
                            }).catch(() => {});
                        } catch (reactError) {}
                    }
                    
                    // Verificar carga do sistema
                    const currentLoad = loadBalancer.checkLoad();
                    
                    // Em alta carga, comandos pesados vão para fila
                    if ((currentLoad && isHeavyCommand) || (isHeavyCommand && heavyCommandQueue.length > 0)) {
                        loadBalancer.queueHeavyCommand(Yaka, m, Commands, chatUpdate);
                    } else {
                        // Processar comando normalmente
                        try {
                            loadBalancer.registerCommand();
                            
                            // Verificar uso de memória antes
                            const memBefore = process.memoryUsage().heapUsed;
                            const startTime = Date.now();
                            
                            // Executar com timeout
                            const commandPromise = require("./Core.js")(Yaka, m, Commands, chatUpdate);
                            
                            // Timeout de segurança
                            const timeoutPromise = new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('Timeout de execução de comando')), 60000)
                            );
                            
                            await Promise.race([commandPromise, timeoutPromise])
                                .catch(err => {
                                    logger.error(err, `Erro em comando ${cmdName}`);
                                    
                                    // Registrar erro para comandos problemáticos
                                    if (commandErrorTracker.trackError(cmdName)) {
                                        // Comando foi para blacklist
                                        try {
                                            Yaka.sendMessage(chat, { 
                                                text: `⚠️ O comando *${cmdName}* foi temporariamente desabilitado por causar erros.`
                                            }, { quoted: m }).catch(() => {});
                                        } catch (e) {}
                                    }
                                    
                                    // Notificar erro
                                    try {
                                        Yaka.sendMessage(chat, { 
                                            text: `❌ Erro ao processar comando *${cmdName}*. Por favor, tente novamente.`
                                        }, { quoted: m }).catch(() => {});
                                    } catch (e) {}
                                });
                            
                            loadBalancer.completeCommand();
                            
                            // Verificar performance
                            const execTime = Date.now() - startTime;
                            const memAfter = process.memoryUsage().heapUsed;
                            const memDiff = memAfter - memBefore;
                            
                            // Registrar comandos intensivos
                            if (execTime > 5000 || memDiff > 20 * 1024 * 1024) {
                                logger.warn(`⚙️ Comando ${cmdName}: ${execTime}ms, ${Math.round(memDiff/1024/1024)}MB`);
                                
                                // Verificar se precisa limpar memória
                                if (memDiff > 50 * 1024 * 1024) {
                                    memoryManager.gc();
                                }
                            }
                        } catch (err) {
                            logger.error(err, `Erro em comando ${cmdName}`);
                            loadBalancer.completeCommand();
                            
                            // Registrar erro para blacklist
                            commandErrorTracker.trackError(cmdName);
                            
                            // Notificar erro
                            try {
                                Yaka.sendMessage(chat, { 
                                    text: `❌ Ocorreu um erro ao processar o comando. Por favor, tente novamente.`
                                }, { quoted: m }).catch(() => {});
                            } catch (e) {}
                        }
                    }
                }
            } catch (err) {
                logger.error(err, "Erro no processador de mensagens");
            }
        });

        // Funções utilitárias otimizadas
        Yaka.decodeJid = (jid) => {
            if (!jid) return jid;
            try {
                if (jid.includes(':')) {
                    const decoded = jidDecode(jid);
                    return decoded?.user ? decoded.user + '@' + decoded.server : jid;
                } else {
                    return jid;
                }
            } catch (e) {
                return jid;
            }
        };

        // Função para obter nomes
        Yaka.getName = (jid, withoutContact = false) => {
            try {
                const id = Yaka.decodeJid(jid);
                if (!id) return '';
                // Verificar cache primeiro
                if (userCache.has(id)) {
                    return userCache.get(id).name || id.split('@')[0];
                    }
                
                let v;
                if (id.endsWith("@g.us")) {
                    // Grupos
                    v = store.contacts[id] || {};
                    if (!(v.name || v.subject)) {
                        if (groupCache.has(id)) {
                            return groupCache.get(id).name || id.split('@')[0];
                        }
                        // Carregar apenas se necessário
                        try {
                            v = Yaka.groupMetadata(id) || {};
                        } catch (e) {
                            return id.split('@')[0];
                        }
                        // Cachear para futuras referências
                        groupCache.set(id, { 
                            name: v.name || v.subject,
                            lastActive: Date.now() 
                        });
                    }
                    return v.name || v.subject || id.split('@')[0];
                } else {
                    // Usuários individuais
                    v = id === '0@s.whatsapp.net' ? { name: 'WhatsApp' } :
                        id === Yaka.decodeJid(Yaka.user?.id) ? Yaka.user :
                        store.contacts[id] || {};
                    
                    // Cachear para futuras referências
                    userCache.set(id, { 
                        name: v.name || v.verifiedName || id.split('@')[0],
                        lastActive: Date.now() 
                    });
                    
                    return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || id.split('@')[0];
                }
            } catch (error) {
                return jid.split('@')[0];
            }
        };

        // Atualização de contatos
        Yaka.ev.on('contacts.update', updates => {
            try {
                if (!Array.isArray(updates)) return;
                
                for (const update of updates) {
                    try {
                        const id = Yaka.decodeJid(update.id);
                        if (!id) continue;
                        
                        if (store?.contacts) store.contacts[id] = { id, name: update.notify };
                        
                        // Atualizar cache
                        if (userCache.has(id)) {
                            userCache.get(id).name = update.notify;
                        }
                    } catch (e) {}
                }
            } catch (err) {
                logger.error(err, "Erro ao atualizar contatos");
            }
        });
        
        // Funções de envio otimizadas
        Yaka.sendButtonText = async (jid, buttons = [], text, footer, quoted = '', options = {}) => {
            try {
                let buttonMessage = {
                    text,
                    footer,
                    buttons,
                    headerType: 2,
                    ...options
                };
                return await Yaka.sendMessage(jid, buttonMessage, { quoted, ...options });
            } catch (err) {
                logger.error(err, "Erro no sendButtonText");
                return null;
            }
        };

        Yaka.sendText = async (jid, text, quoted = '', options = {}) => {
            try {
                return await Yaka.sendMessage(jid, { text, ...options }, { quoted });
            } catch (err) {
                logger.error(err, "Erro no sendText");
                return null;
            }
        };

        // Função de envio de imagem otimizada
        Yaka.sendImage = async (jid, path, caption = '', quoted = '', options = {}) => {
            try {
                let buffer;
                
                // Obter buffer da forma mais eficiente
                if (Buffer.isBuffer(path)) {
                    buffer = path;
                } else if (typeof path === 'string') {
                    if (path.startsWith('data:image')) {
                        buffer = Buffer.from(path.split`,`[1], 'base64');
                    } else if (path.startsWith('http')) {
                        try {
                            buffer = await getBuffer(path);
                        } catch (fetchErr) {
                            logger.error(fetchErr, "Erro ao baixar imagem");
                            throw new Error("Falha ao baixar imagem do URL");
                        }
                    } else if (fs.existsSync(path)) {
                        buffer = fs.readFileSync(path);
                    } else {
                        throw new Error("Caminho de imagem inválido: " + path);
                    }
                } else {
                    throw new Error("Tipo de path inválido para imagem");
                }
                
                // Verificar tamanho do buffer
                if (!buffer || buffer.length === 0) {
                    throw new Error("Buffer de imagem vazio");
                }
                
                // Otimizar imagens grandes
                if (buffer.length > 5 * 1024 * 1024) {
                    logger.warn(`⚠️ Imagem grande (${Math.round(buffer.length/1024/1024)}MB) sendo redimensionada`);
                    
                    // Salvar em arquivo temporário
                    const tempFile = path.join(TEMP_DIR, `temp_img_${Date.now()}.jpg`);
                    fs.writeFileSync(tempFile, buffer);
                    
                    // Limpar buffer original
                    buffer = null;
                    
                    try {
                        // Redimensionar com ffmpeg
                        await execPromise(`ffmpeg -i "${tempFile}" -vf "scale=800:800:force_original_aspect_ratio=decrease" -q:v 80 "${tempFile}_opt.jpg" -y`);
                        
                        // Verificar se arquivo otimizado existe
                        if (fs.existsSync(`${tempFile}_opt.jpg`)) {
                            buffer = fs.readFileSync(`${tempFile}_opt.jpg`);
                            
                            // Limpar arquivos temporários
                            try {
                                fs.unlinkSync(tempFile);
                                fs.unlinkSync(`${tempFile}_opt.jpg`);
                            } catch (e) {}
                        } else {
                            // Fallback para arquivo original
                            buffer = fs.readFileSync(tempFile);
                            
                            // Limpar arquivo temporário
                            try {
                                fs.unlinkSync(tempFile);
                            } catch (e) {}
                        }
                    } catch (e) {
                        logger.error(e, "Erro ao otimizar imagem grande");
                        
                        // Fallback para arquivo original
                        buffer = fs.readFileSync(tempFile);
                        
                        // Limpar arquivo temporário
                        try {
                            fs.unlinkSync(tempFile);
                        } catch (e) {}
                    }
                }
                
                // Enviar com tratamento de erro
                try {
                    const result = await Yaka.sendMessage(jid, { 
                        image: buffer, 
                        caption: caption || '', 
                        ...options 
                    }, { quoted });
                    
                    // Limpar referência para ajudar GC
                    buffer = null;
                    
                    return result;
                } catch (sendErr) {
                    // Tentar método alternativo
                    logger.error(sendErr, "Erro ao enviar imagem, tentando método alternativo");
                    
                    // Se a imagem for muito grande, tentar enviar como documento
                    if (sendErr.message && sendErr.message.includes("too large")) {
                        return await Yaka.sendMessage(jid, {
                            document: buffer,
                            mimetype: 'image/jpeg',
                            fileName: 'image.jpg',
                            caption
                        }, { quoted });
                    }
                    
                    throw sendErr;
                }
            } catch (err) {
                logger.error(err, "Erro final no sendImage");
                
                // Tentar enviar mensagem de erro
                try {
                    await Yaka.sendMessage(jid, { 
                        text: `⚠️ Erro ao enviar imagem: ${err.message}` 
                    }, { quoted });
                } catch (e) {}
                
                return null;
            }
        };

        // Função de envio de vídeo otimizada
        Yaka.sendVideo = async (jid, path, caption = '', quoted = '', gif = false, options = {}) => {
            try {
                let buffer;
                
                // Obter buffer da forma mais eficiente
                if (Buffer.isBuffer(path)) {
                    buffer = path;
                } else if (typeof path === 'string') {
                    if (path.startsWith('data:video')) {
                        buffer = Buffer.from(path.split`,`[1], 'base64');
                    } else if (path.startsWith('http')) {
                        try {
                            buffer = await getBuffer(path);
                        } catch (fetchErr) {
                            logger.error(fetchErr, "Erro ao baixar vídeo");
                            throw new Error("Falha ao baixar vídeo do URL");
                        }
                    } else if (fs.existsSync(path)) {
                        buffer = fs.readFileSync(path);
                    } else {
                        throw new Error("Caminho de vídeo inválido: " + path);
                    }
                } else {
                    throw new Error("Tipo de path inválido para vídeo");
                }
                
                // Verificar tamanho do buffer
                if (!buffer || buffer.length === 0) {
                    throw new Error("Buffer de vídeo vazio");
                }
                
                // Otimizar vídeos grandes
                if (buffer.length > 15 * 1024 * 1024) {
                    logger.warn(`⚠️ Vídeo grande (${Math.round(buffer.length/1024/1024)}MB) sendo comprimido`);
                    
                    // Salvar em arquivo temporário
                    const tempFile = path.join(TEMP_DIR, `temp_video_${Date.now()}.mp4`);
                    fs.writeFileSync(tempFile, buffer);
                    
                    // Limpar buffer original
                    buffer = null;
                    
                    try {
                        // Comprimir com ffmpeg
                        const outputFile = `${tempFile}_opt.mp4`;
                        await execPromise(`ffmpeg -i "${tempFile}" -c:v libx264 -crf 28 -preset medium -c:a aac -b:a 96k -movflags +faststart "${outputFile}" -y`);
                        
                        // Verificar se arquivo otimizado existe
                        if (fs.existsSync(outputFile)) {
                            buffer = fs.readFileSync(outputFile);
                            
                            // Limpar arquivos temporários
                            try {
                                fs.unlinkSync(tempFile);
                                fs.unlinkSync(outputFile);
                            } catch (e) {}
                        } else {
                            // Mensagem de erro, vídeo não pode ser enviado
                            throw new Error("Vídeo muito grande para enviar");
                        }
                    } catch (e) {
                        logger.error(e, "Erro ao otimizar vídeo grande");
                        throw new Error("Vídeo muito grande para enviar");
                    }
                }
                
                // Enviar com tratamento de erro
                try {
                    const result = await Yaka.sendMessage(jid, { 
                        video: buffer, 
                        caption: caption || '', 
                        gifPlayback: !!gif, 
                        ...options 
                    }, { quoted });
                    
                    // Limpar referência para ajudar GC
                    buffer = null;
                    
                    return result;
                } catch (sendErr) {
                    logger.error(sendErr, "Erro ao enviar vídeo");
                    
                    // Limpar memória
                    buffer = null;
                    
                    throw sendErr;
                }
            } catch (err) {
                logger.error(err, "Erro final no sendVideo");
                
                // Tentar enviar mensagem de erro
                try {
                    await Yaka.sendMessage(jid, { 
                        text: `⚠️ Erro ao enviar vídeo: ${err.message}` 
                    }, { quoted });
                } catch (e) {}
                
                return null;
            }
        };

        // Função de áudio otimizada
        Yaka.sendAudio = async (jid, path, quoted = '', ptt = false, options = {}) => {
            try {
                let buffer;
                
                // Obter buffer da forma mais eficiente
                if (Buffer.isBuffer(path)) {
                    buffer = path;
                } else if (typeof path === 'string') {
                    if (path.startsWith('data:audio')) {
                        buffer = Buffer.from(path.split`,`[1], 'base64');
                    } else if (path.startsWith('http')) {
                        try {
                            buffer = await getBuffer(path);
                        } catch (fetchErr) {
                            logger.error(fetchErr, "Erro ao baixar áudio");
                            throw new Error("Falha ao baixar áudio do URL");
                        }
                    } else if (fs.existsSync(path)) {
                        buffer = fs.readFileSync(path);
                    } else {
                        throw new Error("Caminho de áudio inválido: " + path);
                    }
                } else {
                    throw new Error("Tipo de path inválido para áudio");
                }
                
                // Verificar tamanho do buffer
                if (!buffer || buffer.length === 0) {
                    throw new Error("Buffer de áudio vazio");
                }
                
                // Comprimir áudios grandes
                if (buffer.length > 8 * 1024 * 1024) {
                    logger.warn(`⚠️ Áudio grande (${Math.round(buffer.length/1024/1024)}MB) sendo comprimido`);
                    
                    // Salvar em arquivo temporário
                    const tempFile = path.join(TEMP_DIR, `temp_audio_${Date.now()}.mp3`);
                    fs.writeFileSync(tempFile, buffer);
                    
                    // Limpar buffer original
                    buffer = null;
                    
                    try {
                        // Comprimir com ffmpeg
                        const outputFile = `${tempFile}_opt.mp3`;
                        await execPromise(`ffmpeg -i "${tempFile}" -codec:a libmp3lame -b:a 96k "${outputFile}" -y`);
                        
                        // Verificar se arquivo otimizado existe
                        if (fs.existsSync(outputFile)) {
                            buffer = fs.readFileSync(outputFile);
                            
                            // Limpar arquivos temporários
                            try {
                                fs.unlinkSync(tempFile);
                                fs.unlinkSync(outputFile);
                            } catch (e) {}
                        } else {
                            // Fallback para arquivo original
                            buffer = fs.readFileSync(tempFile);
                            
                            // Limpar arquivo temporário
                            try {
                                fs.unlinkSync(tempFile);
                            } catch (e) {}
                        }
                    } catch (e) {
                        logger.error(e, "Erro ao otimizar áudio grande");
                        
                        // Fallback para arquivo original
                        buffer = fs.readFileSync(tempFile);
                        
                        // Limpar arquivo temporário
                        try {
                            fs.unlinkSync(tempFile);
                        } catch (e) {}
                    }
                }
                
                // Enviar com tratamento de erro
                const result = await Yaka.sendMessage(jid, { 
                    audio: buffer, 
                    ptt: !!ptt, 
                    ...options 
                }, { quoted });
                
                // Limpar referência para ajudar GC
                buffer = null;
                
                return result;
            } catch (err) {
                logger.error(err, "Erro no sendAudio");
                return null;
            }
        };

        // Menções otimizadas
        Yaka.sendTextWithMentions = async (jid, text, quoted, options = {}) => {
            try {
                // Extrair menções
                const mentions = [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net');
                
                return await Yaka.sendMessage(jid, { 
                    text, 
                    mentions, 
                    ...options 
                }, { quoted });
            } catch (err) {
                logger.error(err, "Erro no sendTextWithMentions");
                return null;
            }
        };

        // Sticker otimizado
        Yaka.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
            try {
                let buffer;
                
                // Obter buffer da forma mais eficiente
                if (Buffer.isBuffer(path)) {
                    buffer = path;
                } else if (typeof path === 'string') {
                    if (path.startsWith('data:image')) {
                        buffer = Buffer.from(path.split`,`[1], 'base64');
                    } else if (path.startsWith('http')) {
                        try {
                            buffer = await getBuffer(path);
                        } catch (fetchErr) {
                            logger.error(fetchErr, "Erro ao baixar imagem para sticker");
                            throw new Error("Falha ao baixar imagem para sticker");
                        }
                    } else if (fs.existsSync(path)) {
                        buffer = fs.readFileSync(path);
                    } else {
                        throw new Error("Caminho de imagem inválido para sticker: " + path);
                    }
                } else {
                    throw new Error("Tipo de path inválido para sticker");
                }
                
                // Verificar tamanho do buffer
                if (!buffer || buffer.length === 0) {
                    throw new Error("Buffer vazio para sticker");
                }
                
                // Processar sticker com tratamento de erro avançado
                try {
                    // Usar diretório temporário
                    const tempInputFile = path.join(TEMP_DIR, `sticker_in_${Date.now()}.png`);
                    const tempOutputFile = path.join(TEMP_DIR, `sticker_out_${Date.now()}.webp`);
                    
                    // Salvar buffer em arquivo temporário
                    fs.writeFileSync(tempInputFile, buffer);
                    
                    // Liberar buffer para economia de memória
                    buffer = null;
                    
                    // Processar com ffmpeg
                    await execPromise(`ffmpeg -i "${tempInputFile}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -compression_level 6 -quality 75 -y "${tempOutputFile}"`);
                    
                    // Verificar se o arquivo de saída existe
                    if (!fs.existsSync(tempOutputFile)) {
                        throw new Error("Falha ao converter para webp");
                    }
                    
                    // Adicionar metadados se necessário
                    let finalWebpPath = tempOutputFile;
                    if (options && (options.packname || options.author)) {
                        try {
                            finalWebpPath = await writeExifImg(fs.readFileSync(tempOutputFile), options);
                        } catch (exifErr) {
                            logger.error(exifErr, "Erro ao adicionar metadados ao sticker");
                            // Continuar sem metadados
                        }
                    }
                    
                    // Ler arquivo final
                    const webpBuffer = fs.readFileSync(finalWebpPath);
                    
                    // Enviar sticker
                    const result = await Yaka.sendMessage(jid, { 
                        sticker: webpBuffer
                    }, { quoted });
                    
                    // Limpar arquivos temporários
                    try {
                        fs.unlinkSync(tempInputFile);
                        fs.unlinkSync(tempOutputFile);
                        if (finalWebpPath !== tempOutputFile) {
                            fs.unlinkSync(finalWebpPath);
                        }
                    } catch (e) {}
                    
                    return result;
                } catch (processErr) {
                    logger.error(processErr, "Erro ao processar imagem para sticker");
                    
                    // Método alternativo
                    try {
                        logger.info("🔄 Tentando método alternativo para sticker...");
                        
                        // Converter para webp usando função da biblioteca
                        const webp = options && (options.packname || options.author) ?
                                      await writeExifImg(buffer, options) :
                                      await imageToWebp(buffer);
                                      
                        if (!webp) throw new Error("Falha ao converter para webp (método alternativo)");
                        
                        const result = await Yaka.sendMessage(jid, { 
                            sticker: { url: webp }
                        }, { quoted });
                        
                        return result;
                    } catch (fallbackErr) {
                        logger.error(fallbackErr, "Método alternativo para sticker falhou");
                        throw fallbackErr;
                    }
                }
            } catch (err) {
                logger.error(err, "Erro final no sendImageAsSticker");
                
                // Tentar enviar mensagem de erro
                try {
                    await Yaka.sendMessage(jid, { 
                        text: `⚠️ Não foi possível criar a figurinha. Por favor, tente novamente com outra imagem.` 
                    }, { quoted });
                } catch (e) {}
                
                return null;
            }
        };

        // Vídeo para sticker otimizado
        Yaka.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
            try {
                let buffer;
                
                // Obter buffer da forma mais eficiente
                if (Buffer.isBuffer(path)) {
                    buffer = path;
                } else if (typeof path === 'string') {
                    if (path.startsWith('data:video')) {
                        buffer = Buffer.from(path.split`,`[1], 'base64');
                    } else if (path.startsWith('http')) {
                        try {
                            buffer = await getBuffer(path);
                        } catch (fetchErr) {
                            logger.error(fetchErr, "Erro ao baixar vídeo para sticker");
                            throw new Error("Falha ao baixar vídeo para sticker");
                        }
                    } else if (fs.existsSync(path)) {
                        buffer = fs.readFileSync(path);
                    } else {
                        throw new Error("Caminho de vídeo inválido para sticker");
                    }
                } else {
                    throw new Error("Tipo de path inválido para sticker de vídeo");
                }
                
                // Verificar tamanho do buffer
                if (!buffer || buffer.length === 0) {
                    throw new Error("Buffer vazio para sticker de vídeo");
                }
                
                // Processar vídeo para sticker
                try {
                    const tempInputFile = path.join(TEMP_DIR, `vsticker_in_${Date.now()}.mp4`);
                    const tempOutputFile = path.join(TEMP_DIR, `vsticker_out_${Date.now()}.webp`);
                    
                    // Salvar buffer em arquivo temporário
                    fs.writeFileSync(tempInputFile, buffer);
                    
                    // Liberar buffer para economia de memória
                    buffer = null;
                    
                    // Processar com ffmpeg - otimizado para melhor qualidade e menor tamanho
                    await execPromise(`ffmpeg -i "${tempInputFile}" -vf "fps=12,scale=256:256:force_original_aspect_ratio=decrease,format=rgba,pad=256:256:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -c:v libwebp -lossless 0 -compression_level 6 -q:v 70 -loop 0 -preset default -an -vsync 0 -t 00:00:05 "${tempOutputFile}" -y`);
                    
                    // Verificar se o arquivo de saída existe
                    if (!fs.existsSync(tempOutputFile)) {
                        throw new Error("Falha ao converter vídeo para webp");
                    }
                    
                    // Adicionar metadados se necessário
                    let finalWebpPath = tempOutputFile;
                    if (options && (options.packname || options.author)) {
                        try {
                            finalWebpPath = await writeExifVid(fs.readFileSync(tempOutputFile), options);
                        } catch (exifErr) {
                            logger.error(exifErr, "Erro ao adicionar metadados ao sticker de vídeo");
                            // Continuar sem metadados
                        }
                    }
                    
                    // Ler arquivo final
                    const webpBuffer = fs.readFileSync(finalWebpPath);
                    
                    // Enviar sticker
                    const result = await Yaka.sendMessage(jid, { 
                        sticker: webpBuffer
                    }, { quoted });
                    
                    // Limpar arquivos temporários
                    try {
                        fs.unlinkSync(tempInputFile);
                        fs.unlinkSync(tempOutputFile);
                        if (finalWebpPath !== tempOutputFile) {
                            fs.unlinkSync(finalWebpPath);
                        }
                    } catch (e) {}
                    
                    return result;
                } catch (processErr) {
                    logger.error(processErr, "Erro ao processar vídeo para sticker");
                    
                    // Método alternativo
                    try {
                        logger.info("🔄 Tentando método alternativo para sticker de vídeo...");
                        
                        // Converter para webp usando função da biblioteca
                        const webp = options && (options.packname || options.author) ?
                                      await writeExifVid(buffer, options) :
                                      await videoToWebp(buffer);
                                      
                        if (!webp) throw new Error("Falha ao converter vídeo para webp (método alternativo)");
                        
                        const result = await Yaka.sendMessage(jid, { 
                            sticker: { url: webp }
                        }, { quoted });
                        
                        return result;
                    } catch (fallbackErr) {
                        logger.error(fallbackErr, "Método alternativo para sticker de vídeo falhou");
                        throw fallbackErr;
                    }
                }
            } catch (err) {
                logger.error(err, "Erro final no sendVideoAsSticker");
                
                // Tentar enviar mensagem de erro
                try {
                    await Yaka.sendMessage(jid, { 
                        text: `⚠️ Não foi possível criar a figurinha animada. Por favor, tente novamente com outro vídeo.` 
                    }, { quoted });
                } catch (e) {}
                
                return null;
            }
        };

        // Reação para comandos
        Yaka.reactCmd = async function(msg, text) {
            try {
                if (!msg || !msg.key || !text) return;
                
                const cmdName = text.split(" ")[0].slice(1).toLowerCase();
                const cmd = loadCommandIfNeeded(cmdName);
                
                if (cmd && cmd.react) {
                    await this.sendMessage(msg.chat, {
                        react: {
                            text: cmd.react,
                            key: msg.key
                        }
                    }).catch(() => {});
                }
            } catch (error) {
                // Silenciar erro
                logger.debug(error, "Erro ao reagir a comando");
            }
        };

        // Otimização de grupos
        Yaka.optimizeGroups = function() {
            try {
                const now = Date.now();
                let stats = { hibernated: 0, large: 0, inactive: 0 };
                
                // Categorizar grupos
                const groups = [...groupCache.entries()];
                
                // Grupos grandes
                const largeGroups = groups.filter(([_, data]) => data.memberCount > 150);
                stats.large = largeGroups.length;
                
                // Grupos inativos (12 horas)
                const inactiveGroups = groups.filter(([_, data]) => now - data.lastActive > 43200000);
                stats.inactive = inactiveGroups.length;
                
                // Em alta carga, hibernar grupos inativos
                if (loadBalancer.isHighLoad) {
                    inactiveGroups.forEach(([jid]) => {
                        this.ignoreGroup(jid, true);
                        stats.hibernated++;
                    });
                    
                    logger.info(`🔄 Otimização em alta carga: ${stats.hibernated} grupos hibernados`);
                } else {
                    // Em carga normal, hibernar apenas grupos muito inativos (24 horas)
                    const veryInactive = groups.filter(([_, data]) => now - data.lastActive > 86400000);
                    veryInactive.forEach(([jid]) => {
                        this.ignoreGroup(jid, true);
                        stats.hibernated++;
                    });
                    
                    if (stats.hibernated > 0) {
                        logger.info(`🔄 Otimização: ${stats.hibernated} grupos hibernados`);
                    }
                }
                
                return stats;
            } catch (e) {
                logger.error(e, "Erro ao otimizar grupos");
                return { error: e.message };
            }
        };

        // Menu otimizado
        Yaka.getMenu = function() {
            try {
                // Verificar cache
                if (Commands.menuCache) {
                    return Commands.menuCache;
                }
                
                // Verificar arquivo de cache
                if (fs.existsSync(CACHE_FILE)) {
                    try {
                        const menuData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
                        Commands.menuCache = menuData;
                        logger.info("✅ Arquivo de menu em cache carregado com sucesso");
                        return menuData;
                    } catch (e) {
                        logger.error(e, "Erro ao ler cache de menu");
                    }
                }
                
                // Gerar menu
                const menu = {};
                if (Commands && Commands.category) {
                    for (const category of Commands.category) {
                        const cmds = Commands.list && Commands.list[category.toLowerCase()];
                        if (cmds && Array.isArray(cmds)) {
                            // Filtrar comandos na blacklist
                            const validCmds = cmds.filter(cmd => !commandBlacklist.has(cmd.name));
                            
                            menu[category] = validCmds.map(cmd => ({
                                name: cmd.name,
                                desc: cmd.desc || 'Sem descrição',
                                usage: cmd.usage || `.${cmd.name}`
                            }));
                        }
                    }
                }
                // Salvar em cache
                Commands.menuCache = menu;
                
                // Salvar em disco
                try {
                    if (!fs.existsSync(CACHE_DIR)) {
                        fs.mkdirSync(CACHE_DIR, { recursive: true });
                    }
                    fs.writeFileSync(CACHE_FILE, JSON.stringify(menu));
                } catch (e) {
                    logger.error(e, "Erro ao salvar cache de menu");
                }
                
                return menu;
            } catch (err) {
                logger.error(err, "Erro ao gerar menu");
                return { Erro: "Não foi possível carregar o menu" };
            }
        };

        // Funções de grupo
        Yaka.getGroupAdmins = function(participants) {
            if (!participants || !Array.isArray(participants)) return [];
            
            try {
                return participants
                    .filter(p => p.admin === "admin" || p.admin === "superadmin")
                    .map(p => p.id);
            } catch (err) {
                logger.error(err, "Erro ao obter admins");
                return [];
            }
        };

        // Ignorar grupos
        Yaka.ignoreGroup = function(jid, shouldIgnore = true) {
            try {
                if (!jid) return false;
                
                if (groupCache.has(jid)) {
                    groupCache.get(jid).ignored = shouldIgnore;
                } else {
                    groupCache.set(jid, { 
                        ignored: shouldIgnore,
                        lastActive: Date.now()
                    });
                }
                
                return true;
            } catch (e) {
                logger.error(e, "Erro ao configurar ignore de grupo");
                return false;
            }
        };

        // Modo de baixa memória
        Yaka.enableLowMemoryMode = function() {
            try {
                logger.info("🚀 Modo de Baixa Memória ativado!");
                
                // Configurar limites mais restritos
                MESSAGE_LIMIT = 2;
                COOLDOWN_PERIOD = 6000;
                
                // Limpar caches
                memoryManager.adaptiveCacheCleanup('aggressive');
                
                // Otimizar grupos
                this.optimizeGroups();
                
                // Forçar coleta de lixo
                memoryManager.gc();
                
                // Limpar comandos raramente usados
                const essentialCommands = ['menu', 'help', 's', 'sticker'];
                let removedCount = 0;
                
                for (const cmd of Commands.keys()) {
                    if (!essentialCommands.includes(cmd)) {
                        Commands.delete(cmd);
                        removedCount++;
                    }
                }
                
                logger.info(`🧹 ${removedCount} comandos não essenciais descarregados`);
                
                return true;
            } catch (e) {
                logger.error(e, "Erro ao ativar modo de baixa memória");
                return false;
            }
        };

        // Sistema de diagnóstico otimizado
        Yaka.diagnostics = {
            errors: [],
            lastCheck: Date.now(),
            
            logError: function(type, message, stack) {
                // Limitar número de erros
                if (this.errors.length >= 20) this.errors.shift();
                
                this.errors.push({
                    type,
                    message,
                    stack: stack || '',
                    time: new Date().toISOString()
                });
                
                logger.error({ type, message }, "Erro registrado no diagnóstico");
            },
            
            healthCheck: function() {
                const now = Date.now();
                this.lastCheck = now;
                
                const memUsage = memoryManager.getMemoryUsage();
                const isHighMemory = memUsage.heapUsed > MAX_MEMORY_MB * 0.85;
                
                return {
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    memory: memUsage,
                    isHighMemory,
                    systemLoad: loadBalancer.isHighLoad ? 'Alto' : 'Normal',
                    connectionStatus: status,
                    stats: {
                        groups: groupCache.size,
                        users: userCache.size,
                        commands: Commands.size,
                        queueSize: heavyCommandQueue.length,
                        pendingCommands: loadBalancer.commandsPending,
                        processedMessages: processedMessages.size,
                        blacklistedCommands: commandBlacklist.size
                    },
                    errorCount: this.errors.length,
                    recentErrors: this.errors.slice(-5),
                    memoryWarnings: memoryWarnings.slice(-5),
                    connectionHistory: connectionHistory.slice(-5)
                };
            },
            
            autoRecover: async function() {
                logger.info("🔄 Iniciando recuperação automática...");
                
                // Verificar memória
                const memUsage = memoryManager.getMemoryUsage();
                if (memUsage.heapUsed > MAX_MEMORY_MB * 0.7) {
                    await memoryManager.emergencyCleanup();
                }
                
                // Limpar histórico de erros
                commandErrorTracker.resetErrors();
                this.errors = [];
                
                // Resetar limites
                MESSAGE_LIMIT = 5;
                COOLDOWN_PERIOD = 3500;
                
                // Limpar filas
                heavyCommandQueue.length = 0;
                isProcessingHeavyCommand = false;
                activeHeavyCommands = 0;
                
                // Otimizar grupos
                if (Yaka.optimizeGroups) {
                    Yaka.optimizeGroups();
                }
                
                // Forçar GC
                memoryManager.gc();
                
                logger.info("✅ Recuperação automática concluída");
                return true;
            }
        };

        // Status e estatísticas simplificadas
        Yaka.getStatus = function() {
            try {
                const memUsage = memoryManager.getMemoryUsage();
                
                // Estatísticas de comandos mais usados
                const topCommands = [...cmdUsageStats.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .reduce((obj, [cmd, count]) => {
                        obj[cmd] = count;
                        return obj;
                    }, {});
                
                return {
                    status: status || "unknown",
                    uptime: formatUptime(process.uptime()),
                    memory: memUsage,
                    memoryFormatted: `${memUsage.heapUsed}/${MAX_MEMORY_MB}MB (${Math.round(memUsage.heapUsed/MAX_MEMORY_MB*100)}%)`,
                    connections: {
                        groups: groupCache.size,
                        users: userCache.size,
                        activeCommands: loadBalancer.commandsPending
                    },
                    system: {
                        load: loadBalancer.isHighLoad ? 'Alto' : 'Normal',
                        queueSize: heavyCommandQueue.length,
                        reconnects: reconnectAttempts
                    },
                    topCommands,
                    timestamp: new Date().toISOString()
                };
            } catch (e) {
                logger.error(e, "Erro ao obter status");
                return {
                    status: "error",
                    error: e.message,
                    timestamp: new Date().toISOString()
                };
            }
        };

        // Formatador de uptime
        function formatUptime(seconds) {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            
            let result = '';
            if (days > 0) result += `${days}d `;
            if (hours > 0) result += `${hours}h `;
            if (minutes > 0) result += `${minutes}m `;
            result += `${secs}s`;
            
            return result;
        }

        // Iniciar limpeza de temporários
        if (!global.listenersRegistered.tempCleaner) {
            global.listenersRegistered.tempCleaner = true;
            // Limpar a cada hora
            const tempCleaner = setInterval(cleanupTempFiles, 3600000);
            
            // Limpar ao encerrar
            if (!global.listenersRegistered.exit) {
                global.listenersRegistered.exit = true;
                process.once('exit', () => {
                    clearInterval(tempCleaner);
                });
            }
        }

        // Otimização de grupos a cada 2 horas
        const groupOptimizer = setInterval(() => {
            if (Yaka && Yaka.optimizeGroups) {
                Yaka.optimizeGroups();
            }
        }, 7200000);

        return Yaka;
    } catch (err) {
        logger.error(err, "Erro crítico ao iniciar");
        
        // Tentar limpeza antes de reiniciar
        try {
            memoryManager.gc();
            memoryManager.adaptiveCacheCleanup('aggressive');
        } catch (e) {}
        
        // Delay exponencial para evitar loops
        const backoffDelay = Math.min(5000 * Math.pow(1.5, reconnectAttempts), 60000);
        logger.info(`🔄 Tentando reiniciar em ${Math.round(backoffDelay/1000)}s...`);
        
        setTimeout(startYaka, backoffDelay);
    }
}

// Iniciar o bot
startYaka().catch(err => {
    logger.fatal(err, "Erro fatal ao iniciar o bot");
    process.exit(1);
});

// Servidor web otimizado
const server = app.listen(PORT, () => {
    logger.info(`✅ Servidor web ativo na porta ${PORT}`);
});

// Melhor tratamento de erros do servidor
server.on('error', (err) => {
    logger.error(err, "Erro no servidor web");
    
    if (err.code === 'EADDRINUSE') {
        logger.info(`Porta ${PORT} em uso. Tentando ${PORT + 1}...`);
        setTimeout(() => {
            server.close();
            server.listen(PORT + 1);
        }, 1000);
    }
});

// Configuração de rotas simplificada
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Rate limiting para proteção de API
const apiRateLimiter = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const key = `api:${ip}`;
    
    if (rateLimit(key, 'api')) {
        return res.status(429).json({ 
            error: "Muitas requisições. Tente novamente em alguns segundos.",
            retry_after: COOLDOWN_PERIOD / 1000
        });
    }
    
    next();
};

// Aplicar rate limiter
app.use(apiRateLimiter);

// Servir interface web
app.use("/", express.static(join(__dirname, "Page")));

// Rota para QR code
app.get("/qr", async (req, res) => {
    try {
        const { session } = req.query;
        if (!session) {
            return res.status(404).json({ error: "Forneça o ID da sessão" });
        }
        
        if (global.sessionId !== session) {
            return res.status(403).json({ error: "Sessão inválida" });
        }
        
        if (status === "open") {
            return res.status(200).json({ message: "Sessão já conectada" });
        }
        
        if (!QR_GENERATE || QR_GENERATE === "invalid") {
            return res.status(404).json({ error: "QR Code não disponível" });
        }
        
        res.setHeader("content-type", "image/png");
        res.send(await qrcode.toBuffer(QR_GENERATE));
    } catch (err) {
        logger.error(err, "Erro ao gerar QR");
        res.status(500).json({ error: "Erro interno ao gerar QR code" });
    }
});

// Rota de status simplificada
app.get("/status", (req, res) => {
    try {
        if (!global.YakaBot) {
            return res.json({
                status: "initializing",
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            });
        }
        
        // Resposta básica
        const memUsage = memoryManager.getMemoryUsage();
        res.json({
            status: status || "unknown",
            uptime: formatUptime(process.uptime()),
            memory: `${memUsage.heapUsed}MB / ${MAX_MEMORY_MB}MB (${Math.round(memUsage.heapUsed/MAX_MEMORY_MB*100)}%)`,
            groups: groupCache.size,
            users: userCache.size,
            commands: Commands.size,
            activeCommands: loadBalancer.commandsPending,
            queueSize: heavyCommandQueue.length,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        logger.error(err, "Erro na rota de status");
        res.status(500).json({ 
            error: "Erro ao obter status",
            message: err.message 
        });
    }
});

// Rota para limpeza de memória
app.post("/cleanup", async (req, res) => {
    try {
        // Verificar token de autenticação básico
        const { token } = req.query;
        if (token !== (global.adminToken || 'yaka_admin')) {
            return res.status(403).json({ error: "Não autorizado" });
        }
        
        const before = memoryManager.getMemoryUsage();
        await memoryManager.emergencyCleanup();
        const after = memoryManager.getMemoryUsage();
        
        res.json({
            success: true,
            memory: {
                before: before.heapUsed + ' MB',
                after: after.heapUsed + ' MB',
                difference: (before.heapUsed - after.heapUsed) + ' MB'
            },
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        logger.error(err, "Erro na rota de limpeza");
        res.status(500).json({ error: "Erro ao executar limpeza", message: err.message });
    }
});

// Rota para modo de baixa memória
app.post("/lowmemory", async (req, res) => {
    try {
        // Verificar token de autenticação
        const { token } = req.query;
        if (token !== (global.adminToken || 'yaka_admin')) {
            return res.status(403).json({ error: "Não autorizado" });
        }
        
        const result = global.YakaBot.enableLowMemoryMode();
        
        res.json({
            success: result,
            message: "Modo de baixa memória ativado com sucesso",
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        logger.error(err, "Erro ao ativar modo de baixa memória");
        res.status(500).json({ error: "Erro ao ativar modo de baixa memória", message: err.message });
    }
});

// Monitoramento de alterações no arquivo para recarregamento seguro
let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    logger.info(`${__filename} atualizado. Reiniciando sistema...`);
    
    // Limpar recursos antes de reiniciar
    try {
        // Limpar intervalos
        global.listenersRegistered = {
            exit: false,
            memCheck: false,
            tempCleaner: false
        };
    } catch (e) {}
    
    // Reiniciar processo com segurança
    process.on("exit", () => {
        require("child_process").spawn(process.argv.shift(), process.argv, {
            cwd: process.cwd(),
            detached: true,
            stdio: "inherit"
        });
    });
    
    // Pequeno delay para permitir limpeza
    setTimeout(() => {
        process.exit();
    }, 1000);
});

// Detecção de memory leaks mais eficiente
let lastMemoryUsage = 0;
const memoryLeakDetector = setInterval(() => {
    const currentMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = currentMemory - lastMemoryUsage;
    const percentIncrease = lastMemoryUsage > 0 ? (memoryIncrease / lastMemoryUsage) * 100 : 0;
    
    // Detectar aumentos grandes apenas quando não há comandos ativos
    if (lastMemoryUsage > 0 && percentIncrease > 15 && loadBalancer.commandsPending === 0) {
        logger.warn(`⚠️ Possível memory leak: ${Math.round(memoryIncrease/1024/1024)}MB (${Math.round(percentIncrease)}%)`);
        
        // Limpeza agressiva apenas em casos de detecção de leak
        memoryManager.gc();
        memoryManager.adaptiveCacheCleanup('moderate');
        
        // Em casos muito graves, limpeza de emergência
        if (currentMemory > MAX_MEMORY_MB * 0.85) {
            memoryManager.emergencyCleanup();
        }
    }
    
    lastMemoryUsage = currentMemory;
}, 600000); // A cada 10 minutos

// Adicionar ao listener centralizado
if (!global.listenersRegistered.exit) {
    global.listenersRegistered.exit = true;
    process.once('exit', () => {
        clearInterval(memoryLeakDetector);
    });
}

// Limpeza periódica de memória proativa
setInterval(() => {
    // Forçar GC e limpeza a cada hora
    memoryManager.gc();
    memoryManager.adaptiveCacheCleanup('normal');
    logger.info("🧹 Limpeza periódica de memória executada");
}, 3600000); // Uma hora

// Tratamento de erros não capturados
process.on('uncaughtException', (err) => {
    logger.fatal(err, "Erro não capturado");
    
    // Registrar erro
    if (global.YakaBot && global.YakaBot.diagnostics) {
        try {
            global.YakaBot.diagnostics.logError('uncaughtException', err.message, err.stack);
        } catch (e) {}
    }
    
    // Verificar erros fatais
    const fatalErrors = [
        'ECONNREFUSED', 'ETIMEOUT', 'ENOTFOUND', 
        'EPIPE', 'PROTOCOL_ERROR', 'CONNECTION_ERROR',
        'ERR_SOCKET_BAD_PORT'
    ];
    
    const needsRestart = fatalErrors.some(e => err.message && err.message.includes(e));
    
    if (needsRestart) {
        logger.warn("🔄 Erro crítico, reiniciando sistema...");
        
        // Limpar memória antes de sair
        try {
            memoryManager.adaptiveCacheCleanup('aggressive');
            memoryManager.gc();
        } catch (e) {}
        
        // Delay para evitar loop
        setTimeout(() => {
            process.exit(1);
        }, 5000);
    } else {
        // Erros não fatais - tentar recuperar
        try {
            if (global.YakaBot && global.YakaBot.diagnostics) {
                global.YakaBot.diagnostics.autoRecover();
            }
            
            // Forçar GC
            memoryManager.gc();
        } catch (e) {
            logger.error(e, "Falha na recuperação após erro");
        }
    }
});

// Tratamento de rejeições não capturadas
process.on('unhandledRejection', (reason, promise) => {
    // Identificar o erro
    const reasonStr = reason instanceof Error ? 
        `${reason.message}\n${reason.stack}` : 
        String(reason);
    
    logger.error({ reason: reasonStr }, "Promessa rejeitada não tratada");
    
    // Registrar erro
    if (global.YakaBot && global.YakaBot.diagnostics) {
        try {
            global.YakaBot.diagnostics.logError(
                'unhandledRejection', 
                reason instanceof Error ? reason.message : String(reason),
                reason instanceof Error ? reason.stack : ''
            );
        } catch (e) {}
    }
    
    // Limpar memória se necessário
    if (Math.random() < 0.1) { // 10% das vezes
        memoryManager.gc();
    }
});

// Capturar sinais de término
process.on('SIGTERM', () => {
    logger.info('🛑 Recebido SIGTERM, finalizando...');
    gracefulShutdown();
});

process.on('SIGINT', () => {
    logger.info('🛑 Recebido SIGINT, finalizando...');
    gracefulShutdown();
});

// Monitoramento de estabilidade periódico
setInterval(() => {
    // Verificar estabilidade
    const memUsage = memoryManager.getMemoryUsage();
    
    // Limpar memória periodicamente em casos específicos
    if (memUsage.heapUsed > MAX_MEMORY_MB * 0.65) {
        memoryManager.gc();
        memoryManager.adaptiveCacheCleanup('normal');
        logger.info(`🧹 Limpeza periódica: Mem ${memUsage.heapUsed}MB`);
    }
}, 15 * 60 * 1000); // A cada 15 minutos

// Encerramento elegante
async function gracefulShutdown() {
    logger.info('🧹 Realizando limpeza antes de encerrar...');
    
    // Fechar conexões
    try {
        if (server) {
            server.close(() => {
                logger.info("✅ Servidor web fechado");
            });
        }
    } catch (e) {
        logger.error(e, "Erro ao fechar servidor web");
    }
    
    // Desconectar banco de dados
    try {
        await mongoose.disconnect();
        logger.info("✅ Banco de dados desconectado");
    } catch (e) {
        logger.error(e, "Erro ao desconectar banco de dados");
    }
    
    // Limpeza final
    try {
        await memoryManager.adaptiveCacheCleanup('aggressive');
        memoryManager.gc();
    } catch (e) {
        logger.error(e, "Erro na limpeza final");
    }
    
    // Encerrar após 2 segundos
    setTimeout(() => {
        logger.info("👋 Bot encerrado com sucesso");
        process.exit(0);
    }, 2000);
}
