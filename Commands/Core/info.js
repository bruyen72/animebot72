const { mku } = require("../../Database/dataschema.js");
const { sessionSchema } = require("../../Database/index.js");
const { runtime } = require("../../lib/myfunc.js");

module.exports = {
  name: "stats",
  alias: ["info"],
  desc: "Exibe estatísticas do bot",
  category: "Core",
  usage: "stats",
  react: "📊",

  start: async (
    Yaka,
    m,
    { text, prefix, mentionByTag, pushName, isCreator, participants, modStatus, commands, store, from }
  ) => {
    try {
      if (!isCreator && modStatus === "false") {
        return Yaka.sendMessage(
          m.from,
          { text: "Desculpe, apenas meu *Proprietário* e *Mods* podem usar este comando!" },
          { quoted: m }
        );
      }

      const [modlist, FetchGC, totalUsers, sessionCount] = await Promise.all([
        mku.find({ addedMods: "true" }),
        Yaka.groupFetchAllParticipating(),
        mku.find({}),
        sessionSchema.countDocuments(),
      ]);

      const groups = Object.entries(FetchGC).map((entry) => entry[1]);
      const groupIds = groups.map((v) => v.id);
      const modIds = modlist.map((mod) => mod.id);
      const cmds = Array.from(commands.values()).filter((v) => v.type !== "hide").length;

      const statsText = generateStatsText(
        totalUsers.length,
        2,
        groupIds.length,
        modIds.length,
        cmds,
        sessionCount,
        process.uptime()
      );

      return Yaka.sendMessage(m.from, { text: statsText }, { quoted: m });
    } catch (error) {
      console.error("Erro no comando stats:", error);
      return Yaka.sendMessage(
        m.from,
        { text: "Ocorreu um erro ao obter as estatísticas do bot." },
        { quoted: m }
      );
    }
  },
};

function generateStatsText(users, bots, groups, mods, commands, sessions, uptime) {
  return `
*|• ━━━❰⭕ ${botName} ⭕❱━━━ •|*
╠ • ⚓️ Usuários: ${users}
╠ • 🤖 Bots: ${bots}
╠ • 🤼 Grupos: ${groups}
╠ • 🛃 Mods: ${mods}
╠ • 🉑 Comandos: ${commands}
╠ • 🍔 Sessões: ${sessions}
╠ • 🕒 Tempo online: ${runtime(uptime)}
|• ━━━━━━━━━━━━━━`;
}
