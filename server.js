const fs = require("fs");
const getStat = require("util").promisify(fs.stat);

// https://expressjs.com/ru
const express = require("express");
const bodyParser = require("body-parser");
const app = express();

const { download, convert } = require("./utils");
const settings = JSON.parse(fs.readFileSync("response.json"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.set("view engine", "pug");

// https://www.npmjs.com/package/sqlite3
const sqlite3 = require("sqlite3").verbose();
const dbFile = process.env.DB;
const exists = fs.existsSync(dbFile);
const db = new sqlite3.Database(dbFile);

// https://telegraf.js.org/#/
const { Telegraf } = require("telegraf"); // telegram bot
const Telegram = require("telegraf/telegram"); // telegram

const bot = new Telegraf(process.env.TOKEN);
const telegram = new Telegram(process.env.TOKEN);
const { menuKeyboard } = require("./keyboards");

// init sqlite db
db.serialize(() => {
  if (!exists) {
    db.run(settings.sql.init);
    // console.log("New table Voices created!");
  }
  // else {
  //   console.log('Database "Voices" ready to go!');
  // }
});

// init bot
bot.use(async (ctx, next) => {
  const start = new Date();
  await next();
  const ms = new Date() - start;
  console.log("Ответ отправлен за %sms", ms);
});

// start
bot.start(ctx =>
  ctx.reply(
    `Привет ${ctx.chat.first_name}!\n` + settings.bot.start,
    menuKeyboard
  )
);

// help
bot.hears(settings.bot.keyboard.help, ctx => ctx.reply(settings.bot.help, menuKeyboard));


// on voice
// Сохраняем file_id в Базу если пришло сообщение типа voice
bot.on("voice", ctx => {
  if (!process.env.DISALLOW_WRITE) {
    if (ctx.message.voice.duration < 1) {
      // меньше секунды
      ctx.reply(settings.bot.error.duration_min, menuKeyboard);
    }
    if (ctx.message.voice.duration > 180) {
      // больше 3 минут
      ctx.reply(settings.bot.error.duration_max, menuKeyboard);
    } else {
      db.run(settings.sql.add, ctx.message.voice.file_id, error => {
        if (error) {
          ctx.reply(settings.bot.error.db, menuKeyboard);
        } else {
          console.log(ctx.message.voice.file_id);
          ctx.reply(settings.bot.save, menuKeyboard);
        }
      });
    }
  }
});

// Отправка случайного войса
bot.hears(settings.bot.keyboard.random, ctx => {
  // console.log(ctx);
  db.each(settings.sql.random, (err, row) => {
    ctx.reply(
      "Какой то текст можно картинку можно имя создателя и тд ",
      menuKeyboard
    );
    ctx.replyWithVoice(ctx.chat.id, {
      voice: row.voice
    });
    console.log(
      `Send ${row.voice} to ${ctx.chat.first_name} ${ctx.chat.last_name}`
    );
  });
});

// Отправка случайной графической нотации
bot.hears(settings.bot.keyboard.partiture, ctx => {
  ctx.reply(settings.bot.partiture, menuKeyboard);
  ctx.replyWithPhoto(ctx.chat.id, {
    photo:
      settings.partiture[Math.floor(Math.random() * settings.partiture.length)]
  });
});

/// Главная страница
app.get("/", (req, res) => {
  res.sendFile(`${__dirname}/views/mainpage.html`);
});

/// change voice to random тут берется случайный id из базы  ->
/// получает ссылку через getFileLink -> скачиваем download ->
/// конвертируем в webm и wav что бы у всех заработало
app.get("/randomize", (req, res) => {
  db.each(settings.sql.random, (err, row) => {
    telegram.getFileLink(row.voice).then(voiceLink => {
      download(voiceLink, "public/voice.oga", () => {
        convert(settings.convert + "webm"); // конверт в webm, некоторые браузеры не понимают .oga
        convert(settings.convert + "wav"); // для safari 🙁
        res.send("ok!"); // Можно сделать чанки с процессом сonvert и отрисовать их в интерфейсе
      });
    });
  });
});

/// Получаем все партитуры и ссылки на них для прослушивания
/// Что бы прослушать надо открыть страницу через vpn так как
/// там идет скачиваение из апи телеги я рекомендую браузер опера
app.get("/voices", (req, res) => {});

/// Трансляция аудио –– можно скачивать из телеграмма и отправлять последовательно
/// http://cangaceirojavascript.com.br/streaming-audio-node/
const buffer = 2;

app.get("/audio", async (req, res) => {
  const filePath = `${__dirname}/public/voice.oga`;
  const stat = await getStat(filePath);
  console.log(stat);

  // В заголовок указываем что это аудио
  res.writeHead(200, {
    "Content-Type": "audio/oga",
    "Content-Length": stat.size
  });
  //
  const stream = fs.createReadStream(filePath, { buffer });

  // В конце пишем done
  stream.on("end", () => console.log("done"));

  // Стримим аудио
  stream.pipe(res);
});

// Запуск сервера
app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${process.env.PORT}`);
});

// Запускаем бота
bot.launch();
