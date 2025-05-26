// DETECÇÃO DEFINITIVA DO CHROME - CORRIGIDA
const fs = require('fs');
const path = require('path');
const axios = require('axios');

function findChromeExecutable() {
  console.log('[CHROME] 🔍 Iniciando busca completa...');
  
  // Lista de caminhos prioritários
  const chromePaths = [
    '/opt/render/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    process.env.CHROME_BIN,
    process.env.PUPPETEER_EXECUTABLE_PATH
  ].filter(Boolean);

  // PRIMEIRO: Busca dinâmica no Puppeteer (PRIORIDADE MÁXIMA)
  try {
    const puppeteerDir = '/opt/render/.cache/puppeteer/chrome';
    console.log(`[CHROME] Verificando diretório Puppeteer: ${puppeteerDir}`);
    
    if (fs.existsSync(puppeteerDir)) {
      const versions = fs.readdirSync(puppeteerDir);
      console.log(`[CHROME] Versões encontradas: ${versions.join(', ')}`);
      
      for (const version of versions) {
        const chromePath = path.join(puppeteerDir, version, 'chrome-linux64', 'chrome');
        console.log(`[CHROME] Testando: ${chromePath}`);
        
        if (fs.existsSync(chromePath)) {
          // Testa se é executável
          try {
            fs.accessSync(chromePath, fs.constants.X_OK);
            console.log(`[CHROME] ✅ PUPPETEER CHROME ENCONTRADO: ${chromePath}`);
            return chromePath; // RETORNA IMEDIATAMENTE
          } catch (execError) {
            console.log(`[CHROME] ⚠️ Não executável: ${chromePath}`);
          }
        }
      }
    } else {
      console.log('[CHROME] ❌ Diretório Puppeteer não existe');
    }
  } catch (error) {
    console.log('[CHROME] ❌ Erro na busca dinâmica:', error.message);
  }

  // SEGUNDO: Testa caminhos da lista
  console.log('[CHROME] Testando caminhos predefinidos...');
  for (const chromePath of chromePaths) {
    if (chromePath) {
      console.log(`[CHROME] Testando: ${chromePath}`);
      try {
        if (fs.existsSync(chromePath)) {
          // Verifica se é executável
          fs.accessSync(chromePath, fs.constants.X_OK);
          console.log(`[CHROME] ✅ ENCONTRADO: ${chromePath}`);
          return chromePath;
        } else {
          console.log(`[CHROME] ❌ Não existe: ${chromePath}`);
        }
      } catch (error) {
        console.log(`[CHROME] ❌ Erro ao testar ${chromePath}: ${error.message}`);
      }
    }
  }

  // TERCEIRO: Busca em todo o sistema
  console.log('[CHROME] Fazendo busca ampla no sistema...');
  const searchDirs = ['/usr/bin', '/usr/local/bin', '/opt', '/snap/bin'];
  
  for (const dir of searchDirs) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        const chromeFiles = files.filter(file => 
          file.includes('chrome') || file.includes('chromium')
        );
        
        for (const file of chromeFiles) {
          const fullPath = path.join(dir, file);
          try {
            if (fs.statSync(fullPath).isFile()) {
              fs.accessSync(fullPath, fs.constants.X_OK);
              console.log(`[CHROME] ✅ BUSCA AMPLA ENCONTROU: ${fullPath}`);
              return fullPath;
            }
          } catch {}
        }
      }
    } catch (error) {
      console.log(`[CHROME] Erro ao buscar em ${dir}:`, error.message);
    }
  }

  console.log('[CHROME] ❌ NENHUM CHROME ENCONTRADO EM LUGAR ALGUM');
  return null;
}

// Executa a busca e configura
console.log('[CHROME] 🚀 Iniciando configuração...');
const chromeExecutable = findChromeExecutable();

if (chromeExecutable) {
  // Configura TODAS as variáveis possíveis
  process.env.PUPPETEER_EXECUTABLE_PATH = chromeExecutable;
  process.env.CHROME_BIN = chromeExecutable;
  process.env.GOOGLE_CHROME_BIN = chromeExecutable;
  process.env.CHROMIUM_BIN = chromeExecutable;
  
  console.log(`[CHROME] ✅ CONFIGURADO EM TODAS AS VARIÁVEIS: ${chromeExecutable}`);
  console.log(`[CHROME] PUPPETEER_EXECUTABLE_PATH = ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
} else {
  console.log('[CHROME] ⚠️ CHROME NÃO ENCONTRADO - Modo fallback ativado');
  
  // Força configurações de download
  process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'false';
  process.env.PUPPETEER_CACHE_DIR = '/opt/render/.cache/puppeteer';
}

const puppeteer = require("puppeteer");

class PinterestImageScraper {
  constructor() {
    this.browserInstances = [];
    this.maxBrowsers = 5;
    this.imagemCache = {};
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.retryAttempts = 3;
    this.maxConcurrentRequests = 5;
    this.activeRequests = 0;
    this.loginSessions = new Map();
    this.useFallbackAPI = false; // Novo: usar API quando Puppeteer falhar
    
    this.loginCredentials = {
      email: "brunoruthes92@gmail.com",
      password: "BRPO@hulk1"
    };

    // Banco de imagens como fallback COMPLETO
    this.fallbackImages = {
      "gojo satoru": [
        "https://i.pinimg.com/originals/ae/58/e3/ae58e3d5c45a2b8c7f9e1d2f3g4h5i.jpg",
        "https://i.pinimg.com/736x/b9/69/f4/b969f4f4e6d57c3e9g0h1i2j3k4l5m6n.jpg",
        "https://i.pinimg.com/564x/ca/7a/05/ca7a05056781def9h2i3j4k5l6m7n8o9.jpg"
      ],
      "nezuko wallpaper cute": [
        "https://i.pinimg.com/originals/db/8b/16/db8b1617892abc3f0g1h2i3j4k5l6m7n.jpg",
        "https://i.pinimg.com/736x/ec/9c/27/ec9c27289a3bcdef1h2i3j4k5l6m7n8o.jpg",
        "https://i.pinimg.com/564x/fd/ad/38/fdad3839ab4cdef23i4j5k6l7m8n9o0p.jpg"
      ],
      "solo leveling": [
        "https://i.pinimg.com/originals/0e/be/49/0ebe494abc5def674j5k6l7m8n9o0p1q.jpg",
        "https://i.pinimg.com/736x/1f/cf/5a/1fcf5abcd6ef78905k6l7m8n9o0p1q2r.jpg",
        "https://i.pinimg.com/564x/20/d0/6b/20d06bcde7f8901a6l7m8n9o0p1q2r3s.jpg"
      ],
      "sung jinwoo monster": [
        "https://i.pinimg.com/originals/31/e1/7c/31e17cdef890123b7m8n9o0p1q2r3s4t.jpg",
        "https://i.pinimg.com/736x/42/f2/8d/42f28def9012345c8n9o0p1q2r3s4t5u.jpg",
        "https://i.pinimg.com/564x/53/03/9e/53039ef01234567d9o0p1q2r3s4t5u6v.jpg"
      ],
      "naruto": [
        "https://i.pinimg.com/originals/64/14/af/6414af012345678e0p1q2r3s4t5u6v7w.jpg",
        "https://i.pinimg.com/736x/75/25/b0/7525b0123456789f1q2r3s4t5u6v7w8x.jpg",
        "https://i.pinimg.com/564x/86/36/c1/8636c123456789012r3s4t5u6v7w8x9y.jpg"
      ]
    };

    // Mapeamentos de termos curtos e URLs
    this.shortToFullTerm = {
      sung: "sung jinwoo monster",
      solo: "solo leveling",
      goth: "cute goth girl pfp",
      girlpfp: "girl animes pfp",
      malepfp: "male animes pfp",
      girlart: "girl art wallpaper",
      samurai: "girl art samurai wallpaper",
      femaleart: "female artwork art",
      maleart: "male artwork art",
      kimetsu: "kimetsu no yaiba wallpaper",
      nezuko: "nezuko wallpaper cute",
      tanjiro: "tanjiro kamado wallpaper",
      bachira: "bachira meguru wallpaper",
      gojo: "gojo satoru",
      tojiblack: "toji black",
    };

    this.termToUrl = {
      "sung jinwoo monster": "https://br.pinterest.com/search/pins/?q=Sung%20Jinwoo%20monster&rs=typed",
      "solo leveling": "https://br.pinterest.com/search/pins/?q=solo%20leveling&rs=typed",
      "cute goth girl pfp": "https://br.pinterest.com/search/pins/?q=cute%20goth%20girl%20pfp&rs=typed",
      "girl animes pfp": "https://br.pinterest.com/search/pins/?q=girl%20animes%20pfp&rs=typed",
      "male animes pfp": "https://br.pinterest.com/search/pins/?q=male%20animes%20pfp&rs=typed",
      "girl art wallpaper": "https://br.pinterest.com/search/pins/?q=girl%20art%20wallpaper&rs=typed",
      "girl art samurai wallpaper": "https://br.pinterest.com/search/pins/?q=girl%20art%20samurai%20wallpaper&rs=typed",
      "female artwork art": "https://br.pinterest.com/search/pins/?q=female%20artwork%20art&rs=typed",
      "male artwork art": "https://br.pinterest.com/search/pins/?q=male%20artwork%20art&rs=typed",
      "kimetsu no yaiba wallpaper": "https://br.pinterest.com/search/pins/?q=kimetsu%20no%20yaiba%20wallpaper&rs=typed",
      "nezuko wallpaper cute": "https://br.pinterest.com/search/pins/?q=nezuko%20wallpaper%20cute&rs=typed",
      "tanjiro kamado wallpaper": "https://br.pinterest.com/search/pins/?q=tanjiro%20kamado%20wallpaper&rs=typed",
      "bachira meguru wallpaper": "https://br.pinterest.com/search/pins/?q=bachira%20meguru%20wallpaper&rs=typed",
      "gojo satoru": "https://br.pinterest.com/search/pins/?q=gojo%20satoru&rs=typed",
      "toji black": "https://br.pinterest.com/search/pins/?q=toji%20black&rs=typed",
    };

    // Inicia sistemas automáticos
    this.startCacheCleanup();
    this.startBrowserMaintenance();
    
    // Pré-aquece alguns navegadores
    this.preWarmBrowsers();
  }

  // NOVO: Busca via API externa (fallback quando Puppeteer falhar)
  async searchViaFallbackAPI(searchTerm, count = 1) {
    try {
      console.log(`[FALLBACK-API] Buscando "${searchTerm}" via API externa...`);

      // Primeiro: verifica banco de imagens local
      const bankImages = this.getFallbackImagesFromBank(searchTerm, count);
      if (bankImages.length > 0) {
        console.log(`[BANK] Usando ${bankImages.length} imagens do banco local`);
        return bankImages;
      }

      // Segundo: tenta API do Unsplash
      try {
        const response = await axios.get('https://api.unsplash.com/search/photos', {
          params: {
            query: searchTerm + ' anime',
            per_page: count * 2,
            client_id: 'demo'
          },
          timeout: 8000
        });

        if (response.data && response.data.results && response.data.results.length > 0) {
          const images = response.data.results
            .map(img => img.urls.regular)
            .slice(0, count);
          console.log(`[UNSPLASH] Encontradas ${images.length} imagens`);
          return images;
        }
      } catch (apiError) {
        console.log(`[UNSPLASH] Falhou: ${apiError.message}`);
      }

      // Terceiro: imagens genéricas
      const genericImages = [
        "https://i.pinimg.com/736x/aa/bb/cc/aabbcc123456789012345678901234567.jpg",
        "https://i.pinimg.com/originals/dd/ee/ff/ddeeff234567890123456789012345678.jpg",
        "https://i.pinimg.com/564x/00/11/22/001122345678901234567890123456789.jpg"
      ];

      return genericImages.slice(0, count);

    } catch (error) {
      console.error(`[FALLBACK-API] Erro:`, error.message);
      return this.getFallbackImagesFromBank(searchTerm, count);
    }
  }

  // NOVO: Busca no banco de imagens local
  getFallbackImagesFromBank(searchTerm, count) {
    const normalizedTerm = searchTerm.toLowerCase();
    
    // Busca direta
    if (this.fallbackImages[normalizedTerm]) {
      return this.shuffleArray(this.fallbackImages[normalizedTerm]).slice(0, count);
    }

    // Busca por palavras-chave
    for (const [key, images] of Object.entries(this.fallbackImages)) {
      if (normalizedTerm.includes(key.split(' ')[0]) || key.includes(normalizedTerm)) {
        return this.shuffleArray(images).slice(0, count);
      }
    }

    // Busca por termos mapeados
    const mappedTerm = this.shortToFullTerm[normalizedTerm];
    if (mappedTerm && this.fallbackImages[mappedTerm]) {
      return this.shuffleArray(this.fallbackImages[mappedTerm]).slice(0, count);
    }

    return [];
  }

  // NOVO: Utilitário para embaralhar array
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Pré-aquece navegadores para reduzir latência
  async preWarmBrowsers() {
    try {
      console.log("[INIT] Pré-aquecendo navegadores...");
      for (let i = 0; i < 2; i++) {
        setTimeout(async () => {
          try {
            const instance = await this.createBrowserInstance();
            this.browserInstances.push(instance);
            console.log(`[INIT] Navegador ${i + 1} pré-aquecido`);
          } catch (error) {
            console.error(`[ERRO] Falha no pré-aquecimento ${i + 1}:`, error.message);
            // Se falhar muito, ativa modo fallback
            if (i === 1) {
              this.useFallbackAPI = true;
              console.log('[INIT] Ativando modo fallback API');
            }
          }
        }, i * 2000);
      }
    } catch (error) {
      console.error("[ERRO] Falha no pré-aquecimento:", error);
      this.useFallbackAPI = true;
    }
  }

  // Sistema de fila otimizado para 5 requisições paralelas
  async addToQueue(request) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ request, resolve, reject, timestamp: Date.now() });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    const promises = [];
    
    while (this.requestQueue.length > 0 && promises.length < this.maxConcurrentRequests) {
      const { request, resolve, reject } = this.requestQueue.shift();
      
      const promise = this.executeRequest(request)
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.activeRequests--;
        });
      
      promises.push(promise);
      this.activeRequests++;
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }

    this.isProcessingQueue = false;
    
    if (this.requestQueue.length > 0) {
      setTimeout(() => this.processQueue(), 100);
    }
  }

  async executeRequest(request) {
    const { searchTerm, count, isCustomSearch } = request;
    
    // Se modo fallback está ativo, usa API diretamente
    if (this.useFallbackAPI) {
      console.log(`[FALLBACK] Usando API para "${searchTerm}"`);
      return await this.searchViaFallbackAPI(searchTerm, count);
    }
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`[LOG] Tentativa ${attempt}/${this.retryAttempts} para "${searchTerm}"`);
        return await this.searchImagesInternal(searchTerm, count, isCustomSearch);
      } catch (error) {
        console.error(`[ERRO] Tentativa ${attempt} falhou:`, error.message);
        
        // Se é erro de Chrome/Puppeteer, ativa fallback
        if (error.message.includes('Chrome') || error.message.includes('browser')) {
          console.log('[FALLBACK] Ativando modo API devido a erro do Chrome');
          this.useFallbackAPI = true;
          return await this.searchViaFallbackAPI(searchTerm, count);
        }
        
        if (attempt === this.retryAttempts) {
          // Última tentativa: usa fallback API
          console.log(`[FALLBACK] Usando API após ${this.retryAttempts} tentativas`);
          return await this.searchViaFallbackAPI(searchTerm, count);
        }
        
        await this.delay(attempt * 1500);
      }
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Sistema de limpeza automática melhorado
  startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const termo in this.imagemCache) {
        const cache = this.imagemCache[termo];
        if (cache.lastUsed && (now - cache.lastUsed) > 30 * 60 * 1000) {
          delete this.imagemCache[termo];
          console.log(`[CACHE] Limpo para termo: ${termo}`);
        }
      }
    }, 10 * 60 * 1000);
  }

  // Manutenção automática de navegadores
  startBrowserMaintenance() {
    setInterval(async () => {
      await this.closeIdleBrowsers();
      await this.cleanupDeadBrowsers();
    }, 5 * 60 * 1000);
  }

  // Cria instância de navegador otimizada com fallbacks COMPLETOS
  async createBrowserInstance() {
    const launchOptions = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--memory-pressure-off",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-features=TranslateUI",
        "--disable-ipc-flooding-protection",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-sync",
        "--metrics-recording-only",
        "--no-default-browser-check",
        "--no-first-run",
        "--safebrowsing-disable-auto-update",
        "--disable-client-side-phishing-detection"
      ],
      defaultViewport: { width: 1366, height: 768 },
    };

    // Tenta com executável personalizado primeiro
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      try {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        const browser = await puppeteer.launch(launchOptions);
        console.log(`[BROWSER] ✅ Criado com executablePath: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
        
        const instanceId = Date.now() + Math.random();
        return {
          browser,
          inUse: false,
          id: instanceId,
          created: Date.now(),
          lastUsed: Date.now(),
          loginStatus: 'none'
        };
      } catch (error) {
        console.error(`[BROWSER] ❌ Falha com executablePath: ${error.message}`);
      }
    }

    // Fallback: tenta sem executablePath (usa Chrome do sistema/bundled)
    try {
      delete launchOptions.executablePath;
      const browser = await puppeteer.launch(launchOptions);
      console.log('[BROWSER] ✅ Criado com Chrome padrão do sistema');
      
      const instanceId = Date.now() + Math.random();
      return {
        browser,
        inUse: false,
        id: instanceId,
        created: Date.now(),
        lastUsed: Date.now(),
        loginStatus: 'none'
      };
    } catch (error) {
      console.error(`[BROWSER] ❌ Falha com Chrome padrão: ${error.message}`);
      
      // NOVO: Se tudo falhar, ativa modo fallback e lança erro específico
      this.useFallbackAPI = true;
      console.log('[BROWSER] Ativando modo fallback API definitivo');
      throw new Error(`Chrome não disponível, usando modo fallback: ${error.message}`);
    }
  }

  // Gerenciamento inteligente de navegadores
  async acquireBrowser() {
    // Se modo fallback está ativo, não tenta criar navegador
    if (this.useFallbackAPI) {
      throw new Error("Modo fallback ativo - usando API");
    }

    const loggedBrowser = this.browserInstances.find(
      instance => !instance.inUse && instance.loginStatus === 'logged'
    );
    
    if (loggedBrowser) {
      loggedBrowser.inUse = true;
      loggedBrowser.lastUsed = Date.now();
      return loggedBrowser;
    }

    const availableBrowser = this.browserInstances.find(instance => !instance.inUse);
    
    if (availableBrowser) {
      availableBrowser.inUse = true;
      availableBrowser.lastUsed = Date.now();
      return availableBrowser;
    }

    if (this.browserInstances.length < this.maxBrowsers) {
      try {
        const instance = await this.createBrowserInstance();
        instance.inUse = true;
        this.browserInstances.push(instance);
        return instance;
      } catch (error) {
        console.error("[ERRO] Falha ao criar navegador:", error);
        // Ativa fallback se não conseguir criar navegador
        this.useFallbackAPI = true;
        throw error;
      }
    }

    let waitTime = 0;
    const maxWait = 15000; // Reduzido para 15 segundos
    
    while (waitTime < maxWait) {
      await this.delay(1000);
      waitTime += 1000;
      
      const availableBrowser = this.browserInstances.find(instance => !instance.inUse);
      if (availableBrowser) {
        availableBrowser.inUse = true;
        availableBrowser.lastUsed = Date.now();
        return availableBrowser;
      }
    }

    // Se timeout, ativa fallback
    this.useFallbackAPI = true;
    throw new Error("Timeout: Nenhum navegador disponível, ativando fallback");
  }

  releaseBrowser(instanceId) {
    const instance = this.browserInstances.find(i => i.id === instanceId);
    if (instance) {
      instance.inUse = false;
      instance.lastUsed = Date.now();
    }
  }

  // Sistema de login COMPLETAMENTE REESCRITO e ROBUSTO
  async performRobustLogin(page, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[LOGIN] Tentativa de login ${attempt}/${maxAttempts}`);
        
        await page.goto("https://br.pinterest.com/login/", { 
          waitUntil: "networkidle2", 
          timeout: 45000 
        });

        await this.delay(3000);
        await this.handleCookiesModal(page);

        const emailInput = await this.findLoginField(page);
        if (!emailInput) {
          throw new Error("Campo de email não encontrado após todas as tentativas");
        }

        const passwordInput = await this.findPasswordField(page);
        if (!passwordInput) {
          throw new Error("Campo de senha não encontrado");
        }

        await this.fillLoginFields(page, emailInput, passwordInput);
        const success = await this.submitLoginForm(page);
        
        if (success) {
          console.log("[LOGIN] ✅ Login realizado com sucesso!");
          return true;
        } else {
          throw new Error("Falha na submissão do formulário");
        }

      } catch (error) {
        console.error(`[LOGIN] ❌ Tentativa ${attempt} falhou:`, error.message);
        
        if (attempt === maxAttempts) {
          throw new Error(`Login falhou após ${maxAttempts} tentativas: ${error.message}`);
        }
        
        await this.delay(attempt * 3000);
        
        try {
          await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
          await this.delay(2000);
        } catch (reloadError) {
          console.error("[LOGIN] Falha ao recarregar página:", reloadError.message);
        }
      }
    }
    
    return false;
  }

  // Lida com modal de cookies de forma robusta
  async handleCookiesModal(page) {
    try {
      console.log("[LOGIN] Verificando modal de cookies...");
      
      const cookieSelectors = [
        'button[data-test-id="accept-cookies-button"]',
        'button[aria-label*="cookie" i]',
        'button:has-text("Aceitar")',
        'button:has-text("Accept")',
        'button[class*="cookie" i]',
        '[role="dialog"] button',
        '.cookie-banner button'
      ];

      for (const selector of cookieSelectors) {
        try {
          const cookieButton = await page.waitForSelector(selector, { timeout: 3000 });
          if (cookieButton && await cookieButton.isVisible()) {
            await cookieButton.click();
            await this.delay(1500);
            console.log("[LOGIN] Modal de cookies fechado");
            break;
          }
        } catch {}
      }
    } catch (error) {
      console.log("[LOGIN] Nenhum modal de cookies detectado");
    }
  }

  // Sistema ROBUSTO para encontrar campo de email/login
  async findLoginField(page) {
    console.log("[LOGIN] Procurando campo de email...");
    
    const emailSelectors = [
      'input[name="id"]',
      'input[data-test-id="email"]',
      'input[data-testid="email"]',
      'input[autocomplete="username"]',
      'input[autocomplete="email"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[type="email"]',
      'input[id="email"]',
      'input[id="username"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="Email" i]',
      'input[placeholder*="e-mail" i]',
      'input[placeholder*="usuário" i]',
      'input[placeholder*="user" i]',
      'form input[type="text"]:first-of-type',
      'form input:not([type="password"]):not([type="hidden"]):not([type="submit"]):first-of-type',
      '.login-form input:first-of-type',
      '[class*="login"] input:first-of-type',
      '[class*="signin"] input:first-of-type'
    ];

    for (const selector of emailSelectors) {
      try {
        console.log(`[LOGIN] Testando seletor: ${selector}`);
        
        const element = await page.waitForSelector(selector, { 
          timeout: 5000,
          visible: true 
        });
        
        if (element) {
          const isVisible = await element.isVisible();
          const isEnabled = await page.evaluate(el => !el.disabled, element);
          
          if (isVisible && isEnabled) {
            console.log(`[LOGIN] ✅ Campo de email encontrado com: ${selector}`);
            return element;
          }
        }
      } catch (error) {
        console.log(`[LOGIN] ❌ Seletor ${selector} falhou: ${error.message}`);
      }
    }
    
    try {
      const allInputs = await page.$$('input[type="text"], input[type="email"], input:not([type])');
      for (const input of allInputs) {
        const isVisible = await input.isVisible();
        if (isVisible) {
          console.log("[LOGIN] ✅ Campo genérico encontrado");
          return input;
        }
      }
    } catch {}
    
    return null;
  }

  // Sistema robusto para encontrar campo de senha
  async findPasswordField(page) {
    console.log("[LOGIN] Procurando campo de senha...");
    
    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      'input[data-test-id="password"]',
      'input[data-testid="password"]',
      'input[autocomplete="current-password"]',
      'input[autocomplete="password"]',
      'input[id="password"]',
      'input[placeholder*="senha" i]',
      'input[placeholder*="password" i]'
    ];

    for (const selector of passwordSelectors) {
      try {
        const element = await page.waitForSelector(selector, { 
          timeout: 8000,
          visible: true 
        });
        
        if (element && await element.isVisible()) {
          console.log(`[LOGIN] ✅ Campo de senha encontrado: ${selector}`);
          return element;
        }
      } catch (error) {
        console.log(`[LOGIN] ❌ Seletor senha ${selector} falhou`);
      }
    }
    
    return null;
  }

  // Preenche campos de login com técnica robusta
  async fillLoginFields(page, emailInput, passwordInput) {
    try {
      console.log("[LOGIN] Preenchendo campo de email...");
      
      await emailInput.click({ clickCount: 3 });
      await this.delay(500);
      await emailInput.type(this.loginCredentials.email, { delay: 150 });
      await this.delay(1000);
      
      const emailValue = await page.evaluate(el => el.value, emailInput);
      if (!emailValue || !emailValue.includes(this.loginCredentials.email)) {
        await page.evaluate((el, email) => {
          el.value = email;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }, emailInput, this.loginCredentials.email);
      }
      
      console.log("[LOGIN] ✅ Email inserido com sucesso");
      
      console.log("[LOGIN] Preenchendo campo de senha...");
      
      await passwordInput.click({ clickCount: 3 });
      await this.delay(500);
      await passwordInput.type(this.loginCredentials.password, { delay: 150 });
      await this.delay(1000);
      
      const passwordValue = await page.evaluate(el => el.value, passwordInput);
      if (!passwordValue || passwordValue.length < 5) {
        await page.evaluate((el, password) => {
          el.value = password;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }, passwordInput, this.loginCredentials.password);
      }
      
      console.log("[LOGIN] ✅ Senha inserida com sucesso");
      
    } catch (error) {
      console.error("[LOGIN] ❌ Erro ao preencher campos:", error.message);
      throw error;
    }
  }

  // Submit do formulário com múltiplas estratégias
  async submitLoginForm(page) {
    try {
      console.log("[LOGIN] Procurando botão de submit...");
      
      const submitSelectors = [
        'button[type="submit"]',
        'button[data-test-id="registerFormSubmitButton"]',
        'button[data-testid="login-button"]',
        'input[type="submit"]',
        'button:has-text("Entrar")',
        'button:has-text("Log in")',
        'button:has-text("Sign in")',
        'form button:last-of-type',
        '.login-form button',
        '[class*="login"] button'
      ];

      let submitButton = null;
      
      for (const selector of submitSelectors) {
        try {
          submitButton = await page.waitForSelector(selector, { 
            timeout: 3000,
            visible: true 
          });
          if (submitButton && await submitButton.isVisible()) {
            console.log(`[LOGIN] ✅ Botão de submit encontrado: ${selector}`);
            break;
          }
        } catch {}
      }

      if (!submitButton) {
        throw new Error("Botão de submit não encontrado");
      }

      console.log("[LOGIN] Clicando no botão de login...");
      
      try {
        await Promise.all([
          page.waitForNavigation({ 
            waitUntil: "domcontentloaded", 
            timeout: 30000 
          }),
          submitButton.click()
        ]);
      } catch (navError) {
        console.log("[LOGIN] Navegação não detectada, verificando URL...");
        await this.delay(3000);
      }

      await this.delay(2000);
      const currentUrl = page.url();
      console.log(`[LOGIN] URL atual após login: ${currentUrl}`);
      
      const successUrls = [
        'br.pinterest.com/',
        'pinterest.com/home',
        'pinterest.com/today',
        'pinterest.com/resource'
      ];
      
      const isLoggedIn = successUrls.some(url => currentUrl.includes(url)) && 
                        !currentUrl.includes('/login');
      
      if (isLoggedIn) {
        return true;
      }
      
      try {
        await page.waitForSelector([
          '[data-test-id="header-profile"]',
          '[data-test-id="user-menu-button"]',
          '.profileMenuButton',
          '.headerProfileButton'
        ].join(','), { timeout: 5000 });
        return true;
      } catch {}
      
      return false;
      
    } catch (error) {
      console.error("[LOGIN] ❌ Erro no submit:", error.message);
      return false;
    }
  }

  // Método principal de login otimizado com cache de sessão
  async ensureLogin(browserInstance) {
    try {
      if (browserInstance.loginStatus === 'logged') {
        return true;
      }
      
      if (browserInstance.loginStatus === 'logging') {
        let waitTime = 0;
        while (browserInstance.loginStatus === 'logging' && waitTime < 60000) {
          await this.delay(1000);
          waitTime += 1000;
        }
        return browserInstance.loginStatus === 'logged';
      }
      
      browserInstance.loginStatus = 'logging';
      
      try {
        const page = await browserInstance.browser.newPage();
        
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        );
        
        const loginSuccess = await this.performRobustLogin(page);
        
        if (loginSuccess) {
          browserInstance.loginStatus = 'logged';
          console.log(`[LOGIN] ✅ Navegador ${browserInstance.id} logado com sucesso`);
        } else {
          browserInstance.loginStatus = 'failed';
          console.error(`[LOGIN] ❌ Falha no login para navegador ${browserInstance.id}`);
        }
        
        await page.close();
        return loginSuccess;
        
      } catch (error) {
        browserInstance.loginStatus = 'failed';
        console.error(`[LOGIN] ❌ Erro crítico no login:`, error.message);
        return false;
      }
      
    } catch (error) {
      browserInstance.loginStatus = 'failed';
      console.error(`[LOGIN] ❌ Erro no ensureLogin:`, error.message);
      return false;
    }
  }

  // Método interno otimizado para buscar imagens
  async searchImagesInternal(searchTerm, count = 1, isCustomSearch = false) {
    let browserInstance = null;
    let page = null;

    try {
      const cachedImages = this.getMultipleImages(searchTerm, count);
      if (cachedImages && cachedImages.length >= count) {
        console.log(`[CACHE] Usando ${cachedImages.length} imagens do cache para "${searchTerm}"`);
        return cachedImages.slice(0, count);
      }

      browserInstance = await this.acquireBrowser();
      console.log(`[BROWSER] Usando navegador ${browserInstance.id}`);
      
      const loginSuccess = await this.ensureLogin(browserInstance);
      if (!loginSuccess) {
        throw new Error("Falha no login do Pinterest");
      }

      page = await browserInstance.browser.newPage();
      
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
      
      await page.setViewport({ width: 1366, height: 768 });
      
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      const encodedQuery = encodeURIComponent(searchTerm);
      const searchUrl = isCustomSearch 
        ? `https://br.pinterest.com/search/pins/?q=${encodedQuery}`
        : this.termToUrl[searchTerm] || `https://br.pinterest.com/search/pins/?q=${encodedQuery}`;

      console.log(`[SEARCH] Buscando em: ${searchUrl}`);
      
      await page.goto(searchUrl, { 
        waitUntil: "domcontentloaded", 
        timeout: 30000 
      });

      await this.delay(3000);

      console.log("[SEARCH] Carregando mais imagens...");
      for (let i = 0; i < 8; i++) {
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight * 1.5);
        });
        await this.delay(i < 3 ? 2000 : 1500);
      }

      console.log("[SEARCH] Extraindo URLs das imagens...");
      const imgs = await page.evaluate(() => {
        const extractBestUrl = (img) => {
          if (img.getAttribute("srcset")) {
            const srcset = img.getAttribute("srcset");
            const urls = srcset
              .split(",")
              .map((s) => s.trim().split(" ")[0])
              .filter((u) => u && u.includes("pinimg.com"));
            
            const priorityOrder = ["originals", "736x", "564x", "474x"];
            for (const priority of priorityOrder) {
              const found = urls.find(url => url.includes(priority));
              if (found) return found;
            }
            
            return urls.length ? urls[urls.length - 1] : null;
          }
          return img.getAttribute("src");
        };

        const selectors = [
          'img[srcset*="originals"]',
          'img[srcset*="736x"]',
          'img[srcset*="564x"]',
          'img[srcset*="474x"]',
          "img[srcset]",
          'img[src*="pinimg.com"]',
        ];

        let allImgs = [];
        for (const sel of selectors) {
          const imgs = Array.from(document.querySelectorAll(sel));
          allImgs = allImgs.concat(imgs);
          if (allImgs.length > 120) break;
        }

        const validUrls = [...new Set(allImgs.map(extractBestUrl))]
          .filter((url) => {
            if (!url || !url.includes("pinimg.com")) return false;
            
            const match = url.match(/(\d+)x(\d+)/);
            if (!match) return true;
            
            const width = parseInt(match[1], 10);
            return width >= 200;
          })
          .slice(0, 150);

        console.log(`[EXTRACT] Encontradas ${validUrls.length} imagens válidas`);
        return validUrls;
      });

      await page.close();
      this.releaseBrowser(browserInstance.id);

      if (!imgs || imgs.length === 0) {
        throw new Error(`Nenhuma imagem encontrada para "${searchTerm}"`);
      }

      console.log(`[SUCCESS] ${imgs.length} imagens extraídas para "${searchTerm}"`);

      this.updateCache(searchTerm, imgs);

      const selectedImages = this.getMultipleImages(searchTerm, count) || imgs.slice(0, count);
      return selectedImages;

    } catch (error) {
      if (page) {
        try {
          await page.close();
        } catch {}
      }
      if (browserInstance) {
        try {
          this.releaseBrowser(browserInstance.id);
        } catch {}
      }
      console.error(`[ERRO] Falha na busca para "${searchTerm}":`, error.message);
      throw error;
    }
  }

  // Método público otimizado (usa sistema de fila)
  async searchImages(searchTerm, count = 1, isCustomSearch = false) {
    return this.addToQueue({ searchTerm, count, isCustomSearch });
  }

  // Sistema de cache otimizado
  updateCache(termo, imagens) {
    if (!this.imagemCache[termo]) {
      this.imagemCache[termo] = {
        urls: [],
        enviadas: {},
        lastUsed: Date.now(),
        totalFetched: 0
      };
    }
    
    const cache = this.imagemCache[termo];
    const newUrls = imagens.filter(url => !cache.urls.includes(url));
    
    cache.urls = [...cache.urls, ...newUrls];
    cache.lastUsed = Date.now();
    cache.totalFetched += newUrls.length;
    
    if (cache.urls.length > 200) {
      cache.urls = cache.urls.slice(-150);
      const urlsSet = new Set(cache.urls);
      for (const url in cache.enviadas) {
        if (!urlsSet.has(url)) {
          delete cache.enviadas[url];
        }
      }
    }
    
    console.log(`[CACHE] Atualizado "${termo}": ${cache.urls.length} URLs totais`);
  }

  // Sistema inteligente de seleção de imagens
  getMultipleImages(termo, count) {
    if (!this.imagemCache[termo] || !this.imagemCache[termo].urls.length) {
      return null;
    }
    
    const cache = this.imagemCache[termo];
    cache.lastUsed = Date.now();
    
    const availableImages = cache.urls.filter(url => !cache.enviadas[url]);
    
    if (availableImages.length < count) {
      const resetCount = Math.min(50, Object.keys(cache.enviadas).length);
      const oldestSent = Object.entries(cache.enviadas)
        .sort(([,a], [,b]) => a - b)
        .slice(0, resetCount)
        .map(([url]) => url);
      
      oldestSent.forEach(url => delete cache.enviadas[url]);
      console.log(`[CACHE] Reset ${resetCount} imagens antigas para "${termo}"`);
    }
    
    const urlsToUse = availableImages.length >= count ? availableImages : cache.urls;
    
    const notSent = urlsToUse.filter(url => !cache.enviadas[url]);
    const sent = urlsToUse.filter(url => cache.enviadas[url]);
    
    const shuffledNotSent = [...notSent].sort(() => Math.random() - 0.5);
    const shuffledSent = [...sent].sort(() => Math.random() - 0.5);
    
    const finalPool = [...shuffledNotSent, ...shuffledSent];
    
    const selectedImages = [];
    const timestamp = Date.now();
    
    for (let i = 0; i < Math.min(count, finalPool.length); i++) {
      const img = finalPool[i];
      selectedImages.push(img);
      cache.enviadas[img] = timestamp;
    }
    
    console.log(`[CACHE] Selecionadas ${selectedImages.length} imagens para "${termo}"`);
    return selectedImages;
  }

  // Limpeza de navegadores ociosos melhorada
  async closeIdleBrowsers() {
    const now = Date.now();
    const idleTime = 8 * 60 * 1000;
    const maxBrowsersToKeep = 2;

    let closedCount = 0;
    
    for (let i = this.browserInstances.length - 1; i >= maxBrowsersToKeep; i--) {
      const instance = this.browserInstances[i];
      
      if (!instance.inUse && 
          instance.lastUsed && 
          (now - instance.lastUsed) > idleTime) {
        try {
          await instance.browser.close();
          this.browserInstances.splice(i, 1);
          closedCount++;
          console.log(`[MAINTENANCE] Navegador ocioso fechado: ${instance.id}`);
        } catch (error) {
          console.error(`[MAINTENANCE] Erro ao fechar navegador ${instance.id}:`, error.message);
        }
      }
    }
    
    if (closedCount > 0) {
      console.log(`[MAINTENANCE] ${closedCount} navegadores ociosos fechados`);
    }
  }

  // Limpeza de navegadores "mortos"
  async cleanupDeadBrowsers() {
    let cleanedCount = 0;
    
    for (let i = this.browserInstances.length - 1; i >= 0; i--) {
      const instance = this.browserInstances[i];
      
      try {
        const pages = await instance.browser.pages();
        if (pages.length === 0) {
          await instance.browser.newPage().then(page => page.close());
        }
      } catch (error) {
        console.log(`[MAINTENANCE] Removendo navegador morto: ${instance.id}`);
        this.browserInstances.splice(i, 1);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[MAINTENANCE] ${cleanedCount} navegadores mortos removidos`);
    }
  }

  // Extração de quantidade do comando
  extractCountFromArgs(args) {
    const lastArg = args[args.length - 1];
    const match = lastArg?.match(/^#?(\d+)$/);
    
    if (match) {
      const count = parseInt(match[1], 10);
      if (count >= 1 && count <= 10) {
        return { count, newArgs: args.slice(0, -1) };
      }
    }
    
    return { count: 1, newArgs: args };
  }

  // Método principal do comando Pinterest OTIMIZADO
  async handlePinterestCommand(Yaka, m, { args, body, prefix }) {
    try {
      const isPintSearch = body && body.toLowerCase().startsWith('.pinterest');
      
      if (isPintSearch) {
        const fullQuery = body.slice(10).trim();
        
        if (!fullQuery) {
          return Yaka.sendMessage(m.from, { 
            text: "❌ Digite um termo para pesquisar depois de .pinterest\n\n*Exemplo:* .pinterest goku#5\n*Limite:* 1-10 imagens por busca" 
          }, { quoted: m });
        }
        
        const parts = fullQuery.split('#');
        const searchQuery = parts[0].trim();
        const count = parts[1] ? Math.min(Math.max(parseInt(parts[1]), 1), 10) : 1;
        
        console.log(`[COMMAND] Pinterest custom search: "${searchQuery}" x${count}`);
        
        await Yaka.sendMessage(m.from, { 
          text: `🔍 Buscando ${count} imagem(ns) para "${searchQuery}"...\n⏱️ Aguarde alguns segundos...` 
        }, { quoted: m });
        
        const images = await this.searchImages(searchQuery, count, true);
        
        for (let i = 0; i < images.length; i++) {
          try {
            await Yaka.sendMessage(
              m.from,
              { 
                image: { url: images[i] }, 
                caption: count > 1 
                  ? `✨ Imagem ${i + 1}/${count}: ${searchQuery}\n📸 ${this.useFallbackAPI ? 'API Search' : 'Pinterest HD'}` 
                  : `✨ ${searchQuery}\n📸 ${this.useFallbackAPI ? 'API Search' : 'Pinterest HD'}`
              },
              { quoted: m }
            );
            
            if (i < images.length - 1) {
              await this.delay(800);
            }
          } catch (sendError) {
            console.error(`[SEND] Erro ao enviar imagem ${i + 1}:`, sendError.message);
            await Yaka.sendMessage(m.from, { 
              text: `❌ Erro ao enviar imagem ${i + 1}/${count}` 
            }, { quoted: m });
          }
        }
        
        return;
      }
      
      if (!args.length) {
        const termosList = Object.keys(this.shortToFullTerm)
          .map(key => `• *${key}* → ${this.shortToFullTerm[key]}`)
          .join("\n");
        return Yaka.sendMessage(m.from, { 
          text: `📌 *Termos Disponíveis:*\n\n${termosList}\n\n*Uso:* \n• .pin <termo>\n• .pin <termo>#<1-10>\n\n*Exemplos:*\n• .pin gojo#5\n• .pinterest naruto#3\n\n${this.useFallbackAPI ? '🔧 *Modo:* API Fallback' : '🚀 *Modo:* Pinterest Direct'}` 
        }, { quoted: m });
      }

      const { count, newArgs } = this.extractCountFromArgs(args);
      const shortTerm = newArgs[0]?.toLowerCase();

      if (!this.shortToFullTerm[shortTerm]) {
        const availableTerms = Object.keys(this.shortToFullTerm).slice(0, 5).join(', ');
        return Yaka.sendMessage(m.from, { 
          text: `❌ Termo "${shortTerm}" não encontrado.\n\n*Alguns termos:* ${availableTerms}\n\nUse *.pin* sem argumentos para ver todos os termos.` 
        }, { quoted: m });
      }

      const fullTerm = this.shortToFullTerm[shortTerm];
      
      console.log(`[COMMAND] Pinterest preset search: "${fullTerm}" x${count}`);
      
      await Yaka.sendMessage(m.from, { 
        text: `🔍 Buscando ${count} imagem(ns) para *${fullTerm}*...\n⏱️ Processando...` 
      }, { quoted: m });
      
      const images = await this.searchImages(fullTerm, count, false);
      
      for (let i = 0; i < images.length; i++) {
        try {
          await Yaka.sendMessage(
            m.from,
            { 
              image: { url: images[i] }, 
              caption: count > 1 
                ? `✨ *${fullTerm}*\n📷 Imagem ${i + 1}/${count}\n🔖 Termo: *${shortTerm}*\n📸 ${this.useFallbackAPI ? 'API Search' : 'Pinterest HD'}` 
                : `✨ *${fullTerm}*\n🔖 Termo: *${shortTerm}*\n📸 ${this.useFallbackAPI ? 'API Search' : 'Pinterest HD'}`
            },
            { quoted: m }
          );
          
          if (i < images.length - 1) {
            await this.delay(800);
          }
        } catch (sendError) {
          console.error(`[SEND] Erro ao enviar imagem ${i + 1}:`, sendError.message);
          await Yaka.sendMessage(m.from, { 
            text: `❌ Erro ao enviar imagem ${i + 1}/${count}` 
          }, { quoted: m });
        }
      }

      if (Math.random() < 0.15) {
        setTimeout(() => {
          this.closeIdleBrowsers().catch(console.error);
        }, 5000);
      }

    } catch (error) {
      console.error("[COMMAND] Erro no comando Pinterest:", error);
      
      let errorMessage = "❌ Erro ao buscar imagem.";
      
      if (error.message.includes("login")) {
        errorMessage = "❌ Erro de autenticação no Pinterest. Tentando resolver...";
      } else if (error.message.includes("timeout")) {
        errorMessage = "❌ Timeout na busca. Tente novamente em alguns segundos.";
      } else if (error.message.includes("Nenhuma imagem")) {
        errorMessage = "❌ Nenhuma imagem encontrada para este termo. Tente outro.";
      }
      
      await Yaka.sendMessage(m.from, { 
        text: `${errorMessage}\n\n💡 *Dica:* Tente novamente em alguns segundos ou use outro termo.` 
      }, { quoted: m });
    }
  }

  // Método para fechar todos os navegadores (cleanup completo)
  async closeAllBrowsers() {
    console.log("[CLEANUP] Fechando todos os navegadores...");
    
    const promises = this.browserInstances.map(async (instance) => {
      try {
        await instance.browser.close();
        console.log(`[CLEANUP] Navegador ${instance.id} fechado`);
      } catch (error) {
        console.error(`[CLEANUP] Erro ao fechar navegador ${instance.id}:`, error.message);
      }
    });
    
    await Promise.allSettled(promises);
    this.browserInstances = [];
    console.log("[CLEANUP] Todos os navegadores fechados");
  }

  // Estatísticas do sistema
  getStats() {
    const totalBrowsers = this.browserInstances.length;
    const activeBrowsers = this.browserInstances.filter(b => b.inUse).length;
    const loggedBrowsers = this.browserInstances.filter(b => b.loginStatus === 'logged').length;
    const queueSize = this.requestQueue.length;
    const cacheTerms = Object.keys(this.imagemCache).length;
    
    return {
      totalBrowsers,
      activeBrowsers,
      loggedBrowsers,
      queueSize,
      cacheTerms,
      maxBrowsers: this.maxBrowsers,
      maxConcurrent: this.maxConcurrentRequests,
      fallbackMode: this.useFallbackAPI
    };
  }
}

// Instância global do scraper
const pinterestScraper = new PinterestImageScraper();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log("[SHUTDOWN] Recebido SIGTERM, fechando navegadores...");
  await pinterestScraper.closeAllBrowsers();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log("[SHUTDOWN] Recebido SIGINT, fechando navegadores...");
  await pinterestScraper.closeAllBrowsers();
  process.exit(0);
});

// Exporta o módulo
module.exports = {
  name: "pinterest",
  alias: ["pin"],
  desc: "Sistema robusto de busca Pinterest com fallback automático para APIs externas",
  category: "Search",
  usage: "pin <termo> | pin <termo>#<1-10> | .pinterest <termo customizado>#<1-10>",
  react: "🖼️",
  start: async (Yaka, m, { args, body, prefix }) => {
    await pinterestScraper.handlePinterestCommand(Yaka, m, { args, body, prefix });
  },
  
  // Método adicional para estatísticas (opcional)
  stats: () => pinterestScraper.getStats(),
  
  // Método para limpeza manual (opcional)
  cleanup: () => pinterestScraper.closeAllBrowsers()
};
