const socket=io();
let roomCode="";
let submitted=false;

const app=document.getElementById("app");

function render(html){
  app.innerHTML=html;
}

render(`
<input id="name" placeholder="Username"/>
<button onclick="host()">Host</button>
<input id="code" placeholder="Room Code"/>
<button onclick="join()">Join</button>
`);

function host(){
  const name=document.getElementById("name").value;
  socket.emit("create_room",{username:name});
}

function join(){
  const name=document.getElementById("name").value;
  const code=document.getElementById("code").value;
  roomCode=code;
  socket.emit("join_room",{code,username:name});
}

socket.on("room_created",code=>{
  roomCode=code;
});

socket.on("room_update",room=>{
  render(`
  <h3>Room: ${roomCode}</h3>

  <button onclick="setMode('points')">Points</button>
  <button onclick="setMode('rounds')">Rounds</button>
  <button onclick="setMode('survival')">Survival</button>

  ${room.mode==="rounds"?`
    <input id="roundInput" placeholder="Rounds (5)"/>
  `:""}

  <br><br>
  <button onclick="start()">Start</button>
  <hr>

  ${room.players.map(p=>`
    <div class="player">
      ${p.username}
      ${room.mode==="survival" ? `| ❤️ ${p.lives}`:""}
    </div>
  `).join("")}
  `);
});

function setMode(mode){
  let rounds=5;
  if(mode==="rounds"){
    rounds=document.getElementById("roundInput")?.value||5;
  }
  socket.emit("set_mode",{code:roomCode,mode,rounds});
}

function start(){
  socket.emit("start_game",{code:roomCode});
}

socket.on("phase",room=>{
  submitted=false;
  render(`
  <h2>${room.currentWord}</h2>
  <div id="timer">${room.timeLeft}</div>
  ${room.players.map((p,i)=>`
    <div class="player ${p.isChuck?"chuck":""}">
    #${i+1} ${p.username} ${p.score}
    </div>
  `).join("")}
  <input id="ans"/>
  <button onclick="submit()">Send</button>
  `);
});

socket.on("timer",t=>{
  const el=document.getElementById("timer");
  if(el) el.innerText=t;
});

function submit(){
  if(submitted) return;
  const val=document.getElementById("ans").value;
  socket.emit("submit_answer",{code:roomCode,answer:val});
  submitted=true;
  document.getElementById("ans").disabled=true;
}

socket.on("reveal",data=>{
  render(`
  <h2>${data.word}</h2>
  ${Object.keys(data.answers).map(id=>{
    const p=data.players.find(x=>x.id===id);
    return `<div style="position:relative;">
      ${p.username}: ${data.answers[id]}
      <div class="float">+${data.roundPoints[id]}</div>
    </div>`;
  }).join("")}
  `);
});

socket.on("game_end",data=>{
  render(`
  <h2>Game Over</h2>
  ${data.players.map(p=>`
    <div>${p.username} - ${p.score}</div>
  `).join("")}
  <button onclick="location.reload()">Restart</button>
  `);
});
