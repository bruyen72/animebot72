/*▓██   ██▓ ▄▄▄       ██ ▄█▀▄▄▄      
 ▒██  ██▒▒████▄     ██▄█▒▒████▄    
  ▒██ ██░▒██  ▀█▄  ▓███▄░▒██  ▀█▄  
  ░ ▐██▓░░██▄▄▄▄██ ▓██ █▄░██▄▄▄▄██ 
  ░ ██▒▓░ ▓█   ▓██▒▒██▒ █▄▓█   ▓██▒
   ██▒▒▒  ▒▒   ▓▒█░▒ ▒▒ ▓▒▒▒   ▓▒█░
 ▓██ ░▒░   ▒   ▒▒ ░░ ░▒ ▒░ ▒   ▒▒ ░
 ▒ ▒ ░░    ░   ▒   ░ ░░ ░  ░   ▒   
 ░ ░           ░  ░░  ░        ░  ░
 ░ ░                               

Olá,
Obrigado por usar o bot Yaka.
Eu sou,

██╗   ██╗ █████╗ ██╗  ██╗ █████╗ ███████╗██╗  ██╗██╗
╚██╗ ██╔╝██╔══██╗██║ ██╔╝██╔══██╗██╔════╝██║  ██║██║
 ╚████╔╝ ███████║█████╔╝ ███████║███████╗███████║██║
  ╚██╔╝  ██╔══██║██╔═██╗ ██╔══██║╚════██║██╔══██║██║
   ██║   ██║  ██║██║  ██╗██║  ██║███████║██║  ██║██║
   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝
                                                    */

   require("./index.js");
   require("./config.js");
   require("./BotCharacters.js");
   
   const { Collection, Function } = require("./lib");
   const { isUrl } = Function;
   const axios = require("axios");
   const Func = require("./lib");
   const chalk = require("chalk");
   const { color } = require("./lib/color");
   const os = require('os')
   
   const cool = new Collection();
   const { mk, mku, mkchar } = require("./Database/dataschema.js");
   const prefix = global.prefa;

   // 🚀 CACHE DE PERFORMANCE ADICIONADO
   const performanceCache = new Map();
   const CACHE_DURATION = 3 * 60 * 1000; // 3 minutos
   
   function getCachedData(key) {
     const cached = performanceCache.get(key);
     if (cached && (Date.now() - cached.time) < CACHE_DURATION) {
       return cached.data;
     }
     return null;
   }
   
   function setCachedData(key, data) {
     performanceCache.set(key, { data, time: Date.now() });
   }
   
   // 🚀 LIMPEZA AUTOMÁTICA DE CACHE
   setInterval(() => {
     const now = Date.now();
     performanceCache.forEach((value, key) => {
       if (now - value.time > CACHE_DURATION) {
         performanceCache.delete(key);
       }
     });
   }, CACHE_DURATION);

   // 🔥 SISTEMA NSFW GLOBAL COM EXECUÇÃO AUTOMÁTICA OTIMIZADA
   global.checkNSFW = async (Yaka, m, prefix, pushName, NSFWstatus, cmdName) => {
     if (!m.isGroup) {
       return "execute";
     }
     
     if (NSFWstatus == "false") {
       // 🚀 EXECUÇÃO ASSÍNCRONA PARA NÃO BLOQUEAR
       setImmediate(async () => {
         await Yaka.sendMessage(
           m.from,
           {
             text: `🚫 *NSFW BLOQUEADO* 🚫\n\nEste grupo não tem NSFW ativado!\n\n🔧 Para ativar:\n*${prefix}nsfw*`
           },
           { quoted: m }
         );
       });
       return "block";
     }
     
     if (NSFWstatus == "redirect" || NSFWstatus == "true") {
       // 🚀 ENVIO ASSÍNCRONO
       setImmediate(async () => {
         await Yaka.sendMessage(
           m.from,
           { text: `📱 *${pushName}* comando enviado para seu privado!` },
           { quoted: m }
         );
       });
       
       // 🔥 EXECUTAR COMANDO AUTOMATICAMENTE NO PRIVADO OTIMIZADO
       setTimeout(async () => {
         try {
           // APIs para diferentes comandos
           const nsfwApis = {
             "ass": "https://fantox-apis.vercel.app/ass",
             "pussy": "https://api.waifu.pics/nsfw/neko",
             "hentai": "https://api.waifu.pics/nsfw/waifu",
             "sex": "https://api.waifu.pics/nsfw/neko",
             "yuri": "https://api.waifu.pics/nsfw/yuri",
             "boobs": "https://api.waifu.pics/nsfw/boobs",
             "nude": "https://api.waifu.pics/nsfw/neko"
           };
           
           const apiUrl = nsfwApis[cmdName.toLowerCase()] || "https://api.waifu.pics/nsfw/waifu";
           // 🚀 TIMEOUT ADICIONADO PARA EVITAR TRAVAMENTOS
           let response = await axios.get(apiUrl, { timeout: 8000 });
           let imgURL = response.data.url;
           
           await Yaka.sendMessage(
             m.sender,
             {
               image: { url: imgURL },
               caption: `🔞 *COMANDO ${cmdName.toUpperCase()}* 🔞\n\n✅ Executado automaticamente no privado!\n\n👀 _Grupos ficam limpos, você recebe aqui!_`,
             }
           );
           
         } catch (error) {
           console.error("Erro ao executar comando automaticamente:", error.message);
           await Yaka.sendMessage(
             m.sender,
             { text: `🔞 Comando ${cmdName} redirecionado!\n\n✅ Use \`${prefix}${cmdName}\` aqui no privado - grupos ficam limpos!` }
           );
         }
       }, 800); // 🚀 REDUZIDO PARA 800ms
       
       return "redirect";
     }
     
     return "execute";
   };
   
   // Tenta configurar o Levels com MongoDB apenas se estiver configurado
   try {
     if (global.mongodb && global.mongodb.trim() !== "") {
       global.Levels = require("discord-xp");
       Levels.setURL(mongodb);
       console.log(color("\nTentando conectar ao Discord XP com MongoDB...\n", "yellow"));
     } else {
       // Cria uma versão mock do Levels para quando não há MongoDB
       global.Levels = {
         appendXp: async () => {
           return false;
         },
         fetch: async () => {
           return { xp: 0, level: 0 };
         },
         fetchLeaderboard: async () => {
           return [];
         },
       };
       console.log(color("\nMongoDB não configurado. Usando sistema XP simulado.\n", "yellow"));
     }
   } catch (error) {
     console.log(color("\nErro ao configurar Discord XP: " + error + "\n", "red"));
     // Configuração de fallback para Levels
     global.Levels = {
       appendXp: async () => {
         return false;
       },
       fetch: async () => {
         return { xp: 0, level: 0 };
       },
       fetchLeaderboard: async () => {
         return [];
       },
     };
   }
   
   console.log(color("\nDatabase 1 connected  !\n", "lime"));
   console.log(color("\nDatabase 2 connected !\n", "lime"));
   console.log(color("\nCarregando, por favor aguarde...\n", "yellow"));
   console.log(color('\nNão modifique este bot por conta própria!!\nPergunte ao proprietário antes de fazê-lo..\n', 'red'))
   
   module.exports = async (Yaka, m, commands, chatUpdate, store) => {
     try {
       // 🚀 VALIDAÇÃO RÁPIDA ADICIONADA
       if (!m || !m.message) return;
       
       let { type, isGroup, sender, from } = m;
       let body =
         type == "buttonsResponseMessage"
           ? m.message[type].selectedButtonId
           : type == "listResponseMessage"
             ? m.message[type].singleSelectReply.selectedRowId
             : type == "templateButtonReplyMessage"
               ? m.message[type].selectedId
               : m.text;
       
       // CRITICAL FIX: Garantir que body é uma string válida
       if (!body) body = "";
       
       // FIX: Extrair o texto completo da mensagem de forma robusta
       const messageText = m.text || 
                          m.body || 
                          (m.message?.conversation) || 
                          (m.message?.extendedTextMessage?.text) || 
                          body;

       let prat =
         type === "conversation" && body?.startsWith(prefix)
           ? body
           : (type === "imageMessage" || type === "videoMessage") &&
             body &&
             body?.startsWith(prefix)
             ? body
             : type === "extendedTextMessage" && body?.startsWith(prefix)
               ? body
               : type === "buttonsResponseMessage" && body?.startsWith(prefix)
                 ? body
                 : type === "listResponseMessage" && body?.startsWith(prefix)
                   ? body
                   : type === "templateButtonReplyMessage" && body?.startsWith(prefix)
                     ? body
                     : "";
   
       // 🚀 CACHE DE METADATA ADICIONADO
       let metadata = {};
       if (isGroup) {
         const metaKey = `meta_${from}`;
         metadata = getCachedData(metaKey);
         if (!metadata) {
           try {
             metadata = await Yaka.groupMetadata(from);
             setCachedData(metaKey, metadata);
           } catch (error) {
             metadata = {};
           }
         }
       }
       
       const pushname = m.pushName; //|| 'NO name'
       const participants = isGroup ? (metadata.participants || []) : [sender];
       const groupAdmin = isGroup
         ? participants.filter((v) => v.admin !== null).map((v) => v.id)
         : [];
       const botNumber = await Yaka.decodeJid(Yaka.user.id);
       const isBotAdmin = isGroup ? groupAdmin.includes(botNumber) : false;
       const isAdmin = isGroup ? groupAdmin.includes(sender) : false;
       const isCreator = [botNumber, ...global.owner]
         .map((v) => v.replace(/[^0-9]/g, "") + "@s.whatsapp.net")
         .includes(m.sender);
       const isOwner = global.owner.includes(m.sender);
       global.suppL = "https://chat.whatsapp.com/KLX59oSwhGWLCDNGshiwWv";
   
       const isCmd = body.startsWith(prefix);
       
       // 🚀 RETORNO RÁPIDO SE NÃO FOR COMANDO
       if (!isCmd && !m.quoted) return;
   
       ////server uptime?///
       const uptimeValue = os.uptime();
       const uptime = `${Math.floor(uptimeValue / 3600)}h ${Math.floor(uptimeValue % 3600 / 60)}m ${Math.floor(uptimeValue % 60)}s`;
       //////
       const quoted = m.quoted ? m.quoted : m;
       const mime = (quoted.msg || m.msg).mimetype || " ";
       const isMedia = /image|video|sticker|audio/.test(mime);
       const budy = typeof m.text == "string" ? m.text : "";
       
       // FIX: Captura correta dos argumentos
       const cmdName = prat
         .slice(prefix.length)
         .trim()
         .split(/ +/)
         .shift()
         .toLowerCase();
       
       // FIX: Parse robusto dos argumentos
       const fullCommand = messageText.toLowerCase();
       const argsWithCommand = messageText.split(' ');
       const args = argsWithCommand.slice(1);
       const ar = args.map((v) => v.toLowerCase());
       let text = args.join(" ");
       
       const groupName = m.isGroup ? (metadata.subject || "Grupo") : "";
   
       // 🚀 CACHE DE COMANDOS ADICIONADO
       const cmdKey = `cmd_${cmdName}`;
       let cmd = getCachedData(cmdKey);
       if (!cmd) {
         cmd = commands.get(cmdName) ||
           Array.from(commands.values()).find((v) =>
             v.alias && v.alias.find((x) => x.toLowerCase() == cmdName)
           ) || "";
         if (cmd) setCachedData(cmdKey, cmd);
       }
       
       const icmd = cmd;
       
       // FIX: Captura melhorada de menções
       let mentionByTag = [];
       
       // Método 1: Captura padrão
       if (type == "extendedTextMessage" && 
           m.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
         mentionByTag = m.message.extendedTextMessage.contextInfo.mentionedJid;
       }
       
       // Método 2: Fallback para m.mentionedJid
       if (mentionByTag.length === 0 && m.mentionedJid?.length > 0) {
         mentionByTag = m.mentionedJid;
       }
       
       // Método 3: Extração de menções do texto
       if (mentionByTag.length === 0 && messageText) {
         const textMentions = messageText.match(/@(\d+)/g);
         if (textMentions) {
           mentionByTag = textMentions.map(mention => {
             const number = mention.replace('@', '');
             return number + '@s.whatsapp.net';
           });
         }
       }
   
       // 🚀 VERIFICAÇÕES PARALELAS OTIMIZADAS
       const [banResult, characterResult, modResult] = await Promise.allSettled([
         mku.findOne({ id: m.sender }),
         mkchar.findOne({ id: "1" }),
         mku.findOne({ id: m.sender })
       ]);
       
       // Verificação de ban (com tratamento para quando não há MongoDB)
       let userBanned = false;
       let banReason = "";
       let banGcname = "";
       
       if (banResult.status === 'fulfilled' && banResult.value && banResult.value.ban !== "false") {
         userBanned = true;
         banReason = banResult.value.reason || "Sem motivo específico";
         banGcname = banResult.value.gcname || "desconhecido";
       }
   
       if (
         !isCreator && 
         isCmd && 
         userBanned && 
         budy != `${prefix}support` &&
         budy != `${prefix}supportgc` &&
         budy != `${prefix}owner` &&
         budy != `${prefix}mods` &&
         budy != `${prefix}mod` &&
         budy != `${prefix}modlist`
       ) {
         return m.reply(
           `Você está *Banido* de usar comandos por *${banReason}* de *${banGcname}*`
         );
       }
   
       // ------------------------ Character Configuration (Do not modify this part) ------------------------ //
   
       let char = "0"; // default one
       let CharacterSelection = "0"; // user selected character
   
       if (characterResult.status === 'fulfilled' && characterResult.value) {
         CharacterSelection = characterResult.value.seletedCharacter || "0";
       }
   
       let idConfig = "charID" + CharacterSelection;
   
       global.botName = global[idConfig].botName;
       global.botVideo = global[idConfig].botVideo;
       global.botImage1 = global[idConfig].botImage1;
       global.botImage2 = global[idConfig].botImage2;
       global.botImage3 = global[idConfig].botImage3;
       global.botImage4 = global[idConfig].botImage4;
       global.botImage5 = global[idConfig].botImage5;
       global.botImage6 = global[idConfig].botImage6;
       global.botImage7 = global[idConfig].botImage7;
       
   
       //------------------------------------------- Antilink Configuration --------------------------------------------//
   
       let antilinkStatus = "false";
       
       try {
         let checkdata = await mk.findOne({ id: m.from });
         if (checkdata) {
           antilinkStatus = checkdata.antilink || "false";
           
           if (checkdata.antilink == "true" && !isBotAdmin) {
             await mk.updateOne({ id: m.from }, { antilink: "false" });
             Yaka.sendMessage(m.from, { text: `Antilink foi *desativado* porque não sou mais um administrador.` });
             antilinkStatus = "false";
           }
         }
       } catch (error) {
         console.log("Erro ao verificar antilink: " + error);
       }
   
       if (m.isGroup && antilinkStatus == "true") {
         linkgce = await Yaka.groupInviteCode(from);
         if (budy.includes(`https://chat.whatsapp.com/${linkgce}`)) {
           m.reply(
             `Nenhuma ação será tomada porque você enviou o link deste grupo.`
           );
         } else if (budy.includes(`https://chat.whatsapp`)) {
           bvl = `O administrador enviou um link, então não há problemas.`;
           if (isAdmin) return m.reply(bvl);
           if (m.key.fromMe) return m.reply(bvl);
           if (isCreator) return m.reply(bvl);
           kice = m.sender;
           await Yaka.groupParticipantsUpdate(m.from, [kice], "remove");
           await Yaka.sendMessage(
             from,
             {
               delete: {
                 remoteJid: m.from,
                 fromMe: false,
                 id: m.id,
                 participant: m.sender,
               },
             },
             {
               quoted: m,
             }
           );
           
           try {
             await mk.updateOne({ id: m.from }, { antilink: "true" }, { upsert: true });
           } catch (error) {
             console.log("Erro ao atualizar antilink: " + error);
           }
           
           Yaka.sendMessage(
             from,
             {
               text: `\`\`\`*Sistema Antilink*\`\`\`\n\n@${kice.split("@")[0]
                 } Removido por enviar link de grupo WhatsApp neste grupo! Mensagem excluída.`,
               mentions: [kice],
             },
             {
               quoted: m,
             }
           );
         } else if (isUrl(m.text) && !icmd && !isAdmin && !isCreator) {
           await Yaka.sendMessage(
             from,
             {
               delete: {
                 remoteJid: m.from,
                 fromMe: false,
                 id: m.id,
                 participant: m.sender,
               },
             },
             {
               quoted: m,
             }
           );
           m.reply(
             `Antilink está ativado! Para usar qualquer comando relacionado a links, use meu prefixo real (${prefix})! \n\nExemplo: ${prefix}igdl <link> ou ${prefix}ytmp4 <link>`
           );
         }
       }
   
       //---------------------------------- Self/public/Private mode Configuration ------------------------------------//
   
       let modStatus = "false";
       
       if (modResult.status === 'fulfilled' && modResult.value) {
         modStatus = modResult.value.addedMods || "false";
       }
   
       let workerMode = "false";
       
       if (characterResult.status === 'fulfilled' && characterResult.value) {
         workerMode = characterResult.value.privateMode || "false";
       }
       
       if (workerMode == "true") {
         if (
           !global.owner.includes(`${m.sender.split("@")[0]}`) &&
           modStatus == "false" &&
           isCmd &&
           m.sender != botNumber
         ) {
           console.log("\nComando Rejeitado! O bot está no modo privado!\n");
           return;
         }
       }
       
       if (workerMode == "self") {
         if (m.sender != botNumber && isCmd) {
           console.log("\nComando Rejeitado! O bot está no modo Self!\n");
           return;
         }
       }
   
       //-------------------------------------- Group CMD On/OFF Configuration ----------------------------------------//
   
       let botSwitchGC = "true";
       
       try {
         let botSwitchConfig = await mk.findOne({ id: m.from });
         if (botSwitchConfig) {
           botSwitchGC = botSwitchConfig.botSwitch || "true";
         }
       } catch (error) {
         console.log("Erro ao verificar botSwitch: " + error);
       }
       
       if (
         m.isGroup &&
         botSwitchGC == "false" &&
         !isAdmin &&
         !isOwner &&
         modStatus == "false" &&
         isCmd
       ) {
         return console.log(
           `\nComando Rejeitado! O bot está desligado no grupo ${groupName}!\n`
         );
       }
   
       //------------------------------------------- Chatbot Configuration ---------------------------------------------//
   
       let csts = "false";
       
       try {
         let chatbotStatus = await mk.findOne({ id: m.from });
         if (chatbotStatus) {
           csts = chatbotStatus.chatBot || "false";
         }
       } catch (error) {
         console.log("Erro ao verificar status do chatbot: " + error);
       }
       
       if (m.isGroup && csts == "true" && !icmd && !isCmd) {
         if (m.quoted) {
           if (m.quoted.sender == botNumber) {
             try {
               const botreply = await axios.get(
                 `http://api.brainshop.ai/get?bid=174300&key=ugPE0tD90fafvu2N&uid=[uid]&msg=[${budy}]`
               );
               txt = `${botreply.data.cnt}`;
               setTimeout(function () {
                 m.reply(txt);
               }, 2200);
             } catch (error) {
               console.log("Erro na API do chatbot: " + error);
             }
           }
         }
       }
   
       let PMcsts = "false";
       
       if (characterResult.status === 'fulfilled' && characterResult.value) {
         PMcsts = characterResult.value.PMchatBot || "false";
       }
   
       if (!m.isGroup && PMcsts == "true" && !icmd && !isCmd) {
         try {
           const botreply = await axios.get(
             `http://api.brainshop.ai/get?bid=174300&key=ugPE0tD90fafvu2N&uid=[uid]&msg=[${budy}]`
           );
           txt = `${botreply.data.cnt}`;
           setTimeout(function () {
             m.reply(txt);
           }, 2200);
         } catch (error) {
           console.log("Erro na API do chatbot: " + error);
         }
       }
   
       //--------------------------------------------- NSFW Configuration -----------------------------------------------//
   
       let NSFWstatus = "false";
       
       try {
         let nsfwstatus = await mk.findOne({ id: m.from });
         if (nsfwstatus) {
           NSFWstatus = nsfwstatus.switchNSFW || "false";
         }
       } catch (error) {
         console.log("Erro ao verificar status NSFW: " + error);
       }

       // 🔥 LISTA COMPLETA DOS SEUS COMANDOS NSFW
       const nsfwCommands = [
         "animalears", "animal", "anusview", "ass", "barefoot", "bed", "bell", "bikini", "blonde",
         "bondage", "bra", "breasthold", "breasts", "bunnyears", "bunnygirl", "chain", "closeview",
         "cloudsview", "cum", "dress", "drunk", "elbowgloves", "erectnipples", "fateseries",
         "fingering", "flatchest", "food", "foxgirl", "gamecg", "genshin", "glasses", "gloves",
         "greenhair", "hatsunemiku", "hcatgirl", "headband", "headdress", "headphones",
         "hentaimiku", "hentaivideo", "hloli", "hneko", "hololove", "horns", "inshorts",
         "japanesecloths", "necklace", "nipples", "nobra", "nsfwbeach", "nsfwbell", "nsfwdemon",
         "nsfwidol", "nsfwmaid", "nsfwmenu", "nsfwvampire", "nude", "openshirt", "pantyhose",
         "pantypull", "penis", "pinkhair", "ponytail", "pussy", "ribbons", "schoolswimsuit",
         "schooluniform", "seethrough", "sex", "sex2", "sex3", "shirt", "shirtlift", "skirt",
         "spreadlegs", "spreadpussy", "squirt", "stockings", "sunglasses", "swimsuit", "tail",
         "tattoo", "tears", "temp", "thighhighs", "thogirls", "topless", "torncloths", "touhou",
         "twintails", "uncensored", "underwear", "vocaloid", "weapon", "wet", "whitehair",
         "white", "withflowers", "withgun", "withpetals", "withtie", "withtree", "wolfgirl",
         "xgif", "yuki", "yuri"
       ];

       // 🔥 SISTEMA NSFW AUTOMÁTICO COM EXECUÇÃO AUTOMÁTICA
       if (cmd && nsfwCommands.includes(cmdName.toLowerCase())) {
         const nsfwCheck = await global.checkNSFW(Yaka, m, prefix, pushname, NSFWstatus, cmdName);
         if (nsfwCheck !== "execute") return;
       }
   
       //---------------------------------------------- Group Banning Configuration --------------------------------------//
   
       let BANGCSTATUS = "false";
       
       try {
         let banGCStatus = await mk.findOne({ id: m.from });
         if (banGCStatus) {
           BANGCSTATUS = banGCStatus.bangroup || "false";
         }
       } catch (error) {
         console.log("Erro ao verificar status de ban do grupo: " + error);
       }
       
       if (
         BANGCSTATUS == "true" &&
         budy != `${prefix}unbangc` &&
         budy != `${prefix}unbangroup` &&
         body.startsWith(prefix) &&
         budy != `${prefix}support` &&
         budy != `${prefix}supportgc` &&
         budy != `${prefix}owner` &&
         budy != `${prefix}mods` &&
         budy != `${prefix}mod` &&
         budy != `${prefix}modlist`
       ) {
         if (m.isGroup && !isOwner && modStatus == "false") {
           return m.reply(
             `*${global.botName}* está *Banido* no grupo *${groupName}*! \n\nDigite *${prefix}owner* para enviar uma solicitação para desbanir o grupo!`
           );
         }
       }
   
       //----------------------------------------------------------------------------------------------------------------//
   
       const flags = args.filter((arg) => arg.startsWith("--"));
       if (body.startsWith(prefix) && !icmd) {
         let Yakatext = `*${pushname}* bakaa! Nenhum comando encontrado!!\n\nDigite *${prefix}help* para ver meus comandos!`;
         const reactmxv = {
           react: {
             text: '🙍🏻‍♀️',
             key: m.key,
           },
         };
         await Yaka.sendMessage(m.from, reactmxv);
   
         Yaka.sendMessage(m.from, { video: { url: 'https://media.tenor.com/qvvKGZhH0ysAAAPo/anime-girl.mp4', }, caption: Yakatext, gifPlayback: true }, {
           quoted: m,
         });
       }
   
       // 🚀 LOGS OTIMIZADOS - SÓ PARA GRUPOS PEQUENOS
       if (m.message && (!isGroup || participants.length < 100)) {
         console.log(
           chalk.white(chalk.bgRed("[ MENSAGEM ]")),
           chalk.black(chalk.bgYellow(new Date())),
           chalk.yellow(chalk.bgGrey(budy || m.mtype)) +
           "\n" +
           chalk.blue("=> De"),
           chalk.red(pushname),
           chalk.green(m.sender) + "\n" + chalk.blueBright("=> Em"),
           chalk.white(m.isGroup ? m.from : "Chat Privado", m.chat)
         );
       }
   
       if (cmd) {
        // 🚀 XP OTIMIZADO - SÓ 50% DAS VEZES
        if (Math.random() > 0.5) {
          setImmediate(async () => {
            try {
              const randomXp = Math.floor(Math.random() * 3) + 1;
              const haslUp = await Levels.appendXp(m.sender, "bot", randomXp);
            } catch (error) {
              console.log("Erro ao adicionar XP: " + error);
            }
          });
        }
      }
      
      if (
        text.endsWith("--info") ||
        text.endsWith("--i") ||
        text.endsWith("--?")
      ) {
        let data = [];
        if (cmd.alias) data.push(`*Alias :* ${cmd.alias.join(", ")}`);
  
        if (cmd.desc) data.push(`*Descrição :* ${cmd.desc}\n`);
        if (cmd.usage)
          data.push(
            `*Exemplo :* ${cmd.usage
              .replace(/%prefix/gi, prefix)
              .replace(/%command/gi, cmd.name)
              .replace(/%text/gi, text)}`
          );
  
        let buttonmess = {
          text: `*Informação do Comando*\n\n${data.join("\n")}`,
        };
        let reactionMess = {
          react: {
            text: cmd.react,
            key: m.key,
          },
        };
        await Yaka.sendMessage(m.from, reactionMess).then(() => {
          return Yaka.sendMessage(m.from, buttonmess, {
            quoted: m,
          });
        });
      }
      
      // 🚀 REAÇÃO OTIMIZADA - SÓ 70% DAS VEZES
      if (cmd.react && Math.random() > 0.3) {
        setImmediate(async () => {
          try {
            const reactm = {
              react: {
                text: cmd.react,
                key: m.key,
              },
            };
            await Yaka.sendMessage(m.from, reactm);
          } catch (error) {
            // Ignora erros de reação
          }
        });
      }
      
      if (!cool.has(m.sender)) {
        cool.set(m.sender, new Collection());
      }
      
      const now = Date.now();
      const timestamps = cool.get(m.sender);
      const cdAmount = (cmd.cool || 0) * 1000;
  
      // 🚀 COOLDOWN OTIMIZADO
      if (!isOwner && modStatus == "false" && !botNumber.includes(m.sender)) {
        if (timestamps.has(m.sender)) {
          const expiration = timestamps.get(m.sender) + cdAmount;
  
          if (now < expiration) {
            let timeLeft = (expiration - now) / 1000;
            return await Yaka.sendMessage(
              m.from,
              {
                text: `Não faça spam! Você pode usar o comando após _${timeLeft.toFixed(1)} segundo(s)_`,
              },
              {
                quoted: m,
              }
            );
          }
        }
      }
      
      timestamps.set(m.sender, now);
      setTimeout(() => timestamps.delete(m.sender), cdAmount);
  
      // FIX: Passar o messageText e fullText para o comando
      cmd.start(Yaka, m, {
        name: "Yaka",
        metadata,
        pushName: pushname,
        participants,
        body,
        messageText,
        fullText: messageText,
        args,
        ar,
        groupName,
        botNumber,
        flags,
        isAdmin,
        groupAdmin,
        text,
        quoted,
        mentionByTag,
        mime,
        isBotAdmin,
        prefix,
        modStatus,
        NSFWstatus,
        isCreator,
        store,
        uptime,
        command: cmd.name,
        commands,
        Function: Func,
        toUpper: function toUpper(query) {
          return query.replace(/^\w/, (c) => c.toUpperCase());
        },
      });
    } catch (e) {
      e = String(e);
      if (!e.includes("cmd.start")) console.error(chalk.red("❌ Erro Core:"), e);
    }
  };