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
 require("../config.js");
 const config = require('../config');
 const mongoose = require("mongoose");
 
 // Estruturas para armazenamento em memória (quando não há MongoDB)
 const inMemoryDB = {
   groups: {},
   users: {},
   characters: {}
 };
 
 // Verifica se a conexão MongoDB está configurada
 const isMongoConfigured = config.mongodb && config.mongodb.trim() !== '';
 
 let db1, db2;
 let mku, mk, mkchar;
 
 // Tenta conectar ao MongoDB apenas se estiver configurado
 if (isMongoConfigured) {
   try {
     db1 = mongoose.createConnection(config.mongodb);
     db2 = mongoose.createConnection(config.mongodb);
     
     console.log("Tentando conectar ao MongoDB...");
     
     // Define os schemas
     const GroupSchema = new mongoose.Schema({
       id: { type: String, unique: true, required: true },
       antilink: { type: String, default: "false" },
       nsfw: { type: String, default: "false" },
       bangroup: { type: String, default: "false" },
       chatBot: { type: String, default: "false" },
       botSwitch: { type: String, default: "true" },
       switchNSFW: { type: String, default: "false" },
       switchWelcome: { type: String, default: "false" }
     });
     
     const UserSchema = new mongoose.Schema({
       id: { type: String, unique: true, required: true },
       ban: { type: String, default: "false" },
       name: { type: String },
       gcname: { type: String },
       reason: { type: String, default: "no reason" },
       addedMods: { type: String, default: "false" }
     });
     
     const CharacterSchema = new mongoose.Schema({
       id: { type: String, unique: false, required: true, default: "1" },
       seletedCharacter: { type: String, default: "0" },
       PMchatBot: { type: String, default: "false" },
       privateMode: { type: String, default: "false" }
     });
     
     // Cria os modelos
     mku = db1.model("Mku", UserSchema);
     mk = db1.model("Mk", GroupSchema);
     mkchar = db2.model("Mkchar", CharacterSchema);
     
     // Eventos de conexão para logging
     db1.on('connected', () => console.log('Database 1 connected!'));
     db1.on('error', (err) => console.log('Database 1 connection error:', err));
     
     db2.on('connected', () => console.log('Database 2 connected!'));
     db2.on('error', (err) => console.log('Database 2 connection error:', err));
     
   } catch (error) {
     console.error("Erro ao configurar MongoDB:", error);
     console.log("Usando armazenamento em memória como fallback");
   }
 }
 
 // Cria versões em memória dos modelos para quando não há MongoDB
 const mockModels = {
   mku: {
     findOne: async (query) => {
       const userId = query.id;
       return inMemoryDB.users[userId] || null;
     },
     findOneAndUpdate: async (query, update, options) => {
       const userId = query.id;
       if (!inMemoryDB.users[userId]) {
         if (options && options.upsert) {
           inMemoryDB.users[userId] = { 
             id: userId,
             ban: "false",
             name: "",
             gcname: "",
             reason: "no reason",
             addedMods: "false"
           };
         } else {
           return null;
         }
       }
       
       // Aplica as atualizações
       if (update.$set) {
         Object.assign(inMemoryDB.users[userId], update.$set);
       }
       
       return inMemoryDB.users[userId];
     },
     create: async (data) => {
       inMemoryDB.users[data.id] = data;
       return data;
     }
   },
   
   mk: {
     findOne: async (query) => {
       const groupId = query.id;
       return inMemoryDB.groups[groupId] || null;
     },
     findOneAndUpdate: async (query, update, options) => {
       const groupId = query.id;
       if (!inMemoryDB.groups[groupId]) {
         if (options && options.upsert) {
           inMemoryDB.groups[groupId] = {
             id: groupId,
             antilink: "false",
             nsfw: "false",
             bangroup: "false",
             chatBot: "false",
             botSwitch: "true",
             switchNSFW: "false",
             switchWelcome: "false"
           };
         } else {
           return null;
         }
       }
       
       // Aplica as atualizações
       if (update.$set) {
         Object.assign(inMemoryDB.groups[groupId], update.$set);
       }
       
       return inMemoryDB.groups[groupId];
     },
     create: async (data) => {
       inMemoryDB.groups[data.id] = data;
       return data;
     }
   },
   
   mkchar: {
     findOne: async (query) => {
       const charId = query.id;
       return inMemoryDB.characters[charId] || null;
     },
     findOneAndUpdate: async (query, update, options) => {
       const charId = query.id;
       if (!inMemoryDB.characters[charId]) {
         if (options && options.upsert) {
           inMemoryDB.characters[charId] = {
             id: charId,
             seletedCharacter: "0",
             PMchatBot: "false",
             privateMode: "false"
           };
         } else {
           return null;
         }
       }
       
       // Aplica as atualizações
       if (update.$set) {
         Object.assign(inMemoryDB.characters[charId], update.$set);
       }
       
       return inMemoryDB.characters[charId];
     },
     create: async (data) => {
       inMemoryDB.characters[data.id] = data;
       return data;
     }
   }
 };
 
 // Exporta os modelos reais se MongoDB estiver disponível, ou os mock models caso contrário
 module.exports = {
   mk: isMongoConfigured && mk ? mk : mockModels.mk,
   mku: isMongoConfigured && mku ? mku : mockModels.mku,
   mkchar: isMongoConfigured && mkchar ? mkchar : mockModels.mkchar
 };
 
 // Avisa no console se estamos usando armazenamento em memória
 if (!isMongoConfigured) {
   console.log("MongoDB não configurado. Usando armazenamento em memória temporário.");
   console.log("AVISO: Os dados não serão persistidos quando o bot for reiniciado!");
 }