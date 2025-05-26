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

// MONGODB DESABILITADO - Para evitar erros
global.mongodb = ""; // Deixar vazio para desabilitar
global.mongodbUrl = ""; // Deixar vazio para desabilitar

global.sessionId = process.env.SESSION_ID || "ok";
global.prefa = process.env.PREFIX || ".";
global.tenorApiKey = process.env.TENOR_API_KEY || "AIzaSyCAYZ930Rq1EFiRNRJuSeGGrKljCnOb8-U";
global.packname = process.env.PACKNAME || `👹 𝕐𝕒𝕜𝕒ᵐᵈ`;
global.author = process.env.AUTHOR || "por: 𝖄𝖆𝖐𝖆𝖘𝖍𝖎";
global.port = process.env.PORT || "8000";

// CONFIGURAÇÕES PARA DESABILITAR FUNCIONALIDADES QUE CAUSAM ERRO
global.disableXP = true; // Desabilitar sistema de XP
global.disableAntilink = true; // Desabilitar antilink
global.disableBotSwitch = true; // Desabilitar botSwitch
global.disableChatbot = true; // Desabilitar chatbot
global.disableNSFW = true; // Desabilitar NSFW check
global.disableBan = true; // Desabilitar sistema de ban

module.exports = {
    mongodb: global.mongodb,
};

// ---------------------Não Modifique esta parte------------------- //
global.mess = {
    jobdone: "Tarefa concluída...",
    useradmin: "Desculpe, apenas *Administradores do Grupo* podem usar este comando *Baka*!",
    botadmin: "Desculpe, não posso executar este comando sem ser um *Administrador* deste grupo.",
    botowner: "Apenas meu *Dono* pode usar este comando, Baka!",
    grouponly: "Este comando é feito apenas para *Grupos*, Baka!",
    privateonly: "Este comando é feito apenas para *Chat Privado*, Baka!",
    botonly: "Apenas o próprio *Bot* pode usar este comando!",
    waiting: "Aguarde um momento...",
    nolink: "Por favor, me forneça um *link*, Baka!",
    error: "Ocorreu um erro!",
    banned: `Você está Banido de usar comandos! \n\nDigite ${global.prefa}owner ou ${global.prefa}support para enviar uma solicitação para desbanir você mesmo!`,
    bangc: "Este Grupo está *Banido* de usar Comandos!",
    nonsfw: "Não seja pervertido Baka! Este não é um grupo habilitado para NSFW!",
};
