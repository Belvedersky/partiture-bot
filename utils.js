const https = require("https");
const fs = require("fs");
const child_process = require("child_process");

// download file -> fuck rkn
const download = function(url, dest, cb) {
  var file = fs.createWriteStream(dest);
  var request = https
    .get(url, function(response) {
      response.pipe(file);
      file.on("finish", function() {
        file.close(cb); // close() is async, call cb after close completes.
      });
    })
    .on("error", function(err) {
      // Handle errors
      fs.unlink(dest); // Delete the file async. (But we don't check the result)
      if (cb) cb(err.message);
    });
};
exports.download = download;

// convert to usefull format
const convert = command => {
  child_process.exec(command, function(error, stdout, stderr) {
    if (error) {
      throw error;
    }
    //console.log("done");
    console.log("stdout: " + stdout);
    console.log(stderr);
  });
};
exports.convert = convert;

const randomImage = (i) => {
  return Math.floor(Math.random() * i);
}
exports.randomImage = randomImage;
