const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

const AVATARS = ["🦊","🐼","🐵","🐸","🦁","🐯","🐨","🐰","🐻","🦄"];

const WORDS = [
  "CAT","DOG","SUN","MOON","CAR","STAR","TREE","BALL","BOOK","FISH",
  "RIVER","FLOWER","ORANGE","PURPLE","HUNGER","MARKET"
];

function generateRoomCode(){
  return Math.random().toString(36).substring(2,8).toUpperCase();
}

function pickWord(room){
  const available = WORDS.filter(w=>!room.usedWords.includes(w));
  if(available.length===0){
    room.usedWords=[];
    return pickWord(room);
  }
  const word=available[Math.floor(Math.random()*available.length)];
  room.usedWords.push(word);
  return word;
}

function getAlive(room){
  return room.players.filter(p=>!p.eliminated);
}

function startRound(code){
  const room=rooms[code];
  if(!room) return;

  room.phase="rhyme";
  room.answers={};
  room.timeLeft=20;

  room.players.forEach(p=>p.isChuck=false);

  const alive=getAlive(room);
  const chuck=alive[Math.floor(Math.random()*alive.length)];
  chuck.isChuck=true;
  room.chuckId=chuck.id;

  room.currentWord=pickWord(room);

  io.to(code).emit("phase",room);
  startTimer(code);
}

function startTimer(code){
  const room=rooms[code];
  if(room.timer) clearInterval(room.timer);

  room.timer=setInterval(()=>{
    room.timeLeft--;
    io.to(code).emit("timer",room.timeLeft);

    if(room.timeLeft<=0){
      clearInterval(room.timer);
      finishRound(code);
    }
  },1000);
}

function finishRound(code){
  const room=rooms[code];
  if(!room) return;

  const groups={};
  const roundPoints={};

  room.players.forEach(p=>{
    roundPoints[p.id]=0;
    if(!p.streak) p.streak=0;
  });

  for(let id in room.answers){
    const ans=room.answers[id];
    if(!groups[ans]) groups[ans]=[];
    groups[ans].push(id);
  }

  Object.values(groups).forEach(group=>{

    if(group.length===1){
      const p=room.players.find(x=>x.id===group[0]);
      p.streak=0;

      if(room.mode==="survival"){
        p.lives--;
        if(p.lives<=0) p.eliminated=true;
      }

      return;
    }

    group.forEach(id=>{
      const p=room.players.find(x=>x.id===id);
      let gained=(group.length===2)?3:1;

      if(group.length>=3)
        gained=Math.floor(gained*1.5);

      if(id===room.chuckId)
        gained+=(group.length-1);

      p.streak++;
      if(p.streak>=2) gained+=1;

      p.score+=gained;
      roundPoints[id]+=gained;
    });
  });

  room.players.sort((a,b)=>b.score-a.score);

  io.to(code).emit("reveal",{
    word:room.currentWord,
    answers:room.answers,
    players:room.players,
    roundPoints
  });

  setTimeout(()=>handleModeEnd(code),4000);
}

function handleModeEnd(code){
  const room=rooms[code];
  if(!room) return;

  // POINTS MODE
  if(room.mode==="points"){
    const winner=room.players.find(p=>p.score>=20);
    if(winner) return endGame(code);
  }

  // ROUNDS MODE
  if(room.mode==="rounds"){
    if(room.currentRound>=room.maxRounds)
      return endGame(code);
  }

  // SURVIVAL MODE
  if(room.mode==="survival"){
    const alive=getAlive(room);
    if(alive.length<=1)
      return endGame(code);
  }

  room.currentRound++;
  startRound(code);
}

function endGame(code){
  const room=rooms[code];
  if(!room) return;

  io.to(code).emit("game_end",{
    players:room.players
  });
}

io.on("connection",socket=>{

  socket.on("create_room",({username,avatar})=>{
    const code=generateRoomCode();

    rooms[code]={
      players:[],
      usedWords:[],
      currentRound:1,
      mode:"points",
      maxRounds:5
    };

    socket.join(code);

    rooms[code].players.push({
      id:socket.id,
      username,
      avatar:avatar||AVATARS[Math.floor(Math.random()*AVATARS.length)],
      score:0,
      streak:0,
      lives:5,
      eliminated:false
    });

    socket.emit("room_created",code);
    io.to(code).emit("room_update",rooms[code]);
  });

  socket.on("join_room",({code,username,avatar})=>{
    const room=rooms[code];
    if(!room) return;

    socket.join(code);

    room.players.push({
      id:socket.id,
      username,
      avatar:avatar||AVATARS[Math.floor(Math.random()*AVATARS.length)],
      score:0,
      streak:0,
      lives:5,
      eliminated:false
    });

    io.to(code).emit("room_update",room);
  });

  socket.on("set_mode",({code,mode,rounds})=>{
    const room=rooms[code];
    if(!room) return;

    room.mode=mode;
    if(mode==="rounds")
      room.maxRounds=parseInt(rounds)||5;

    io.to(code).emit("room_update",room);
  });

  socket.on("start_game",({code})=>{
    startRound(code);
  });

  socket.on("submit_answer",({code,answer})=>{
    const room=rooms[code];
    if(!room) return;

    if(room.answers[socket.id]) return;

    room.answers[socket.id]=answer.trim().toUpperCase();

    const alive=getAlive(room).length;

    if(Object.keys(room.answers).length===alive){
      clearInterval(room.timer);
      finishRound(code);
    }
  });

});

server.listen(3000,()=>console.log("Running on 3000"));
