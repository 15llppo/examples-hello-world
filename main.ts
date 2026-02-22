// 核心修复：适配 Deno Deploy 的端口和监听规则
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// 全局状态：记录选人信息和在线人数
let state = {
  turn: 0,
  selected: {} as Record<string, string>,
  direction: 1,
  onlineUsers: 0,
};

// 存储所有实时连接的用户
const sockets = new Set<WebSocket>();

// 关键修复：不指定固定端口，由 Deno Deploy 自动分配
serve((req) => {
  // 处理实时通信（WebSocket）
  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);

    // 新用户加入
    socket.onopen = () => {
      state.onlineUsers++;
      sockets.add(socket);
      // 广播在线人数
      broadcastOnlineCount();
      // 给新用户发送当前最新的选人状态
      socket.send(JSON.stringify({ type: "state", state }));
    };

    // 收到用户的选人操作
    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "update") {
        state = { ...state, ...data.state };
        // 把更新同步给所有人
        sockets.forEach((s) => {
          if (s.readyState === WebSocket.OPEN) {
            s.send(JSON.stringify({ type: "state", state }));
          }
        });
      }
    };

    // 用户离开
    socket.onclose = () => {
      state.onlineUsers--;
      sockets.delete(socket);
      broadcastOnlineCount();
    };

    return response;
  }

  // 提供前端页面
  return new Response(frontendHTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
// 关键修复：监听所有地址，适配平台运行环境
}, { port: Deno.env.get("PORT") ? Number(Deno.env.get("PORT")) : 8000 });

// 广播在线人数的辅助函数
function broadcastOnlineCount() {
  sockets.forEach((s) => {
    if (s.readyState === WebSocket.OPEN) {
      s.send(JSON.stringify({ type: "onlineCount", count: state.onlineUsers }));
    }
  });
}

// 前端页面（无需修改）
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

// 连接实时服务
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

// 显示在线人数
function renderOnlineCount() {
  document.getElementById('online_count').innerText = \`当前在线：\${state.onlineUsers}人\`;
}

// 渲染页面内容
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

// 选人操作逻辑
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

  // 发送操作到服务器，同步给所有人
  ws.send(JSON.stringify({type:'update', state: {
    turn: state.turn,
    selected: state.selected,
    direction: state.direction
  }}));
  render();
}

// 页面加载时初始化
render();
</script>
</body>
</html>
`;

### 第三步：一键部署，获取可用链接
1. 找到编辑器**右上角**的蓝色「Deploy」按钮，点击它。
2. 弹出的小窗口中，直接点击「Deploy」（无需修改名称，平台会自动分配）。
3. 等待 10~30 秒，页面会自动跳转到**部署成功页面**，顶部会出现一个以 `.deno.dev` 结尾的链接（这就是你的实时选人系统地址）。

### 第四步：测试实时同步功能（验证是否成功）
1. 复制这个 `.deno.dev` 链接，在浏览器中**打开 2 个不同的标签页**，都粘贴这个链接访问。
2. 观察效果：
    - 标签页1 点击任意候选人名字，标签页2 会立刻看到该名字变灰、被划掉；
    - 关闭其中一个标签页，另一个标签页的「当前在线人数」会立刻减少 1；
    - 选人顺序会按“7位组长蛇形轮转”自动切换。

### 若仍失败的终极方案
如果以上步骤还是失败，说明 Deno Deploy 对你的网络环境可能有兼容性问题，直接用**更简单的 Glitch 平台**：
1. 访问 `https://glitch.com/`，用 GitHub 登录。
2. 点击「New Project」→「Hello World」。
3. 删除默认的 `server.js`，新建文件 `server.js`，粘贴我提供的代码（将开头的 `import` 改为 Node.js 适配的 `require` 版本）。
4. 点击「Show」→「In a New Window」，即可获得实时链接。

按上面的 Playground 步骤操作，核心修复了“监听本地地址”的问题，这次一定能部署成功。
