const socket=io();
let roomCode="";
let avatar=["🦊","🐼","🐵","🐸","🦁"][Math.floor(Math.random()*5)];
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
  socket.emit("create_room",{username:name,avatar});
}

function join(){
  const name=document.getElementById("name").value;
  const code=document.getElementById("code").value;
  roomCode=code;
  socket.emit("join_room",{code,username:name,avatar});
}

socket.on("room_created",code=>{
  roomCode=code;
  render(`Room: ${code}<button onclick="start()">Start</button>`);
});

socket.on("room_update",room=>{
  render(`
  Room: ${roomCode}
  <button onclick="start()">Start</button>
  ${room.players.map(p=>`<div class="player">${p.avatar} ${p.username}</div>`).join("")}
  `);
});

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
  #${i+1} ${p.avatar} ${p.username} ${p.score}
  </div>`).join("")}
  <input id="ans"/>
  <button onclick="submit()">Send</button>
  `);
});

socket.on("timer",t=>{
  document.getElementById("timer").innerText=t;
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
      ${p.avatar} ${p.username}: ${data.answers[id]}
      <div class="float">+${data.roundPoints[id]}</div>
    </div>`;
  }).join("")}
  `);
});
