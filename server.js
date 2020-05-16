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
const ms = require('mediaserver');

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
    console.log("DB serialize!");
  }
});

// Cцена старта
const greeterScene = new Scene("greeter");
stage.register(greeterScene);

greeterScene.enter(ctx => {
  //console.log(ctx.scene.state);
  ctx.replyWithHTML(`Привет, ${ctx.chat.first_name}!\n`);
  let i = 0;
  let interval = setInterval(function() {
    ctx
      .replyWithHTML(settings.bot.start[i])
      .catch(err => {
        console.log(err);
      })
      .then(() => {
        ctx.replyWithChatAction("typing");
      });
    i++;
    if (i === settings.bot.start.length) {
      clearInterval(interval);
      ctx
        .replyWithChatAction("typing")
        .catch(err => {
          console.log(err);
        })
        .then(() => {
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
    settings.bot.thanks,
    menuKeyboard
  );
});

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

// Cцена отправки аудио-нотации
const sendVoice = new Scene("sendVoice");
stage.register(sendVoice);

sendVoice.enter((ctx, next) => {
  //telegram.deleteMessage(ctx.chat.id, ctx.update.message.message_id);
  ctx.scene.state.send = false;
  ctx.replyWithChatAction("upload_photo");
  const partiture = settings.partiture[randomImage(settings.partiture.length)];
  ctx.scene.state.image = partiture;
  ctx
    .replyWithPhoto(partiture, randomizeKey)
    .catch(err => {
      console.log(err);
    })
    .then(() => {
      ctx.reply(settings.bot.vocalize, exitKeyboard);
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
    ctx
      .answerCbQuery(`🎰🎼🎶`)
      .catch(err => {
        console.log(err);
      })
      .then(() => {
        ctx.editMessageMedia({ type: "photo", media: partiture }, randomizeKey);
      });
  } else {
    ctx
      .answerCbQuery(`Вы уже отправили аудио-сообщение с этой нотацией`)
      .catch(err => {
        console.log(err);
      })
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
      settings.bot.repeat,
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
  ctx.replyWithChatAction("upload_voice");
  db.get(
    `SELECT * FROM Voices WHERE image = '${ctx.scene.state.image}' AND voice != '${ctx.scene.state.voice}' ORDER BY RANDOM() LIMIT 1;`, //AND username !=${ctx.from.username}
    (err, row) => {
      //console.log(row);
      if (row) {
        //console.log(row);
        ctx.replyWithChatAction("upload_voice");
        ctx.scene.state.listen = row.id;
        ctx
          .reply(
            settings.bot.ReplyAuthor +
             settings.bot.watchSound,
            exitKeyboardwithAudio
          )
          .catch(err => {
            console.log(err);
          })
          .then(() => {
            ctx
              .replyWithPhoto(ctx.scene.state.image)
              .catch(err => {
                console.log(err);
              })
              .then(() => {
                ctx.replyWithVoice(row.voice, {
                  caption: row.username ? `@${row.username}` : " " //settings.bot.voice.text,
                });
              });
          });
      } else {
        ctx.reply(
          settings.bot.ReplyAuthor +
            settings.bot.soundNone
        );
      }
    }
  );
});

sendVoice.action("anonimous", ctx => {
  ctx.answerCbQuery(`🕶🕶🕶`);
  ctx.editMessageText(settings.bot.save);
  db.get(
    `SELECT * FROM Voices WHERE image = '${ctx.scene.state.image}' AND voice != '${ctx.scene.state.voice}' ORDER BY RANDOM() LIMIT 1;`,
    (err, row) => {
      if (row) {
        ctx.replyWithChatAction("upload_voice");
        ctx.scene.state.listen = row.id;
        ctx
          .reply(
            settings.bot.ReplyAnonymously +
              settings.bot.watchSound,
            exitKeyboardwithAudio
          )
          
          .catch(err => {
            console.log(err);
          })
          .then(() => {
          ctx.replyWithChatAction("upload_voice");
            ctx
              .replyWithPhoto(ctx.scene.state.image)
              .catch(err => {
                console.log(err);
              })
              .then(() => {
                ctx.replyWithVoice(row.voice, {
                  caption: row.username ? `@${row.username}` : " " //settings.bot.voice.text,
                });
              });
          });
      } else {
        ctx.reply(
          settings.bot.ReplyAnonymously +
            settings.bot.soundNone
        );
      }
    }
  );
});

sendVoice.hears("Еще одно аудиосообщение", ctx => {
  ctx.replyWithChatAction("upload_voice");
  //console.log(ctx.scene.state.send);
  if (ctx.scene.state.send) {
    //console.log(req);
    db.get(`SELECT * FROM Voices WHERE image = '${ctx.scene.state.image}' AND id != ${ctx.scene.state.listen} ORDER BY RANDOM() LIMIT 1;`, (err, row) => {
      if (err) {
        throw err;
      }
      if (row) {
        ctx.scene.state.listen =
          ctx.scene.state.listen + ` AND id != ${row.id}`;
        ctx.replyWithPhoto(ctx.scene.state.image, exitKeyboardwithAudio)
          .then(() => {
            ctx.replyWithVoice(row.voice, {
              caption: row.username ? `@${row.username}` : " " //settings.bot.voice.text,
            });
          });
      } else {
        ctx.reply(
          settings.bot.soundEnd,
          exitKeyboard
        );
      }
    });
  } else {
    ctx.reply(
     settings.bot.firstSendPlease,
      exitKeyboard
    );
  }
});
sendVoice.hears(settings.bot.keyboard.mainMenu, ctx => {
  ctx.scene.enter("root");
  ctx.reply("Главное меню", menuKeyboard);
});

sendVoice.command("restart", ctx => ctx.scene.enter("greeter"));

sendVoice.on(["text", "media", "sticker", "document"], ctx => {
  if (ctx.scene.state.send) {
    ctx.reply(
     settings.bot.repeat,
      menuReEnter
    );
  } else {
    //telegram.deleteMessage(ctx.chat.id, ctx.update.message.message_id);
    ctx.reply(settings.bot.pleaseSendVoice, exitKeyboard);
  }
});



const imageLoad = new Scene("image");
stage.register(imageLoad);

imageLoad.command("restart", ctx => ctx.scene.enter("greeter"));

imageLoad.hears(settings.bot.keyboard.mainMenu, ctx => {
  ctx.scene.enter("root");
  ctx.reply("Главное меню", menuKeyboard);
});

imageLoad.enter(ctx => {
  ctx.reply("Привет! отправь мне графическую нотацию, не документом! по одной, за раз",exitKeyboard);  ///
  //ctx.scene.state.agree  = agree;
});

imageLoad.on("photo", ctx =>{
//console.log(ctx.message.photo[2].file_id);
  fs.appendFile(
            "images.txt",
            `${ctx.message.photo[2].file_id}\n`,
            err => {
              if (err) {
                console.log(err);
              } else {
                console.log("add "+ctx.message.photo[2].file_id);
              }
            })
  // ctx.reply(ctx.message.photo[2].file_id);
  ctx.replyWithPhoto(ctx.message.photo[2].file_id,{caption:"Cохранил это изображение!"},exitKeyboard)
}); 

imageLoad.on("text", ctx =>
  ctx.reply("Круто! но я ничего не понял, отправь мне графическую нотацию, не документом! по одной, за раз", exitKeyboard)
); 




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
  db.get(sql, (err, row) => {
    if(row){
    ctx.scene.state.media = row.id;
    // ctx.reply("Cлучайная запись",menuKeyboard)
    ctx
      .replyWithPhoto(row.image)
      .catch(err => {
        console.log(err);
      })
      .then(() => {
        ctx.replyWithVoice(row.voice, {
          caption: row.username ? `@${row.username}` : " " //settings.bot.voice.text,
        });
      });
    }else{
      ctx.reply(settings.bot.firstRecord, menuKeyboard)
    }
    //console.log(`Send: ${row.voice} to ${ctx.chat.first_name} ${ctx.chat.last_name}`);
  });
  
});

// Костыль
rootScene.action("randomize", ctx => {
  ctx.answerCbQuery(`Отлично! вы сломали бота!`);
  ctx.editMessageMedia({ type: "photo", media: "https://yakadr.ru/wp-content/uploads/2017/12/1975_1.jpg" });
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
  ctx.replyWithHTML(settings.bot.why, menuKeyboard);
});

// Cтикер или Кубик :)
rootScene.hears("dice", ctx => ctx.replyWithDice(ctx.chat.id, menuKeyboard));
rootScene.on(["sticker"], ctx => ctx.reply("Крутой стикер!", menuKeyboard));

rootScene.hears(settings.bot.keyboard.partiture, ctx =>
  ctx.scene.enter("sendVoice")
);
rootScene.command("start", ctx => ctx.scene.enter("greeter"));

rootScene.command("restart", ctx => ctx.scene.enter("greeter"));

rootScene.command("upload_new_image", ctx => ctx.scene.enter("image"))
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
// app.get("/mixtape", (req, res) => {
//   ms.pipe(req, res, `${__dirname}/public/mixtape.wav`);
// });

//    "https://sun9-43.userapi.com/lLIqryAyX0f1rmSeu14a2EcGgCL3CHrgzx7xKg/U3Sw-eaAs30.jpg",
/// change voice to random тут берется случайный id из базы  ->
/// получает ссылку через getFileLink -> скачиваем download ->
/// конвертируем в webm и wav что бы у всех заработало
app.get("/randomize", (req, res) => {
  db.each(settings.sql.randomVoice, (err, row) => {
    telegram
      .getFileLink(row.voice)
      .catch(err => {
        console.log(err);
      })
      .then(voiceLink => {
        download(voiceLink, "public/voice.oga", () => {
          convert(settings.convert + "webm"); // конверт в webm, некоторые браузеры не понимают .oga
          convert(settings.convert + "wav"); // для safari 🙁
          res.send("ok!"); // Можно сделать чанки с процессом сonvert и отрисовать их в интерфейсе
        });
      });
  });
});

/// Получаем все партитуры и ссылки на них для прослушивания
/// Что бы прослушать надо открыть страницу через vpn что бы
/// прослушать записи из апи телеги... я рекомендую браузер Opera

/// Используется как wake-up
app.get("/voices", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  // console.log(req.headers);
  res.send("ok!");
});

app.get("/util", (req, res) => {
  // db.run("CREATE TABLE Paritures (id INTEGER PRIMARY KEY AUTOINCREMENT, image TEXT)");
  db.run("UPDATE Voices SET downloaded = 0 WHERE downloaded = 1;");
  res.send("ok!");
});
//SELECT COUNT(*) FROM `table`

// app.get("/stat", (req, res) => {
//   // db.run("CREATE TABLE Paritures (id INTEGER PRIMARY KEY AUTOINCREMENT, image TEXT)");
//   db.run("UPDATE Voices SET downloaded = 0 WHERE downloaded = 1;");
//   res.send("ok!");
// });

// app.get("/create-mix", (req, res) => {
//   let mix = [];
//   db.all(
//     "SELECT * FROM Voices WHERE downloaded !=1 ",
//     // "SELECT * FROM Voices WHERE image IS NOT NULL AND duration < 9 AND downloaded !=1 ",
//     (err, rows) => {
//       if (err) {
//         throw err;
//       }
//       rows.forEach(row => {
//         // telegram.getFileLink(row.voice)
//         //console.log(row.voice);

//         mix.push(row.voice);
//       });
//       mix.forEach((file, index) => {
//         telegram
//           .getFileLink(file)
//           .catch(err => {
//             console.log(err);
//           })
//           .then(voiceLink => {
//             //mixtape.push(`${voiceLink}`)
//             download(voiceLink, `voices/${file}.oga`, () => {
//               fs.appendFile("voices/mix.txt", `file '${file}.oga' \n`, function(
//                 err
//               ) {
//                 if (err) {
//                   // append failed
//                 } else {
//                   db.run(
//                     "UPDATE Voices SET downloaded = 1 WHERE voice = ?;",
//                     file
//                   );
//                   // done
//                   console.log(`save /voices/${file}.oga`);
//                 }
//               });
//             });
//           });
//       });
//       setTimeout(() => {
//         if (
//           fs.existsSync("voices/mix.txt") &&
//           fs.existsSync("public/mixtape.oga")
//         ) {
//           fs.appendFile(
//             "voices/mix.txt",
//             `file 'public/mixtape.oga' \n`,
//             err => {
//               if (err) {
//                 console.log(err);
//               } else {
//                 console.log("add public/mixtape.oga to mix.txt");
//               }
//             }
//           );
//         }
//       }, 10000);
//       if (fs.existsSync("voices/mix.txt")) {
//         setTimeout(() => {
//           convert(
//             "ffmpeg -y -f concat -safe 0 -i voices/mix.txt -c copy public/mixtape.oga"
//           );
//         }, 25000);

//         setTimeout(() => {
//           fs.unlink("voices/mix.txt", function(err) {
//             if (err) throw err;
//             console.log("mix.txt deleted!");
//           });
//         }, 30000);
        
//         setTimeout(() => {
//           convert(
//             "ffmpeg -y -i public/mixtape.oga public/mixtape.wav"
//           );
//         }, 35000);

//         setTimeout(() => {
//           fs.readdirSync("voices/").forEach(file => {
//             fs.unlink(`voices/${file}`, function(err) {
//               if (err) return console.log(err);
//               console.log(`${file} deleted successfully`);
//             });
//           });
//         }, 45000);
//         //
//       }
//       res.json({ mixtape: "/mixtape.oga", sounds: mix });
//     }
//   );
// });
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
