import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// 全局状态：记录当前轮到谁、谁被选中、在线人数
let state = {
  turn: 0,
  selected: {} as Record<string, string>,
  direction: 1,
  onlineUsers: 0,
};

// 存储所有连接的 WebSocket
const sockets = new Set<WebSocket>();

// 启动 HTTP 服务
serve((req) => {
  // 处理 WebSocket 连接升级
  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);

    // 新连接建立时
    socket.onopen = () => {
      state.onlineUsers++;
      sockets.add(socket);
      broadcastOnlineCount();
      // 把当前状态发给新用户
      socket.send(JSON.stringify({ type: "state", state }));
    };

    // 收到客户端消息时
    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "update") {
        // 更新全局状态
        state = { ...state, ...data.state };
        // 把新状态广播给所有人
        sockets.forEach((s) => {
          if (s.readyState === WebSocket.OPEN) {
            s.send(JSON.stringify({ type: "state", state }));
          }
        });
      }
    };

    // 连接关闭时
    socket.onclose = () => {
      state.onlineUsers--;
      sockets.delete(socket);
      broadcastOnlineCount();
    };

    return response;
  }

  // 提供前端 HTML 页面
  return new Response(frontendHTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

// 广播在线人数给所有连接
function broadcastOnlineCount() {
  sockets.forEach((s) => {
    if (s.readyState === WebSocket.OPEN) {
      s.send(JSON.stringify({ type: "onlineCount", count: state.onlineUsers }));
    }
  });
}

// 前端页面代码
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

// 连接到 WebSocket
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

// 更新在线人数显示
function renderOnlineCount() {
  document.getElementById('online_count').innerText = \`当前在线：\${state.onlineUsers}人\`;
}

// 渲染整个页面
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

// 点击选人时的逻辑
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

  // 把更新发送给服务器
  ws.send(JSON.stringify({type:'update', state: {
    turn: state.turn,
    selected: state.selected,
    direction: state.direction
  }}));
  render();
}

// 初始渲染
render();
</script>
</body>
</html>
`;
