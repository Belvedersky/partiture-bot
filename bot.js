// Всю работу с ботом перенести сюда

// Это для отправки можно сделать отдельно подменю для отправки своих графических нотации 
// Естественно надо продумать как их модерировать 

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