import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

let state = {
  turn: 0,
  selected: {} as Record<string, string>,
  direction: 1,
  onlineUsers: 0,
};

const sockets = new Set<WebSocket>();

serve((req) => {
  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      state.onlineUsers++;
      sockets.add(socket);
      broadcastOnlineCount();
      socket.send(JSON.stringify({ type: "state", state }));
    };

    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "update") {
        state = { ...state, ...data.state };
        sockets.forEach((s) => {
          if (s.readyState === WebSocket.OPEN) {
            s.send(JSON.stringify({ type: "state", state }));
          }
        });
      }
    };

    socket.onclose = () => {
      state.onlineUsers--;
      sockets.delete(socket);
      broadcastOnlineCount();
    };

    return response;
  }

  return new Response(frontendHTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}, { port: Deno.env.get("PORT") ? Number(Deno.env.get("PORT")) : 8000 });

function broadcastOnlineCount() {
  sockets.forEach((s) => {
    if (s.readyState === WebSocket.OPEN) {
      s.send(JSON.stringify({ type: "onlineCount", count: state.onlineUsers }));
    }
  });
}

const frontendHTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>班级实时选人系统</title>
<style>
  *{box-sizing:border-box;font-family:Arial,sans-serif}
  body{max-width:1000px;margin:0 auto;padding:20px;background:#f5f7fa}
  h1,h2{text-align:center}
  .online-count{text-align:center;font-size:18px;font-weight:bold;color:#0d6efd;margin-bottom:10px}
  .box{background:white;padding:20px;border-radius:12px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
  .leaders{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
  .leader{padding:10px 16px;border-radius:8px;background:#e3f2fd;font-weight:bold}
  .now{background:#0d6efd;color:white}
  .users{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-top:10px}
  .user{padding:10px;background:#eee;border-radius:6px;text-align:center;cursor:pointer}
  .user.selected{background:#ccc;text-decoration:line-through;pointer-events:none}
  .tip{text-align:center;color:#666}
</style>
</head>
<body>

<div class="online-count" id="online_count">当前在线：0人</div>

<h1>班级分组选人系统</h1>
<p class="tip">实时同步｜7位组长｜蛇形顺序</p>

<div class="box">
  <h2>当前轮到：<span id="current_leader"></span></h2>
  <div id="leader_list" class="leaders"></div>
</div>

<div class="box">
  <h2>候选人</h2>
  <div id="user_list" class="users"></div>
</div>

<script>
const leaders = ["1","2","3","4","5","6","7"];
const users = [
"胡嘉慧","李金柳","梁丽雯","廖庆烨","梁爽","苏雯慧","杨惠婷",
"陈杜娟","陈桦婷","邓吉定","范莉莉","甘微微","甘志青",
"黄春策","黄庆烽","黄绍恒","黄永棣","黄雨珊","黄梓煜",
"梁芳铭","陆桂永","李佳庆","刘嘉睿","李康","李明智",
"刘芮伶","梁诗彤","梁天佑","李彤宇","李文昊","梁馨日",
"梁雨馨","陆昭焯","陆竹风","缪礼涛","农璋翔","陶冠华",
"覃裕善","吴慧婷","韦金广","韦嘉烨","韦亮","韦烁华",
"韦云凌","谢天龙","谢钰华","杨思涵","周芳泽","周俊宇"
];

let state = {
  turn: 0,
  selected: {},
  direction: 1,
  onlineUsers: 0
};

const ws = new WebSocket(\`wss://\${window.location.host}\`);
ws.onopen = () => {};
ws.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if(data.type === 'state') {
    state = { ...state, ...data.state };
    render();
  }
  if(data.type === 'onlineCount') {
    state.onlineUsers = data.count;
    renderOnlineCount();
  }
};

function renderOnlineCount() {
  document.getElementById('online_count').innerText = \`当前在线：\${state.onlineUsers}人\`;
}

function render(){
  renderOnlineCount();
  document.getElementById('current_leader').innerText = leaders[state.turn];
  
  const leaderEl = document.getElementById('leader_list');
  leaderEl.innerHTML = '';
  leaders.forEach((n,i)=>{
    const div = document.createElement('div');
    div.className = 'leader ' + (i===state.turn?'now':'');
    div.innerText = n;
    leaderEl.appendChild(div);
  });

  const userEl = document.getElementById('user_list');
  userEl.innerHTML = '';
  users.forEach(name=>{
    const div = document.createElement('div');
    const sel = !!state.selected[name];
    div.className = 'user ' + (sel?'selected':'');
    div.innerText = name;
    if(!sel) div.onclick = pick;
    userEl.appendChild(div);
  });
}

function pick(e){
  const name = e.target.innerText;
  if(state.selected[name]) return;
  state.selected[name] = leaders[state.turn];
  
  state.turn += state.direction;
  if(state.turn >= leaders.length){
    state.direction = -1;
    state.turn = leaders.length-1;
  }else if(state.turn < 0){
    state.direction = 1;
    state.turn = 0;
  }

  ws.send(JSON.stringify({type:'update', state: {
    turn: state.turn,
    selected: state.selected,
    direction: state.direction
  }}));
  render();
}

render();
</script>
</body>
</html>
`;
