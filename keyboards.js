const fs = require("fs");
const { Extra, Markup } = require("telegraf"); // telegram bot
const settings = JSON.parse(fs.readFileSync("settings.json"));

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
    m.callbackButton(settings.bot.keyboard.ready, "agree")
    // m.callbackButton("❌", "disagree")
  ])
);

exports.randomizeKey = Extra.load({ caption: settings.bot.partiture.text })
  .markdown()
  .markup(m =>
    m.inlineKeyboard([m.callbackButton(settings.bot.keyboard.randomize, "randomize")])
  );

exports.ranomizeVoice = Extra.HTML().markup(m =>
  m.inlineKeyboard([
    m.callbackButton(settings.bot.keyboard.anotherMessage, "ranomizeVoice")
  ])
);
exports.exitKeyboard = Markup.keyboard([settings.bot.keyboard.mainMenu])
  .removeKeyboard(true)
  .resize()
  .extra();

exports.exitKeyboardwithAudio = Markup.keyboard([settings.bot.keyboard.replyWithOther, settings.bot.keyboard.mainMenu])
  .removeKeyboard(true)
  .resize()
  .extra();

exports.menuReEnter = Extra.HTML().markup(m =>
  m.inlineKeyboard([
    m.callbackButton(settings.bot.keyboard.recordOther, "reEnter")
  ])
);