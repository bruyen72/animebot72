const { getBuffer } = require("../../lib/myfunc");

module.exports = {
  name: "hYaka",
  alias: ["nsfwYaka", "hentaiYaka", "henYaka"],
  desc: "Hentai picture of Yaka",
  category: "Weeb",
  usage: `hYaka`,
  react: "👹",
  start: async (Yaka, m, { prefix,NSFWstatus }) => {

    // ✅ Verificação removida - Core.js controla automaticamentensfw*`);
    let Image = await getBuffer(`https://Yakahentai-api.onrender.com/`);
    let Button = [];
     
    let bmffg = {
      image: Image,
      caption: `Yaka Hentai API by *Team Atlas*\n\n*API link:* https://shubhapratimbiswas.tech\n`,
      footer: `*${botName}*`,
      buttons: Button,
      headerType: 4,
    };
    await Yaka.sendMessage(m.from, bmffg, { quoted: m }).catch((err) => {
      return "Error!";
    });
  },
};
