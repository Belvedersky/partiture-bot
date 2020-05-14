// Для работы с файлами
const fs = require("fs");
const getStat = require("util").promisify(fs.stat);

// Скачивание и настройки
const { download, convert, randomImage } = require("./utils");
const settings = JSON.parse(fs.readFileSync("settings.json"));

// https://www.npmjs.com/package/sqlite3
const sqlite3 = require("sqlite3").verbose();
const dbFile = process.env.DB;
const exists = fs.existsSync(dbFile);
const db = new sqlite3.Database(dbFile);

// https://telegraf.js.org/#/
const { Telegraf, Extra, Markup } = require("telegraf"); // telegram bot
const Telegram = require("telegraf/telegram"); // telegram
const bot = new Telegraf(process.env.TOKEN);
const telegram = new Telegram(process.env.TOKEN);

// https://expressjs.com/ru
const express = require("express");
const bodyParser = require("body-parser");
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(express.static(".data"));
app.set("view engine", "pug");

//Клавиатуры
const {
  menuKeyboard,
  menuKeyboardWithOutSend,
  exitKeyboardwithAudio,
  menuReEnter,
  exitKeyboard,
  agreementKey,
  randomizeKey,
  ranomizeVoice
} = require("./keyboards");

// Сессия
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
  ctx.replyWithChatAction("typing");
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
      ctx.replyWithChatAction("typing").then(() => {
        ctx.replyWithHTML(settings.bot.agree, agreementKey);
      });
    }
  }, settings.bot.startDelay[i]);
});

greeterScene.action("agree", ctx => {
  ctx.scene.enter("root");
  //ctx.scene.state.agree = "yes";
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
  ctx.scene.reenter("greeter");
});
greeterScene.command("start", ctx => {
  ctx.scene.reenter("greeter");
});

greeterScene.hears("exit", ctx => {
  ctx.scene.enter("root");
});

greeterScene.on(["text", "media", "sticker"], ctx => {
  // telegram.deleteMessage(ctx.chat.id, ctx.update.message.message_id);
  // ctx.reply("Пожалуйста согласитесь на то что вы даете право использовать ваши аудиосообщения",menuKeyboard);
  ctx.scene.enter("root");
  ctx.reply("Хорошо!", menuKeyboard);
});

// Cцена отправки аудио нотации
const sendVoice = new Scene("sendVoice");
stage.register(sendVoice);

sendVoice.enter((ctx, next) => {
  //telegram.deleteMessage(ctx.chat.id, ctx.update.message.message_id);
  ctx.scene.state.send = false;
  ctx.replyWithChatAction("upload_photo");
  const partiture = settings.partiture[randomImage(settings.partiture.length)];
  ctx.scene.state.image = partiture;
  ctx.replyWithPhoto({ url: partiture }, randomizeKey).then(() => {
    ctx.reply("Теперь озвучьте нотацию.", exitKeyboard);
  });
});

sendVoice.action("randomize", ctx => {
  if (!ctx.scene.state.send) {
    let partiture = settings.partiture[randomImage(settings.partiture.length)];
    while (partiture === ctx.scene.state.image) {
      partiture = settings.partiture[randomImage(settings.partiture.length)];
    }
    settings.partiture[randomImage(settings.partiture.length)];
    ctx.scene.state.image = partiture;
    ctx.answerCbQuery(`🎰🎼🎶`).then(() => {
      ctx.editMessageMedia({ type: "photo", media: partiture }, randomizeKey);
    });
  } else {
    ctx
      .answerCbQuery(`Вы уже отправили аудио-сообщение с этой нотацией`)
      .then(() => {
        ctx.editMessageMedia({ type: "photo", media: ctx.scene.state.image });
      });
  }
});

// Сохраняем file_id voice в bd если пришло сообщение
// типа voice с duration > 1 и < 180  1сек 3мин
sendVoice.on("voice", ctx => {
  if (!ctx.scene.state.send) {
    if (!process.env.DISALLOW_WRITE) {
      if (ctx.message.voice.duration < 1) {
        // меньше секунды
        ctx.reply(settings.bot.error.duration_min, exitKeyboard);
      } else if (ctx.message.voice.duration > 180) {
        // больше 3 минут
        ctx.reply(settings.bot.error.duration_max, exitKeyboard);
      } else {
        ctx.scene.state.send = true;
        ctx.scene.state.listen = "";
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
  } else {
    ctx.reply(
      "Вы уже записали аудио-сообщение, хотите записать еще одно?",
      menuReEnter
    );
  }
});

sendVoice.action("reEnter", ctx => {
  ctx.scene.reenter("greeter");
});

sendVoice.action("author", ctx => {
  db.run(settings.sql.addAuthorVoice, ctx.from.username, ctx.scene.state.voice);
  ctx.answerCbQuery(`🎉🎉🎉`);
  ctx.editMessageText(settings.bot.save);
  //ctx.scene.enter("root");
  const textreply = "Cупер!🙃 опубликовали запись от вашего имени!\n";
  // ctx.reply(
  //   "Cупер!🙃 опубликовали запись от вашего имени!\nПосмотрите какие есть у нас записанные сообщения с этой графической нотацией ",
  //   exitKeyboard
  // );
  ctx.replyWithChatAction("upload_voice");
  db.each(
    `SELECT * FROM Voices WHERE image = '${ctx.scene.state.image}' AND voice != '${ctx.scene.state.voice}' ORDER BY RANDOM() LIMIT 1;`, //AND username !=${ctx.from.username}
    (err, row) => {
      //console.log(row);
      if (row) {
        console.log(row);
        ctx.replyWithChatAction("upload_voice");
        ctx.scene.state.listen = row.id;
        ctx
          .reply(
            textreply +
              "Посмотрите какие есть у нас записанные сообщения с этой графической нотацией",
            exitKeyboardwithAudio
          )
          .then(() => {
            ctx.replyWithPhoto({ url: ctx.scene.state.image }).then(() => {
              ctx.replyWithVoice(row.voice, {
                caption: row.username ? `@${row.username}` : " " //settings.bot.voice.text,
              });
            });
          });

        //console.log(ctx.scene.state);
      } else {
        ctx.reply(
          textreply +
            "У нас еще нету записей кроме вашей для этой графической нотации"
        );
      }
    }
  );
});

sendVoice.action("anonimous", ctx => {
  ctx.answerCbQuery(`🕶🕶🕶`);
  ctx.editMessageText(settings.bot.save);
  const replyAn = "Хорошо, опубликовали вашу запись анонимно 😎";

  db.get(
    `SELECT * FROM Voices WHERE image = '${ctx.scene.state.image}' AND voice != '${ctx.scene.state.voice}' ORDER BY RANDOM() LIMIT 1;`,
    (err, row) => {
      if (row) {
        ctx.replyWithChatAction("upload_voice");
        ctx.scene.state.listen = row.id;
        ctx
          .reply(
            replyAn +
              "Посмотрите какие есть у нас записанные сообщения с этой графической нотацией",
            exitKeyboardwithAudio
          )
          .then(() => {
            ctx.replyWithPhoto({ url: ctx.scene.state.image }).then(() => {
              ctx.replyWithVoice(row.voice, {
                caption: row.username ? `@${row.username}` : " " //settings.bot.voice.text,
              });
            });
          });

        //console.log(ctx.scene.state);
      } else {
        ctx.reply(
          replyAn +
            "У нас еще нету записей кроме вашей для этой графической нотации"
        );
      }
    }
  );
});

sendVoice.hears("Еще одно аудиосообщение", ctx => {
  //console.log(ctx.scene.state.send);
  if (ctx.scene.state.send) {
    const req = `SELECT * FROM Voices WHERE image = '${ctx.scene.state.image}' AND id != ${ctx.scene.state.listen} ORDER BY RANDOM() LIMIT 1;`;
    //console.log(req);
    db.get(req, (err, row) => {
      if (err) {
        throw err;
      }
      if (row) {
        ctx.scene.state.listen =
          ctx.scene.state.listen + ` AND id != ${row.id}`;
        ctx.replyWithPhoto({ url: ctx.scene.state.image },exitKeyboardwithAudio).then(() => {
              ctx.replyWithVoice(row.voice, {
                caption: row.username ? `@${row.username}` : " " //settings.bot.voice.text,
              });
            });
      } else {
        ctx.reply(
          "Кажется сообщения закончились но вы можете посмотреть другие в главном меню или записать еще одно на другую графическую нотацию",
          exitKeyboard
        );
      }
    });
  } else {
    ctx.reply(
      "Cначала отправьте аудио-сообщение что бы получить другие на такую же графическую нотацию",
      exitKeyboard
    );
  }
});
sendVoice.hears(settings.bot.keyboard.mainMenu, ctx => {
  ctx.scene.enter("root");
  ctx.reply("Главное меню", menuKeyboard);
});

sendVoice.on(["text", "media", "sticker", "document"], ctx => {
  if (ctx.scene.state.send) {
    ctx.reply(
      "Вы уже записали аудио-сообщение, хотите записать еще одно?",
      menuReEnter
    );
  } else {
    //telegram.deleteMessage(ctx.chat.id, ctx.update.message.message_id);
    ctx.reply("Пожалуйста отправьте голосовое сообщение", exitKeyboard);
  }
});

const rootScene = new Scene("root");
stage.register(rootScene);

rootScene.enter(ctx => {
  //ctx.reply("Привет!")  ///
  //ctx.scene.state.agree  = agree;
});

// Отправка случайного войса
rootScene.hears(settings.bot.keyboard.randomVoice, (ctx, next) => {
  ctx.replyWithChatAction("upload_voice");
  ctx.scene.state.media ? false : ctx.scene.state.media;
  const sql = `SELECT * FROM Voices WHERE image IS NOT NULL ${
    ctx.scene.state.media ? "AND id != " + ctx.scene.state.media : " "
  } ORDER BY RANDOM() LIMIT 1;`;
  db.each(sql, (err, row) => {
    ctx.scene.state.media = row.id;
    // ctx.reply("Cлучайная запись",menuKeyboard)
    ctx.replyWithPhoto({ url: row.image }).then(() => {
      ctx.replyWithVoice(row.voice, {
        caption: row.username ? `@${row.username}` : " " //settings.bot.voice.text,
      });
    });
    // console.log(`Send ${row.voice} to ${ctx.chat.first_name} ${ctx.chat.last_name}`);
  });
});

// Костыль
rootScene.action("randomize", ctx => {
  ctx.answerCbQuery(`Упс а это мы еще не продумали...`);
  ctx.editMessageMedia({ type: "photo", media: settings.partiture[0] });
});

rootScene.action("agree", ctx => {
  ctx.scene.enter("root");
  //ctx.scene.state.agree = "yes";
  ctx.answerCbQuery(`🎉 Cупер! 🎉`);
  ctx.editMessageText(settings.bot.agree);
});

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
rootScene.command("start", ctx => ctx.scene.enter("greeter"));

rootScene.on("text", ctx =>
  ctx.reply("Круто! но я ничего не понял", menuKeyboard)
);

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

/// Используется пока как wakeup
app.get("/voices", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
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
