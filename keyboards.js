const fs = require("fs");
const { Extra, Markup } = require("telegraf"); // telegram bot
const settings = JSON.parse(fs.readFileSync("response.json"));

// Клавиатуры

exports.menuKeyboard = Markup.keyboard([
  [settings.bot.keyboard.partiture],
  [settings.bot.keyboard.randomVoice],
  [settings.bot.keyboard.help, settings.bot.keyboard.why]
])
  .removeKeyboard(true)
  .resize()
  .extra();

exports.menuKeyboardWithOutSend = Markup.keyboard([
  [settings.bot.keyboard.randomVoice],
  [settings.bot.keyboard.help, settings.bot.keyboard.why]
])
  .removeKeyboard(true)
  .resize()
  .extra();

exports.agreementKey = Extra.HTML().markup(m =>
  m.inlineKeyboard([
    m.callbackButton("✅", "agree"),
    // m.callbackButton("❌", "disagree")
  ])
);



exports.randomizeKey = Extra.load({ caption: settings.bot.partiture.text })
  .markdown()
  .markup(m =>
    m.inlineKeyboard([m.callbackButton("Получить другую ✨", "randomize")])
  );

exports.ranomizeVoice = Extra.HTML().markup(m =>
  m.inlineKeyboard([
    m.callbackButton("Получить другуое аудиосообщение", "ranomizeVoice")
  ])
);
exports.exitKeyboard = Markup.keyboard([settings.bot.keyboard.mainMenu])
  .removeKeyboard(true)
  .resize()
  .extra();
