/*▓██ ██▓ ▄▄▄ ██ ▄█▀▄▄▄
 ▒██ ██▒▒████▄ ██▄█▒▒████▄
 ▒██ ██░▒██ ▀█▄ ▓███▄░▒██ ▀█▄
 ░ ▐██▓░░██▄▄▄▄██ ▓██ █▄░██▄▄▄▄██
 ░ ██▒▓░ ▓█ ▓██▒▒██▒ █▄▓█ ▓██▒
 ██▒▒▒ ▒▒ ▓▒█░▒ ▒▒ ▓▒▒▒ ▓▒█░
 ▓██ ░▒░ ▒ ▒▒ ░░ ░▒ ▒░ ▒ ▒▒ ░
 ▒ ▒ ░░ ░ ▒ ░ ░░ ░ ░ ▒
 ░ ░ ░ ░░ ░ ░ ░
 ░ ░
Olá,
Obrigado por usar o bot Yaka.
Eu sou,
██╗ ██╗ █████╗ ██╗ ██╗ █████╗ ███████╗██╗ ██╗██╗
╚██╗ ██╔╝██╔══██╗██║ ██╔╝██╔══██╗██╔════╝██║ ██║██║
 ╚████╔╝ ███████║█████╔╝ ███████║███████╗███████║██║
 ╚██╔╝ ██╔══██║██╔═██╗ ██╔══██║╚════██║██╔══██║██║
 ██║ ██║ ██║██║ ██╗██║ ██║███████║██║ ██║██║
 ╚═╝ ╚═╝ ╚═╝╚═╝ ╚═╝╚═╝ ╚═╝╚══════╝╚═╝ ╚═╝╚═╝
 */

require("dotenv").config();

let gg = process.env.MODS;
if (!gg) {
    gg = "6584660212"; // Você pode mudar este número //
}

// -------------------------------------------------------------- //
global.owner = gg.split(",");

// MONGODB - Configurar com MongoDB Atlas para velocidade
global.mongodb = process.env.MONGODB || "mongodb+srv://seu-usuario:sua-senha@cluster.mongodb.net/yakabot?retryWrites=true&w=majority";
global.mongodbUrl = process.env.MONGODB_URL || global.mongodb;

global.sessionId = process.env.SESSION_ID || "ok";
global.prefa = process.env.PREFIX || ".";
global.tenorApiKey = process.env.TENOR_API_KEY || "AIzaSyCAYZ930Rq1EFiRNRJuSeGGrKljCnOb8-U";
global.packname = process.env.PACKNAME || `👹 𝕐𝕒𝕜𝕒ᵐᵈ`;
global.author = process.env.AUTHOR || "por: 𝖄𝖆𝖐𝖆𝖘𝖍𝖎";
global.port = process.env.PORT || "3000";

// FUNCIONALIDADES IMPORTANTES HABILITADAS
global.disableXP = true; // Desabilitar XP (causa lentidão)
global.disableAntilink = true; // Desabilitar antilink (causa lentidão)
global.disableBotSwitch = false; // ✅ MANTER botSwitch
global.disableChatbot = false; // ✅ MANTER chatbot  
global.disableNSFW = false; // ✅ MANTER NSFW check
global.disableBan = false; // ✅ MANTER sistema de ban

// OTIMIZAÇÕES DE VELOCIDADE
global.fastMode = true; // Modo rápido
global.quickResponse = true; // Resposta rápida
global.cacheEnabled = true; // Cache habilitado
global.optimizedDB = true; // DB otimizado

// CONFIGURAÇÕES DE TIMEOUT OTIMIZADAS
global.dbTimeout = 3000; // 3 segundos timeout (mais rápido)
global.commandTimeout = 5000; // 5 segundos para comandos
global.responseTimeout = 2000; // 2 segundos para resposta

module.exports = {
    mongodb: global.mongodb,
};

// ---------------------Não Modifique esta parte------------------- //
global.mess = {
    jobdone: "✅ Tarefa concluída!",
    useradmin: "❌ Apenas *Administradores* podem usar este comando!",
    botadmin: "❌ Preciso ser *Administrador* para executar este comando!",
    botowner: "❌ Apenas meu *Dono* pode usar este comando!",
    grouponly: "❌ Este comando é apenas para *Grupos*!",
    privateonly: "❌ Este comando é apenas para *Chat Privado*!",
    botonly: "❌ Apenas o próprio *Bot* pode usar este comando!",
    waiting: "⏳ Processando...",
    nolink: "❌ Forneça um *link*!",
    error: "❌ Ocorreu um erro!",
    banned: `🚫 Você está banido!\n\nDigite ${global.prefa}owner para solicitar desbloqueio.`,
    bangc: "🚫 Este grupo está *banido*!",
    nonsfw: "🔞 Este grupo não permite conteúdo NSFW!",
};
