import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// 服务器端硬编码的组长和候选人列表（必须与前端一致）
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

// 初始状态
let state = {
  turn: 0,
  selected: {} as Record<string, string>,
  direction: 1,
};

let onlineUsers = 0;
const sockets = new Set<WebSocket>();

// 广播当前状态给所有客户端
function broadcastState() {
  const message = JSON.stringify({ type: "state", state });
  sockets.forEach((s) => {
    if (s.readyState === WebSocket.OPEN) {
      s.send(message);
    }
  });
}

// 广播在线人数
function broadcastOnlineCount() {
  const message = JSON.stringify({ type: "onlineCount", count: onlineUsers });
  sockets.forEach((s) => {
    if (s.readyState === WebSocket.OPEN) {
      s.send(message);
    }
  });
}

serve((req) => {
  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      onlineUsers++;
      sockets.add(socket);
      broadcastOnlineCount();
      socket.send(JSON.stringify({ type: "state", state })); // 发送当前状态
    };

    socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "pick") {
          const name = data.name;

          // 验证候选人是否有效且未被选中
          if (name && users.includes(name) && !state.selected[name]) {
            const leader = leaders[state.turn];
            state.selected[name] = leader;

            // 蛇形算法：计算下一个组长位置
            let nextTurn = state.turn + state.direction;
            if (nextTurn < 0 || nextTurn >= leaders.length) {
              state.direction *= -1; // 反向
              nextTurn = state.turn + state.direction; // 重新计算（方向已变）
            }
            state.turn = nextTurn;

            // 广播更新后的状态
            broadcastState();
          } else {
            // 无效操作：可能是重复选人或名字不在列表中，通知客户端回滚
            socket.send(JSON.stringify({ type: "state", state }));
          }
        }
      } catch (err) {
        console.error("Invalid message:", err);
      }
    };

    socket.onclose = () => {
      onlineUsers--;
      sockets.delete(socket);
      broadcastOnlineCount();
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    return response;
  }

  return new Response(frontendHTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}, { port: Deno.env.get("PORT") ? Number(Deno.env.get("PORT")) : 8000 });

// 前端 HTML（已修正）
const frontendHTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>班级实时选人系统（修正版）</title>
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
  direction: 1
};
let onlineUsers = 0;

// 动态选择 WebSocket 协议 (支持 HTTP/HTTPS)
const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
let ws;

function connect() {
  ws = new WebSocket(\`\${wsProtocol}//\${location.host}\`);

  ws.onopen = () => {
    console.log('WebSocket 已连接');
  };

  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'state') {
      state = data.state;
      render();
    }
    if (data.type === 'onlineCount') {
      onlineUsers = data.count;
      renderOnlineCount();
    }
  };

  ws.onclose = () => {
    console.log('WebSocket 断开，3秒后重连...');
    setTimeout(connect, 3000);
  };

  ws.onerror = (err) => {
    console.error('WebSocket 错误:', err);
  };
}

connect();

function renderOnlineCount() {
  document.getElementById('online_count').innerText = \`当前在线：\${onlineUsers}人\`;
}

function render(){
  renderOnlineCount();
  document.getElementById('current_leader').innerText = leaders[state.turn];
  
  // 渲染组长列表
  const leaderEl = document.getElementById('leader_list');
  leaderEl.innerHTML = '';
  leaders.forEach((n, i) => {
    const div = document.createElement('div');
    div.className = 'leader ' + (i === state.turn ? 'now' : '');
    div.innerText = n;
    leaderEl.appendChild(div);
  });

  // 渲染候选人列表
  const userEl = document.getElementById('user_list');
  userEl.innerHTML = '';
  users.forEach(name => {
    const div = document.createElement('div');
    const isSelected = !!state.selected[name];
    div.className = 'user ' + (isSelected ? 'selected' : '');
    div.innerText = name;
    if (!isSelected) {
      div.onclick = () => pick(name); // 绑定点击事件
    }
    userEl.appendChild(div);
  });
}

// 选人操作：只发送名字，由服务器统一更新状态
function pick(name) {
  if (state.selected[name]) return; // 本地再次检查（防抖）
  ws.send(JSON.stringify({ type: 'pick', name }));
}

render();
</script>
</body>
</html>
`;
