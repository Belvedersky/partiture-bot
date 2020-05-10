// Клавиатуры
const fs = require("fs");
const { Extra, Markup } = require("telegraf"); // telegram bot
const settings = JSON.parse(fs.readFileSync("response.json"));

exports.menuKeyboard = Markup.keyboard([
  [settings.bot.keyboard.partiture],
  [settings.bot.keyboard.random],
  [settings.bot.keyboard.help]
]).removeKeyboard(true).resize().extra();
