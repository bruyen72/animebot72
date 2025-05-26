const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');
const crypto = require('crypto');

// Configurações
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB máximo para download
const MAX_STICKER_SIZE = 100 * 1024; // 100KB máximo para sticker final
const TARGET_STICKER_SIZE = 80 * 1024; // 80KB ideal para sticker
const MIN_FILE_SIZE = 1024; // 1KB mínimo
const TIMEOUT_DOWNLOAD = 60000; // 60s para download
const TIMEOUT_PROCESS = 120000; // 120s para processamento

const isWindows = process.platform === 'win32';
const ffmpegPath = isWindows ? path.resolve('./ffmpeg.exe') : 'ffmpeg';

module.exports = {
  name: "ss",
  alias: ["sticker", "stiker"],
  desc: "Converter mídia para sticker HD",
  react: "🎭",
  category: "Converter",
  usage: "ss [responder mídia]",
  start: async (Yaka, m, { pushName, prefix, quoted, text, args }) => {
    let tempFiles = [];
    
    try {
      console.log('🎭 Comando .ss iniciado');

      const packName = args[0] || 'Yaka Bot';
      const authorName = args[1] || pushName || 'User';

      // Verifica mídia
      let targetMessage = null;
      if (m.message?.imageMessage || m.message?.videoMessage) {
        targetMessage = m;
      } else if (quoted && (quoted.message?.imageMessage || quoted.message?.videoMessage || quoted.imageMessage || quoted.videoMessage)) {
        targetMessage = quoted;
      }

      if (!targetMessage) {
        return m.reply(`❌ *Mídia não encontrada!*\n\n📋 *Como usar:*\n• Responda imagem/vídeo/GIF com \`${prefix}ss\`\n• Envie mídia com caption \`${prefix}ss\``);
      }

      // Mensagem inicial limpa
      await m.reply(`🎭 *Processando...*\n⏳ *Aguarde...*`);

      try {
        // Download da mídia original
        console.log('📥 Iniciando download da mídia...');
        const mediaData = await downloadOriginalMedia(targetMessage);
        
        // Validações de segurança
        if (!mediaData || mediaData.size < MIN_FILE_SIZE) {
          throw new Error('Mídia muito pequena ou corrompida');
        }
        
        if (mediaData.size > MAX_FILE_SIZE) {
          throw new Error(`Mídia muito grande (${(mediaData.size / 1024 / 1024).toFixed(1)}MB). Máximo: 50MB`);
        }

        console.log(`✅ Mídia obtida: ${(mediaData.size / 1024).toFixed(1)} KB`);

        // Salva temporariamente
        const tempDir = '/tmp/yaka_stickers';
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const originalFile = path.join(tempDir, `original_${Date.now()}.${getFileExtension(mediaData.mimetype)}`);
        fs.writeFileSync(originalFile, mediaData.data);
        tempFiles.push(originalFile);

        // Processa com qualidade HD e compressão inteligente
        let stickerBuffer;
        
        if (checkFFmpeg()) {
          stickerBuffer = await processWithFFmpegCompressed(originalFile, mediaData, packName, authorName, tempFiles);
        } else {
          stickerBuffer = await processWithSharpCompressed(mediaData.data, mediaData, packName, authorName);
        }

        // Envia sticker
        await Yaka.sendMessage(m.from, {
          sticker: stickerBuffer
        }, { quoted: m });

        console.log('✅ Sticker enviado com sucesso');

        // Mensagem de sucesso simples
        setTimeout(async () => {
          try {
            await m.reply(`✅ *Sticker criado!*\n📦 ${packName}\n👤 ${authorName}`);
          } catch (e) {
            console.log('⚠️ Erro ao enviar confirmação');
          }
        }, 1000);

      } catch (processError) {
        console.error('❌ Erro no processamento:', processError.message);
        
        // Fallback silencioso
        try {
          const fallbackSticker = await createFallbackSticker(targetMessage, packName, authorName);
          
          if (fallbackSticker && fallbackSticker.length > 0) {
            await Yaka.sendMessage(m.from, {
              sticker: fallbackSticker
            }, { quoted: m });

            await m.reply(`⚠️ *Sticker criado com qualidade alternativa*\n\n💡 ${processError.message.includes('muito grande') ? 'Arquivo muito grande' : 'Use mídia menor para melhor resultado'}`);
          } else {
            throw new Error('Fallback retornou buffer vazio');
          }
          
        } catch (fallbackError) {
          console.error('❌ Fallback falhou:', fallbackError.message);
          
          const emergencySticker = createEmergencySticker(packName, authorName);
          await Yaka.sendMessage(m.from, {
            sticker: emergencySticker
          }, { quoted: m });
          
          await m.reply(`🎭 *Sticker personalizado criado*\n\n💡 Não foi possível processar a mídia original`);
        }
      }

    } catch (globalError) {
      console.error('❌ Erro global:', globalError.message);
      await m.reply(`❌ *Erro*\n${globalError.message}`);
    } finally {
      // Limpeza automática
      cleanupTempFiles(tempFiles);
    }
  },
};

// Download otimizado da mídia original
async function downloadOriginalMedia(message) {
  console.log('📥 Download da mídia original...');
  
  const downloadMethods = [
    // Método principal: Baileys stream
    async () => {
      const msg = message.message || message;
      
      if (msg.imageMessage) {
        const stream = await downloadContentFromMessage(msg.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        return {
          data: buffer,
          size: buffer.length,
          mimetype: msg.imageMessage.mimetype || 'image/jpeg'
        };
      } else if (msg.videoMessage) {
        const stream = await downloadContentFromMessage(msg.videoMessage, 'video');
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        return {
          data: buffer,
          size: buffer.length,
          mimetype: msg.videoMessage.mimetype || 'video/mp4'
        };
      }
    },

    // Método alternativo: URL direto
    async () => {
      const msg = message.message || message;
      let url, mimetype;
      
      if (msg.imageMessage?.url) {
        url = msg.imageMessage.url;
        mimetype = msg.imageMessage.mimetype || 'image/jpeg';
      } else if (msg.videoMessage?.url) {
        url = msg.videoMessage.url;
        mimetype = msg.videoMessage.mimetype || 'video/mp4';
      }
      
      if (url) {
        const response = await axios({
          method: 'GET',
          url: url,
          responseType: 'arraybuffer',
          timeout: TIMEOUT_DOWNLOAD,
          maxContentLength: MAX_FILE_SIZE,
          headers: {
            'User-Agent': 'WhatsApp/2.23.0',
            'Accept': '*/*'
          }
        });
        
        return {
          data: Buffer.from(response.data),
          size: response.data.byteLength,
          mimetype: mimetype
        };
      }
    }
  ];

  // Tenta métodos em ordem
  for (let i = 0; i < downloadMethods.length; i++) {
    try {
      const result = await downloadMethods[i]();
      if (result && result.data && result.size > MIN_FILE_SIZE) {
        console.log(`✅ Download método ${i + 1}: ${(result.size / 1024).toFixed(1)} KB`);
        return result;
      }
    } catch (error) {
      console.log(`❌ Método ${i + 1} falhou:`, error.message);
    }
  }

  throw new Error('Download da mídia falhou');
}

// Função auxiliar para stream
async function downloadContentFromMessage(message, type) {
  try {
    const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
    return await downloadContentFromMessage(message, type);
  } catch (error) {
    throw new Error('Baileys não disponível');
  }
}

// Extensão do arquivo
function getFileExtension(mimetype) {
  const extensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov'
  };
  return extensions[mimetype] || 'dat';
}

// Verifica FFmpeg
function checkFFmpeg() {
  try {
    if (isWindows) {
      return fs.existsSync('./ffmpeg.exe');
    } else {
      require('child_process').execSync('which ffmpeg', { stdio: 'ignore' });
      return true;
    }
  } catch (error) {
    return false;
  }
}

// Processamento FFmpeg com compressão inteligente
async function processWithFFmpegCompressed(originalFilePath, mediaData, packName, authorName, tempFiles) {
  return new Promise((resolve, reject) => {
    const tempDir = '/tmp/yaka_stickers';
    const timestamp = Date.now();
    const outputFile = path.join(tempDir, `sticker_${timestamp}.webp`);
    tempFiles.push(outputFile);

    const cmdFFmpeg = isWindows ? `"${path.resolve(ffmpegPath)}"` : 'ffmpeg';
    
    // Calcula configurações baseado no tamanho do arquivo
    const fileSizeKB = mediaData.size / 1024;
    const isHeavyFile = fileSizeKB > 500; // Arquivo pesado > 500KB
    const isVeryHeavyFile = fileSizeKB > 2000; // Arquivo muito pesado > 2MB
    
    let quality, fps, method, ffmpegCmd;
    
    if (mediaData.mimetype.includes('video') || mediaData.mimetype.includes('gif')) {
      // Configuração para vídeos/GIFs baseada no tamanho
      if (isVeryHeavyFile) {
        quality = 65; // Compressão alta para arquivos muito pesados
        fps = 8;      // FPS reduzido
        method = 4;   // Método mais rápido
      } else if (isHeavyFile) {
        quality = 75; // Compressão média para arquivos pesados
        fps = 10;     // FPS moderado
        method = 5;   // Método balanceado
      } else {
        quality = 85; // Qualidade alta para arquivos leves
        fps = 12;     // FPS normal
        method = 6;   // Método máximo
      }
      
      ffmpegCmd = `${cmdFFmpeg} -i "${originalFilePath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,fps=${fps}" -c:v libwebp -quality ${quality} -method ${method} -f webp -loop 0 -an -y "${outputFile}"`;
      
    } else {
      // Configuração para imagens baseada no tamanho
      if (isVeryHeavyFile) {
        quality = 70; // Compressão alta
        method = 4;   // Método rápido
      } else if (isHeavyFile) {
        quality = 80; // Compressão média
        method = 5;   // Método balanceado
      } else {
        quality = 95; // Qualidade alta
        method = 6;   // Método máximo
      }
      
      ffmpegCmd = `${cmdFFmpeg} -i "${originalFilePath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libwebp -quality ${quality} -method ${method} -f webp -y "${outputFile}"`;
    }

    console.log(`🔥 Processando com FFmpeg (${isVeryHeavyFile ? 'Compressão Máxima' : isHeavyFile ? 'Compressão Alta' : 'Qualidade HD'})...`);

    exec(ffmpegCmd, { timeout: TIMEOUT_PROCESS }, async (error, stdout, stderr) => {
      if (error) {
        console.error('❌ FFmpeg falhou:', error.message);
        const originalData = fs.readFileSync(originalFilePath);
        resolve(await processWithSharpCompressed(originalData, mediaData, packName, authorName));
        return;
      }

      if (fs.existsSync(outputFile)) {
        try {
          let outputBuffer = fs.readFileSync(outputFile);
          
          // Verifica se ainda está muito grande e força compressão adicional
          if (outputBuffer.length > MAX_STICKER_SIZE) {
            console.log(`⚠️ Sticker ainda grande (${(outputBuffer.length / 1024).toFixed(1)}KB), aplicando compressão adicional...`);
            outputBuffer = await forceCompress(outputBuffer, mediaData.mimetype);
          }
          
          console.log(`✅ FFmpeg processou: ${(outputBuffer.length / 1024).toFixed(1)}KB`);
          resolve(addMetadata(outputBuffer, packName, authorName));
        } catch (readError) {
          const originalData = fs.readFileSync(originalFilePath);
          resolve(await processWithSharpCompressed(originalData, mediaData, packName, authorName));
        }
      } else {
        const originalData = fs.readFileSync(originalFilePath);
        resolve(await processWithSharpCompressed(originalData, mediaData, packName, authorName));
      }
    });
  });
}

// Processamento Sharp com compressão inteligente
async function processWithSharpCompressed(originalData, mediaData, packName, authorName) {
  try {
    const sharp = require('sharp');
    
    // Calcula configurações baseado no tamanho
    const fileSizeKB = mediaData.size / 1024;
    const isHeavyFile = fileSizeKB > 500;
    const isVeryHeavyFile = fileSizeKB > 2000;
    
    let quality, effort;
    
    if (isVeryHeavyFile) {
      quality = 60; // Compressão máxima
      effort = 4;   // Esforço moderado para velocidade
    } else if (isHeavyFile) {
      quality = 75; // Compressão alta
      effort = 5;   // Esforço balanceado
    } else {
      quality = 90; // Qualidade alta
      effort = 6;   // Esforço máximo
    }
    
    console.log(`🔄 Processando com Sharp (${isVeryHeavyFile ? 'Compressão Máxima' : isHeavyFile ? 'Compressão Alta' : 'Qualidade HD'})...`);
    
    let webpBuffer = await sharp(originalData)
      .resize(512, 512, { 
        fit: 'contain', 
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: false
      })
      .webp({ 
        quality: quality,
        effort: effort,
        alphaQuality: quality
      })
      .toBuffer();
    
    // Verifica se ainda está muito grande
    if (webpBuffer.length > MAX_STICKER_SIZE) {
      console.log(`⚠️ Sticker ainda grande (${(webpBuffer.length / 1024).toFixed(1)}KB), aplicando compressão adicional...`);
      webpBuffer = await forceCompress(webpBuffer, mediaData.mimetype);
    }
    
    console.log(`✅ Sharp processou: ${(webpBuffer.length / 1024).toFixed(1)}KB`);
    return addMetadata(webpBuffer, packName, authorName);
  } catch (sharpError) {
    console.log('❌ Sharp falhou:', sharpError.message);
    return createEmergencySticker(packName, authorName);
  }
}

// Compressão forçada para stickers muito grandes
async function forceCompress(buffer, mimetype) {
  try {
    const sharp = require('sharp');
    
    // Aplica compressão agressiva em múltiplas etapas
    let compressed = buffer;
    let currentSize = buffer.length;
    let quality = 50;
    let attempt = 1;
    const maxAttempts = 5;
    
    while (currentSize > TARGET_STICKER_SIZE && attempt <= maxAttempts && quality > 20) {
      console.log(`🔧 Tentativa ${attempt}: Comprimindo com qualidade ${quality}...`);
      
      try {
        compressed = await sharp(compressed)
          .webp({ 
            quality: quality,
            effort: 4,
            alphaQuality: Math.max(quality - 10, 30),
            nearLossless: false
          })
          .toBuffer();
        
        currentSize = compressed.length;
        console.log(`📊 Resultado tentativa ${attempt}: ${(currentSize / 1024).toFixed(1)}KB`);
        
        // Se conseguiu reduzir significativamente, para
        if (currentSize <= TARGET_STICKER_SIZE) {
          console.log(`✅ Compressão bem-sucedida: ${(currentSize / 1024).toFixed(1)}KB`);
          break;
        }
        
        quality -= 10; // Reduz qualidade para próxima tentativa
        attempt++;
        
      } catch (compressError) {
        console.log(`❌ Erro na compressão tentativa ${attempt}:`, compressError.message);
        break;
      }
    }
    
    // Se ainda está muito grande, aplica redimensionamento mais agressivo
    if (currentSize > MAX_STICKER_SIZE) {
      console.log('🔧 Aplicando redimensionamento agressivo...');
      try {
        compressed = await sharp(compressed)
          .resize(400, 400, { 
            fit: 'contain', 
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .webp({ 
            quality: 40,
            effort: 3,
            alphaQuality: 30
          })
          .toBuffer();
        
        console.log(`📊 Após redimensionamento: ${(compressed.length / 1024).toFixed(1)}KB`);
      } catch (resizeError) {
        console.log('❌ Erro no redimensionamento agressivo:', resizeError.message);
      }
    }
    
    return compressed;
  } catch (error) {
    console.log('❌ Erro na compressão forçada:', error.message);
    return buffer; // Retorna original se falhar
  }
}

// Metadados simplificados
function addMetadata(buffer, packName, authorName) {
  try {
    const webp = require('node-webpmux');
    
    const img = new webp.Image();
    const metadata = {
      'sticker-pack-id': crypto.randomBytes(8).toString('hex'),
      'sticker-pack-name': packName,
      'sticker-pack-publisher': authorName,
      'emojis': ['🎭']
    };

    const exifData = Buffer.concat([
      Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00]),
      Buffer.from([0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]),
      Buffer.from(JSON.stringify(metadata), 'utf8')
    ]);

    img.load(buffer);
    img.exif = exifData;
    const result = img.save(null);

    console.log('✅ Metadados adicionados');
    return result;
  } catch (exifError) {
    console.log('⚠️ Metadados falharam, usando buffer original');
    return buffer;
  }
}

// Fallback com compressão automática
async function createFallbackSticker(message, packName, authorName) {
  try {
    const msg = message.message || message;
    let data, mimetype;
    
    if (msg.imageMessage?.jpegThumbnail) {
      data = msg.imageMessage.jpegThumbnail;
      mimetype = 'image/jpeg';
    } else if (msg.videoMessage?.jpegThumbnail) {
      data = msg.videoMessage.jpegThumbnail;
      mimetype = 'image/jpeg';
    } else {
      return createEmergencySticker(packName, authorName);
    }
    
    if (!data || data.length === 0) {
      return createEmergencySticker(packName, authorName);
    }
    
    const mediaData = { data, size: data.length, mimetype };
    return await processWithSharpCompressed(data, mediaData, packName, authorName);
  } catch (error) {
    console.log('❌ Erro no fallback:', error.message);
    return createEmergencySticker(packName, authorName);
  }
}

// Sticker de emergência limpo
function createEmergencySticker(packName, authorName) {
  try {
    const { createCanvas } = require('canvas');
    
    const canvas = createCanvas(512, 512);
    const ctx = canvas.getContext('2d');
    
    // Fundo gradiente
    const gradient = ctx.createRadialGradient(256, 256, 50, 256, 256, 256);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    
    // Círculo
    ctx.beginPath();
    ctx.arc(256, 256, 180, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();
    
    // Emoji
    ctx.font = 'bold 100px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4f46e5';
    ctx.fillText('🎭', 256, 200);
    
    // Texto
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#1f2937';
    ctx.fillText('STICKER', 256, 250);
    
    ctx.font = '16px Arial';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(packName.substring(0, 20), 256, 280);
    
    ctx.font = '14px Arial';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText(authorName.substring(0, 25), 256, 305);
    
    const buffer = canvas.toBuffer('image/webp', { quality: 0.8 });
    return addMetadata(buffer, packName, authorName);
    
  } catch (error) {
    // WebP básico garantido
    return Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x40, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
      0x34, 0x00, 0x00, 0x00, 0xD0, 0x02, 0x00, 0x9D,
      0x01, 0x2A, 0xFF, 0x01, 0xFF, 0x01, 0x34, 0x25
    ]);
  }
}

// Limpeza de arquivos temporários
function cleanupTempFiles(tempFiles) {
  tempFiles.forEach(file => {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`🧹 Removido: ${path.basename(file)}`);
      }
    } catch (error) {
      console.log(`⚠️ Erro ao remover ${path.basename(file)}`);
    }
  });
}