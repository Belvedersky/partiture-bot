// Для работы с файлами
const fs = require("fs");
const getStat = require("util").promisify(fs.stat);

// Скачивание и настройки
const { download, convert, randomImage } = require("./utils");
const settings = JSON.parse(fs.readFileSync("response.json"));

// https://www.npmjs.com/package/sqlite3
const sqlite3 = require("sqlite3").verbose();
const dbFile = process.env.DB;
const exists = fs.existsSync(dbFile);
const db = new sqlite3.Database(dbFile);

// https://telegraf.js.org/#/
//
const { Telegraf, Extra, Markup } = require("telegraf"); // telegram bot
const Telegram = require("telegraf/telegram"); // telegram
const bot = new Telegraf(process.env.TOKEN);
const telegram = new Telegram(process.env.TOKEN);

// app.use(bot.webhookCallback('/secret-path'))
// bot.telegram.setWebhook('https://instinctive-autumn-velvet.glitch.me/secret-path')

const express = require("express");
const bodyParser = require("body-parser");
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.set("view engine", "pug");
// app.use(bot.webhookCallback('/secret-path'))
// bot.telegram.setWebhook('https://instinctive-autumn-velvet.glitch.me/secret-path')


//Клавиатуры
const {
  menuKeyboard,
  menuKeyboardWithOutSend,
  exitKeyboard,
  agreementKey,
  randomizeKey,
  ranomizeVoice
} = require("./keyboards");

// Ссессия
const session = require("telegraf-session-sqlite");
const options = {
  db: db,
  table_name: "Session"
};

const Stage = require("telegraf/stage");
const Scene = require("telegraf/scenes/base");
const { enter, leave } = Stage;
const stage = new Stage();

// init sqlite db
db.serialize(() => {
  if (!exists) {
    db.run(settings.sql.initVoice);
    db.run(settings.sql.initPartiture);
    console.log("New tables Voices and Partitures created!");
  }
  // else {
  //   console.log('Database "Voices" ready to go!');
  // }
});

// Cцена старта
const greeterScene = new Scene("greeter");

stage.register(greeterScene);

greeterScene.enter(ctx => {
  //console.log(ctx.scene.state);
  ctx.replyWithHTML(`Привет, ${ctx.chat.first_name}!\n`);
  ctx.replyWithChatAction("typing");
  let i = 0;
  let interval = setInterval(function() {
    ctx.replyWithHTML(settings.bot.start[i]).then(() => {
      ctx.replyWithChatAction("typing");
    });
    i++;
    if (i === settings.bot.start.length) {
      clearInterval(interval);
      ctx.replyWithChatAction("typing");
      ctx.replyWithHTML(settings.bot.agree, agreementKey);
    }
  }, settings.bot.startDelay[i]);
});

greeterScene.action("agree", ctx => {
  ctx.scene.enter("root");
  ctx.scene.state.agree = "yes";
  ctx.answerCbQuery(`🎉 Cупер! 🎉`);
  ctx.editMessageText(settings.bot.agree);

  ctx.reply(
    "Cпасибо! теперь вы можете отправлять свои озвученые нотации 🎼",
    menuKeyboard
  );
});

// greeterScene.action("disagree", ctx => {
//   ctx.answerCbQuery(`☹️ Очень жаль! ☹️`);
// //    ctx.telegram.leaveChat(ctx.message.chat.id)
// });
greeterScene.command("restart", ctx => {
  ctx.scene.enter("greeter");
});

greeterScene.hears("exit", ctx => {
  ctx.scene.enter("root");
});

greeterScene.on(["text", "media", "sticker"], ctx => {
  // telegram.deleteMessage(ctx.chat.id, ctx.update.message.message_id);
  ctx.reply("Пожалуйста ответьте на пользовательское соглашение");
});

const sendVoice = new Scene("sendVoice");

stage.register(sendVoice);

// Отправка случайной графической нотации

sendVoice.enter((ctx, next) => {
  //telegram.deleteMessage(ctx.chat.id, ctx.update.message.message_id);
  ctx.replyWithChatAction("upload_photo");
  const partiture = settings.partiture[randomImage(settings.partiture.length)];
  ctx.scene.state.image = partiture;
  ctx.replyWithPhoto({ url: partiture }, randomizeKey).then(() => {
    ctx.reply("Теперь озвучьте партитуру.", exitKeyboard);
  });
});

sendVoice.action("randomize", ctx => {
  let partiture = settings.partiture[randomImage(settings.partiture.length)];
  while (partiture === ctx.scene.state.image) {
    partiture = settings.partiture[randomImage(settings.partiture.length)];
  }
  settings.partiture[randomImage(settings.partiture.length)];
  ctx.scene.state.image = partiture;
  ctx.answerCbQuery(`🎼Новая партитура🎶`).then(() => {
    ctx.editMessageMedia({ type: "photo", media: partiture }, randomizeKey);
  });
});

// Сохраняем file_id voice в bd если пришло сообщение
// типа voice с duration > 1 и < 180  1сек 3мин
sendVoice.on("voice", ctx => {
  if (!process.env.DISALLOW_WRITE) {
    if (ctx.message.voice.duration < 1) {
      // меньше секунды
      ctx.reply(settings.bot.error.duration_min);
    }
    if (ctx.message.voice.duration > 180) {
      // больше 3 минут
      ctx.reply(settings.bot.error.duration_max);
    } else {
      db.run(
        settings.sql.addVoice,
        ctx.message.voice.file_id,
        ctx.scene.state.image,
        parseInt(ctx.message.voice.duration),
        error => {
          if (error) {
            ctx.reply(settings.bot.error.db);
          } else {
            ctx.scene.state.voice = ctx.message.voice.file_id;
            //console.log(ctx.scene.state);
            ctx.reply(
              settings.bot.save,
              Extra.HTML().markup(m =>
                m.inlineKeyboard([
                  m.callbackButton(`@${ctx.from.username}`, "author"),
                  m.callbackButton("aнонимно", "anonimous")
                ])
              )
            );
          }
        }
      );
    }
  }
});

sendVoice.action("author", ctx => {
  db.run(settings.sql.addAuthorVoice, ctx.from.username, ctx.scene.state.voice);
  ctx.answerCbQuery(`🎉🎉🎉`);
  ctx.editMessageText(settings.bot.save);
  ctx.scene.enter("root");
  ctx.reply("Cупер! опубликовали запись от вашего имени! 🙃", menuKeyboard);
});

sendVoice.action("anonimous", ctx => {
  ctx.answerCbQuery(`🕶🕶🕶`);
  ctx.editMessageText(settings.bot.save);
  ctx.scene.enter("root");
  ctx.reply("Хорошо опубликовали вашу запись анонимно 😎", menuKeyboard);
});

sendVoice.hears(settings.bot.keyboard.mainMenu, ctx => {
  ctx.scene.enter("root");
  ctx.reply("Главное меню", menuKeyboard);
});

sendVoice.on(["text", "media", "sticker", "document"], ctx => {
  //telegram.deleteMessage(ctx.chat.id, ctx.update.message.message_id);
  ctx.reply("Пожалуйста отправьте голосовое сообщение", exitKeyboard);
});

const getVoice = new Scene("getVoice");
stage.register(getVoice);

const rootScene = new Scene("root");
stage.register(rootScene);

// Отправка случайного войса
rootScene.hears(settings.bot.keyboard.randomVoice, (ctx, next) => {
  ctx.replyWithChatAction("upload_voice");
  ctx.scene.state.media ? false : ctx.scene.state.media;
  const sql = `SELECT * FROM Voices WHERE image IS NOT NULL ${ctx.scene.state.media ? "AND id != "+ ctx.scene.state.media : " "} ORDER BY RANDOM() LIMIT 1;`;
  db.each( sql, (err, row) => { 
    ctx.scene.state.media = row.id;
    // ctx.reply("Cлучайная запись",menuKeyboard)
    ctx.replyWithPhoto({ url: row.image })
      .then(() => {
        ctx.replyWithVoice(row.voice,{
          caption: row.username ? `@${row.username}` : " ", //settings.bot.voice.text,
        })
      });
    // console.log(`Send ${row.voice} to ${ctx.chat.first_name} ${ctx.chat.last_name}`);
  });
});

// rootScene.on(["photo", "document"], ctx => {
//   //console.log(ctx.message);

//   if (!process.env.DISALLOW_WRITE) {
//     // Если прислали картинку
//     if (ctx.message.photo) {
//       const lastImage = ctx.message.photo.length - 1;
//       if (
//         ctx.message.photo[lastImage].width < 200 ||
//         ctx.message.photo[lastImage].height < 200
//       ) {
//         ctx.reply(settings.bot.error.photo_small, menuKeyboard);
//       } else {
//         console.log(ctx.message.from.username);
//         console.log(ctx.message.photo[lastImage].file_id);
//         if (ctx.message.caption) {
//           console.log(ctx.message.caption);
//         }
//         ctx.reply("Спасибо!", menuKeyboard);
//       }
//     }
//     if (ctx.message.document) {
//       console.log(ctx.message);
//       if (
//         ctx.message.document.mime_type === "image/jpeg" ||
//         ctx.message.document.mime_type === "image/png" ||
//         ctx.message.document.mime_type === "image/jpg"
//       ) {
//         if (
//           ctx.message.document.thumb.width < 200 ||
//           ctx.message.document.thumb.width < 200
//         ) {
//           ctx.reply(settings.bot.error.photo_small, menuKeyboard);
//         } else {
//           ctx.reply("Спасибо!", menuKeyboard);
//         }
//       }
//     }
//   }
// });



rootScene.enter(ctx => {
  // console.log(ctx);
});

// help
rootScene.hears(settings.bot.keyboard.help, ctx => {
  // telegram.deleteMessage(ctx.chat.id, ctx.update.message.message_id);
  ctx.reply(settings.bot.help, menuKeyboard);
});
// why
rootScene.hears(settings.bot.keyboard.why, ctx => {
  // telegram.deleteMessage(ctx.chat.id, ctx.update.message.message_id);
  ctx.reply(settings.bot.why, menuKeyboard);
});

// Cтикер или Кубик :)
rootScene.hears("dice", ctx => ctx.replyWithDice(ctx.chat.id, menuKeyboard));
rootScene.on(["sticker"], ctx => ctx.reply("Крутой стикер!", menuKeyboard));


rootScene.hears(settings.bot.keyboard.partiture, ctx =>
  ctx.scene.enter("sendVoice")
);
rootScene.command("start",ctx => ctx.scene.enter("greeter"));


rootScene.on("text", ctx => ctx.reply("Круто! но я ничего не понял",menuKeyboard));

bot.use(session(options));
bot.use(stage.middleware(options));

// bot.use(async (ctx, next) => {
//   const start = new Date();
//   await next();
//   const ms = new Date() - start;
//   console.log("Ответ отправлен за %sms", ms);
// });

// start
bot.start(ctx => ctx.scene.enter("greeter"));

// Запускаем бота
bot.startPolling();
bot.launch();

/// Сервер
//bot.telegram.setWebhook('https://instinctive-autumn-velvet.glitch.me/secret-path')
// bot.telegram.startWebhook('/secret-path', null, 3000);

// https://expressjs.com/ru
// Сервер

/// Главная страница
app.get("/", (req, res) => {
  res.sendFile(`${__dirname}/views/mainpage.html`);
});

/// change voice to random тут берется случайный id из базы  ->
/// получает ссылку через getFileLink -> скачиваем download ->
/// конвертируем в webm и wav что бы у всех заработало
app.get("/randomize", (req, res) => {
  db.each(settings.sql.randomVoice, (err, row) => {
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
app.get("/voices", (req, res) => {
  // console.log(req.headers);
  res.send("ok!");
});

app.get("/util", (req, res) => {
  // db.run("CREATE TABLE Paritures (id INTEGER PRIMARY KEY AUTOINCREMENT, image TEXT)");
  db.run("DROP TABLE IF EXISTS Paritures");
  res.send("ok!");
});

/// Трансляция аудио –– можно скачивать из телеграмма и отправлять последовательно
/// http://cangaceirojavascript.com.br/streaming-audio-node/
const buffer = settings.stream.buffer;

app.get("/audio", async (req, res) => {
  const filePath = `${__dirname}/public/voice.oga`;
  const stat = await getStat(filePath);
  //console.log(stat);

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
