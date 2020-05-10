/* global Howl, SiriWave ,siriWave */

//console.log("hello world :o");

// https://codepen.io/astephannie/pen/NaBKLG
// https://www.youtube.com/watch?v=2O3nm0Nvbi4

const startButton = document.getElementById("play");
const stopButton = document.getElementById("stop");

//https://github.com/kopiro/siriwave
const siriWave = new SiriWave({
  container: document.getElementById("sound-container"),
  width: 640,
  height: 200,
  style: "ios",
  color: "black",
  amplitude: 0
});
siriWave.start();

const status = document.getElementById("status");

//https://github.com/goldfire/howler.js#core
const sound = new Howl({
  src: ["voice.webm", "voice.oga", "voice.wav"],
  format: ["webm", "oga", "wav"],
  onplay: ()=> {
    console.log("Start!");
    siriWave.setAmplitude(0.2);
  },
  onload:()=>{
    status.textContent = sound.state();
  },
  onloaderror:()=>{
    status.textContent = sound.state();
  },
  onend: () => {
    console.log("Finished!");
    siriWave.setAmplitude(0);
  },
  onstop:()=> {
    console.log("stop");
    siriWave.setAmplitude(0);
  },
  onseek:()=> {
    console.log("change");
  }
});


stopButton.onclick = () => {
  if(sound.playing){
    sound.stop();
  }
};

startButton.onclick = () => {
  if(!sound.playing()){
     sound.play();
     startButton.textContent = "pause";
  } 
  if(sound.playing()) {
    sound.pause();
    startButton.textContent = "start";
  }

  
};

// const dreams = [];

// // define variables that reference elements on our page
// const dreamsForm = document.forms[0];
// const dreamInput = dreamsForm.elements["dream"];
// const dreamsList = document.getElementById("dreams");
// const clearButton = document.querySelector('#clear-dreams');

// // request the dreams from our app's sqlite database
// fetch("/getDreams", {})
//   .then(res => res.json())
//   .then(response => {
//     response.forEach(row => {
//       appendNewDream(row.dream);
//     });
//   });

// // a helper function that creates a list item for a given dream
// const appendNewDream = dream => {
//   const newListItem = document.createElement("li");
//   newListItem.innerText = dream;
//   dreamsList.appendChild(newListItem);
// };

// // listen for the form to be submitted and add a new dream when it is
// dreamsForm.onsubmit = event => {
//   // stop our form submission from refreshing the page
//   event.preventDefault();

//   const data = { dream: dreamInput.value };

//   fetch("/addDream", {
//     method: "POST",
//     body: JSON.stringify(data),
//     headers: { "Content-Type": "application/json" }
//   })
//     .then(res => res.json())
//     .then(response => {
//       console.log(JSON.stringify(response));
//     });
//   // get dream value and add it to the list
//   dreams.push(dreamInput.value);
//   appendNewDream(dreamInput.value);

//   // reset form
//   dreamInput.value = "";
//   dreamInput.focus();
// };

// clearButton.addEventListener('click', event => {
//   fetch("/clearDreams", {})
//     .then(res => res.json())
//     .then(response => {
//       console.log("cleared dreams");
//     });
//   dreamsList.innerHTML = "";
// });
