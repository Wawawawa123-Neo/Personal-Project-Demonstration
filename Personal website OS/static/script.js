
// --- 核心数据系统 ---
let userData = { name: "Guest", money: 0, snakeHigh: 0, inventory: [] };
let currentUser = null;

// 定义当前用户信息变量
currentUser = "Guest";
let userRole = "user";

async function systemLogin() {
    const u = document.getElementById('username-input').value;
    const p = document.getElementById('password-input').value;

    if (!u) return alert("请输入用户名");

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        const result = await res.json();

        if (result.status === 'success') {
            // --- 解决 undefined 问题 ---
            // 确保存储后端传回来的 result.name
            currentUser = result.name || u;

            // --- 解决管理员判断问题 ---
            if (result.role === 'admin') {
                adminSystem.isLoggedIn = true;
                console.log("管理员模式已激活");
            } else {
                adminSystem.isLoggedIn = false;
            }

            // 初始化用户数据
            const saved = localStorage.getItem('yg_os_v4_' + currentUser);
            if (saved) {
                userData = JSON.parse(saved);
                userData.name = currentUser; // 强行校准名字
            } else {
                userData = { name: currentUser, money: 100, inventory: [] };
            }

            // 界面切换
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('main-os').style.display = 'flex';

            updateUI(); // 刷新界面（显示余额、名字等）
            if (window.msgBoard) msgBoard.init();
            saveUserData();
        } else {
            // 如果后端返回管理员密码错误，会在这里提示
            alert("登录失败：" + (result.msg || "未知错误"));
        }
    } catch (error) {
        console.error("登录请求出错:", error);
    }
}
function saveUserData() {
    if (!currentUser) return;
    localStorage.setItem('yg_os_v4_' + currentUser, JSON.stringify(userData));
    updateUI();
}

function updateUI() {
    document.getElementById('username-display').innerText = userData.name;
    document.getElementById('dash-name').innerText = userData.name;
    document.getElementById('avatar-display').innerText = userData.name[0].toUpperCase();

    // 更新所有显示金币的地方
    const moneyElements = ['sidebar-money', 'dash-money'];
    moneyElements.forEach(id => {
        if (document.getElementById(id)) document.getElementById(id).innerText = userData.money;
    });

    document.getElementById('dash-items').innerText = userData.inventory.length;

    // 检查商店按钮状态
    checkItemState('slow_potion', 'btn-buy-slow');
    checkItemState('dark_mode', 'btn-buy-dark');
    checkItemState('avatar_skin', 'btn-buy-avatar');
    checkItemState('pendant_star', 'btn-buy-pendant');
    checkItemState('bg_starry', 'btn-buy-starry');

    // 复活币显示数量
    const lives = userData.inventory.filter(i => i === 'extra_life').length;
    const lifeBtn = document.getElementById('btn-buy-life');
    if (lifeBtn) lifeBtn.innerText = `购买 (持有: ${lives})`;

    // 显示 Buff
    const snakeBuffs = document.getElementById('snake-buffs');
    let buffText = "";
    if (userData.inventory.includes('slow_potion')) buffText += "🧪 减速药水生效中 ";
    if (lives > 0) buffText += `💖 复活次数: ${lives}`;
    snakeBuffs.innerText = buffText;

    // 主题按钮状态
    const btnDark = document.getElementById('btnDark');
    if (userData.inventory.includes('dark_mode')) {
        btnDark.disabled = false;
    } else {
        btnDark.disabled = true;
    }
}
async function startDrawing() {
    const btn = document.getElementById('draw-btn');
    const resultDiv = document.getElementById('sd-result');
    const backupContainer = document.getElementById('backup-container');
    const backupLink = document.getElementById('backup-link');

    btn.disabled = true;
    btn.innerText = "🚨 指令已下达...";
    if (backupContainer) backupContainer.style.display = "none"; // 每次开始前先隐藏

    // 1. 进度流监听
    const source = new EventSource('/api/progress');
    source.onmessage = (e) => {
        const d = JSON.parse(e.data);
        if (d.progress) {
            let p = (d.progress * 100).toFixed(0);
            resultDiv.innerHTML = `<div style="color:#00f2ff">⚡ 渲染进度: ${p}% (请勿刷新)</div>`;

            // --- 核心增强：进度 90% 时跳出备份链接 ---
            if (d.progress >= 0.9 && backupContainer) {
                backupContainer.style.display = "block";
                // 此时 fetch 可能还没返回，先给个基于 guest 的默认路径保底

                backupLink.href = `/static/render_${currentUser}.png`;

            }

            // 如果进度到了 1.0 (100%)，即便 fetch 还没返回，也说明 PC 干完活了
            if (d.progress >= 1.0 || d.state === "finished") {
                btn.disabled = false;
                btn.innerText = "🚀 发送渲染指令 (Consume 50 Coins)";
                source.close();
            }
        }
    };
    user_log = session.get('user_name', '访客')
    settings = raw.get('override_settings', {})
    model_name = settings.get('sd_model_checkpoint', '默认模型')

    try {
        // --- 修改后的 script.js 载荷部分 ---
        const payload = {
            "prompt": document.getElementById('sd-prompt').value,

            // 补上负面提示词
            "negative_prompt": document.getElementById('sd-negative').value,

            "steps": parseInt(document.getElementById('sd-steps').value) || 20,
            "width": parseInt(document.getElementById('sd-width').value) || 512,
            "height": parseInt(document.getElementById('sd-height').value) || 512,

            // 建议在 HTML 里加个 id="sd-cfg" 的输入框，如果没有，这里先写死 7
            "cfg_scale": 7.0,

            "sampler_name": document.getElementById('sd-sampler').value,
            "scheduler": document.getElementById('sd-scheduler') ? document.getElementById('sd-scheduler').value : "Automatic",

            "override_settings": {
                "sd_model_checkpoint": document.getElementById('sd-model').value,
                "CLIP_stop_at_last_layers": 2
            }

        };

        const res = await fetch('/api/draw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.images) {
            resultDiv.innerHTML = `<img src="data:image/png;base64,${data.images[0]}" style="width:100%">`;
            // --- 核心增强：拿到后端生成的专属路径后，更新链接 ---
            if (data.local_url && backupLink) {
                backupLink.href = data.local_url + "?t=" + new Date().getTime();
            }
        }
    } catch (err) {
        console.log("主请求可能超时，正在通过进度通道监控...");
        resultDiv.innerHTML = `<div style="color:orange">⚠️ 链路超时，但 GPU 仍在后台工作，请观察进度条...</div>`;
    } finally {
        // 保底逻辑：5秒太短了（渲染要很久），改为 3 分钟保底
        setTimeout(() => {
            if (btn.disabled) {
                btn.disabled = false;
                btn.innerText = "🚀 发送渲染指令 (Consume 50 Coins)";
                source.close();
            }
        }, 180000);
    }
}
function saveCurrentImg(base64) {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64}`;
    link.download = `yuange_ai_${Date.now()}.png`;
    link.click();
}
function switchTab(id) {

    document.querySelectorAll('.window').forEach(w => w.classList.remove('active'));
    document.getElementById(id).classList.add('active');


    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = Array.from(document.querySelectorAll('.menu-btn')).find(btn => btn.getAttribute('onclick').includes(id));
    if (activeBtn) activeBtn.classList.add('active');

    
    snakeGame.running = false;
    breakoutGame.running = false;
    starfallGame.running = false;
    clickerGame.running = false;
    if (document.getElementById('clicker-overlay')) {
        document.getElementById('clicker-overlay').style.display = 'block';
    }
}


function buyItem(itemId, price) {
    if (userData.money >= price) {
       
        if ((itemId === 'slow_potion' || itemId === 'dark_mode' || itemId === 'avatar_skin' || itemId === 'pendant_star' || itemId === 'bg_starry') && userData.inventory.includes(itemId)) {
            alert("你已经拥有这个能力了！");
            return;
        }

        userData.money -= price;
        userData.inventory.push(itemId);
        saveUserData();
        applyInventoryEffects();
        alert("✨ 购买成功！");
    } else {
        alert("❌ 源币不足！快去玩游戏赚钱吧。");
    }
}

function checkItemState(itemId, btnId) {
    const btn = document.getElementById(btnId);
    if (userData.inventory.includes(itemId)) {
        btn.innerText = "已拥有";
        btn.disabled = true;
        btn.style.background = "#888";
    }
}

function applyInventoryEffects() {
    // Avatar皮肤
    const avatar = document.getElementById('avatar-display');
    if (userData.inventory.includes('avatar_skin')) {
        avatar.style.background = "linear-gradient(45deg, #ffd700, #ff8c00)";
        avatar.innerText = "😎";
    } else {
        avatar.style.background = "linear-gradient(45deg, #ff9a9e, #fad0c4)";
        avatar.innerText = userData.name[0].toUpperCase();
    }
    // 挂件显示
    if (userData.inventory.includes('pendant_star')) {
        document.getElementById('pendant').style.display = 'block';
    } else {
        document.getElementById('pendant').style.display = 'none';
    }
    // 星空背景
    if (userData.inventory.includes('bg_starry')) {
        if (!document.body.classList.contains('dark-mode')) {
            document.body.style.animation = 'none';
            document.body.style.background = 'linear-gradient(135deg, #000046 0%, #1CB5E0 100%)';
        }
    } else {
        // 恢复默认背景动画
        document.body.style.background = '';
        document.body.style.animation = '';
    }
}

// --- 存档功能 ---
document.getElementById('btnSaveData').onclick = function () {
    const dataStr = JSON.stringify(userData);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentUser + "_save.json";
    a.click();
    URL.revokeObjectURL(url);
};
document.getElementById('loadFile').onchange = function (event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            userData = data;
            applyInventoryEffects();
            saveUserData();
            alert("存档已加载！");
        } catch (err) {
            alert("加载失败，请选择有效的存档文件。");
        }
    };
    reader.readAsText(file);
};
// --- 主题切换 ---
document.getElementById('btnOriginal').onclick = function () {
    document.body.classList.remove('dark-mode');
    if (userData.inventory.includes('bg_starry')) {
        // 应用星空
        document.body.style.animation = 'none';
        document.body.style.background = 'linear-gradient(135deg, #000046 0%, #1CB5E0 100%)';
    } else {
        // 恢复默认
        document.body.style.background = '';
        document.body.style.animation = 'gradientBG 15s ease infinite';
    }
};
document.getElementById('btnDark').onclick = function () {
    if (userData.inventory.includes('dark_mode')) {
        document.body.classList.add('dark-mode');
        // 如果有星空背景则清除
        document.body.style.background = '';
        document.body.style.animation = '';
    }
}; const mazeGame = {
    canvas: document.getElementById('mazeCanvas'),
    ctx: document.getElementById('mazeCanvas').getContext('2d'),
    cols: 15, rows: 15, size: 25, px: 0, py: 0, grid: [],
    start: function () {
        this.px = 0; this.py = 0;
        this.generateSolveableMaze();
        this.draw();
        if (!this.bound) {
            window.addEventListener("keydown", (e) => this.move(e));
            this.bound = true;
        }
    },
    generateSolveableMaze: function () {
        // 初始化全是墙
        this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(1));
        const stack = [[0, 0]];
        this.grid[0][0] = 0;
        // 深度优先遍历算法，确保路径打通
        while (stack.length > 0) {
            const [x, y] = stack[stack.length - 1];
            const neighbors = [[x + 2, y], [x - 2, y], [x, y + 2], [x, y - 2]].filter(([nx, ny]) =>
                nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows && this.grid[ny][nx] === 1);
            if (neighbors.length > 0) {
                const [nx, ny] = neighbors[Math.floor(Math.random() * neighbors.length)];
                this.grid[ny][nx] = 0;
                this.grid[y + (ny - y) / 2][x + (nx - x) / 2] = 0; // 打通中间的墙
                stack.push([nx, ny]);
            } else stack.pop();
        }
        this.grid[this.rows - 1][this.cols - 1] = 0; // 确保终点是通的
    },
    draw: function () {
        const ctx = this.ctx; ctx.clearRect(0, 0, 400, 400);
        for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
            ctx.fillStyle = this.grid[y][x] ? "#222" : "rgba(255,255,255,0.1)";
            ctx.fillRect(x * this.size, y * this.size, this.size - 1, this.size - 1);
        }
        ctx.fillStyle = "red"; ctx.fillRect(this.px * this.size + 5, this.py * this.size + 5, 15, 15);
        ctx.fillStyle = "#0f0"; ctx.fillRect((this.cols - 1) * this.size + 5, (this.rows - 1) * this.size + 5, 15, 15);
    },
    move: function (e) {
        if (!document.getElementById('maze-game').classList.contains('active')) return;
        let dx = 0, dy = 0;
        if (e.key === 'w' || e.key === 'ArrowUp') dy = -1;
        if (e.key === 's' || e.key === 'ArrowDown') dy = 1;
        if (e.key === 'a' || e.key === 'ArrowLeft') dx = -1;
        if (e.key === 'd' || e.key === 'ArrowRight') dx = 1;
        if (this.grid[this.py + dy]?.[this.px + dx] === 0) {
            this.px += dx; this.py += dy;
            if (this.px === this.cols - 1 && this.py === this.rows - 1) {
                alert("破解成功！获得30源币"); userData.money += 30; updateUI(); this.start();
            }
            this.draw();
        }
    }
};
const audioManager = {
    audio: document.getElementById('bgm-audio'),
    btn: document.getElementById('play-btn'),

    toggle: function () {
        if (this.audio.paused) {
            // 浏览器要求播放前必须有用户交互
            this.audio.play().then(() => {
                this.btn.innerText = "⏸️";
                console.log("卡农开始播放");
            }).catch(err => {
                console.error("播放受阻:", err);
                alert("请先点击页面任意位置，再开启音乐。");
            });
        } else {
            this.audio.pause();
            this.btn.innerText = "▶️";
        }
    },

    setVolume: function (val) {
        this.audio.volume = val;
    }
};

// 自动更新UI：如果音乐播完了（虽然设置了loop），重置图标
document.getElementById('bgm-audio').onended = () => {
    audioManager.btn.innerText = "▶️";
};

// --- 新游戏: 星尘捕手  ---
const starfallGame = {
    canvas: document.getElementById('starfallCanvas'),
    ctx: document.getElementById('starfallCanvas').getContext('2d'),
    player: { x: 275, w: 50, h: 50 },
    stars: [],
    score: 0,
    running: false,

    start: function () {
        if (this.running) return;
        this.running = true;
        this.score = 0;
        this.stars = [];
        document.getElementById('star-score').innerText = 0;
        document.getElementById('starfall-overlay').style.display = 'none';
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.move(-1);
            if (e.key === 'ArrowRight') this.move(1);
        });
        this.loop();
    },

    move: function (dir) {
        this.player.x += dir * 40;
        if (this.player.x < 0) this.player.x = 0;
        if (this.player.x > this.canvas.width - this.player.w) this.player.x = this.canvas.width - this.player.w;
    },

    loop: function () {
        if (!starfallGame.running) return;
        requestAnimationFrame(starfallGame.loop);

        const ctx = starfallGame.ctx;
        const cvs = starfallGame.canvas;

        // 背景
        ctx.clearRect(0, 0, cvs.width, cvs.height);

        // 生成星星/陨石
        if (Math.random() < 0.03) {
            starfallGame.stars.push({
                x: Math.random() * (cvs.width - 20),
                y: -20,
                type: Math.random() > 0.8 ? 'rock' : 'star',
                speed: Math.random() * 2 + 2
            });
        }

        // 绘制玩家 (篮子)
        ctx.fillStyle = '#fff';
        ctx.font = "40px Arial";
        ctx.fillText("🧺", starfallGame.player.x, cvs.height - 10);

        // 更新物体
        for (let i = 0; i < starfallGame.stars.length; i++) {
            let s = starfallGame.stars[i];
            s.y += s.speed;

            // 绘制
            ctx.font = "24px Arial";
            ctx.fillText(s.type === 'star' ? "⭐" : "🌑", s.x, s.y);

            // 碰撞检测
            if (s.y > cvs.height - 50 && s.y < cvs.height && s.x > starfallGame.player.x - 10 && s.x < starfallGame.player.x + 50) {
                if (s.type === 'star') {
                    starfallGame.score += 10;
                    userData.money += 10;
                } else {
                    starfallGame.score -= 50;
                    userData.money = Math.max(0, userData.money - 50);
                    starfallGame.running = false;
                    alert("被陨石砸中了！游戏结束。");
                    document.getElementById('starfall-overlay').style.display = 'block';
                }
                saveUserData();
                document.getElementById('star-score').innerText = starfallGame.score;
                starfallGame.stars.splice(i, 1);
                i--;
                continue;
            }

            if (s.y > cvs.height) {
                starfallGame.stars.splice(i, 1);
                i--;
            }
        }
    }
};
function loadUserData(username) {
    try {
        const raw = localStorage.getItem('yg_os_v4_' + username);
        if (raw) {
            const parsed = JSON.parse(raw);
            // 轻度验证
            userData = Object.assign({ name: username, money: 0, snakeHigh: 0, inventory: [] }, parsed);
        } else {
            userData = { name: username, money: 0, snakeHigh: 0, inventory: [] };
        }
    } catch (e) {
        console.error("载入存档失败，使用默认数据：", e);
        userData = { name: username, money: 0, snakeHigh: 0, inventory: [] };
    }
    currentUser = username;
    updateUI();
}

const hackGame = {
    output: document.getElementById('terminal-output'),
    input: document.getElementById('terminal-input'),
    isAIActive: false,
    files: {
        "log.txt": "错误日志: 用户 'admin' 登录失败。系统生成的临时密钥为: 8842",
        "hint.cfg": "安全提示: 所有的解锁指令必须以 'unlock' 开头。",
        "secret.dat": "这里只有一些乱码，去看看 log.txt 吧。"
    },

    init: function () {
        this.input.onkeydown = (e) => {
            if (e.key === "Enter") {
                const cmd = this.input.value.trim();
                if (!cmd) return;
                this.print("> " + cmd);
                this.input.value = "";
                this.process(cmd);
            }
        };
        this.print("已连接到远程服务器... 输入 'ls' 查看文件，'unlock 8842' 破解。");
    },

    print: function (text) {
        const div = document.createElement("div");
        div.style.marginBottom = "5px";
        div.innerHTML = text;
        this.output.appendChild(div);
        this.output.scrollTop = this.output.scrollHeight;
    },

    process: function (cmd) {
        const lowerCmd = cmd.toLowerCase();
        if (this.isAIActive) {
            this.fetchAI(cmd);
            return;
        }
        if (lowerCmd === "ls") {
            this.print(Object.keys(this.files).join("  "));
        } else if (lowerCmd.startsWith("cat ")) {
            const fileName = lowerCmd.split(" ")[1];
            this.print(this.files[fileName] || "文件不存在。");
        } else if (lowerCmd === "unlock 8842") {
            this.unlockSequence();
        } else {
            this.print("未知指令: " + cmd);
        }
    },

    unlockSequence: function () {
       
        this.output.classList.add('terminal-alert-red');
        this.print("<span class='access-granted'>>>> [ACCESS GRANTED] <<<</span>");
        this.print("<span class='terminal-error'>[CRITICAL] 检测到外部意识流强行介入...</span>");

        setTimeout(() => {
           
            this.output.classList.remove('terminal-alert-red');
            this.print("<br><span class='stewie-tag'>[SYSTEM AI]</span>: <span style='color:#0f0'>Vile human! 你以为你能逃出 Matrix？</span>");
            this.isAIActive = true;
        }, 2000);

        if (typeof userData !== 'undefined') {
            userData.money += 100;
            saveUserData(); updateUI();
        }
    },

    fetchAI: async function (msg) {
        const lineId = "stewie-" + Date.now();
        this.print(`<span class='stewie-tag'>[SYSTEM AI]</span><span id="${lineId}"></span>`);
        const target = document.getElementById(lineId);

        try {
            const res = await fetch('/api/ai_chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg })
            });

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                target.innerText += decoder.decode(value, { stream: true });
                this.output.scrollTop = this.output.scrollHeight;
            }
        } catch (e) {
            this.print("<span class='terminal-error'>[ERROR] 链路中断。</span>");
        }
    }
};

hackGame.init();
const adminSystem = {
    isLoggedIn: false,
    deleteMsg: async function (index) {
        if (!confirm("确定要删除这条留言吗？")) return;
        try {
            const res = await fetch('/api/messages/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ index: index })
            });
            const data = await res.json();
            if (data.status === 'success') {
                msgBoard.fetchMessages(); 
            } else {
                alert(data.message || "删除失败");
            }
        } catch (e) {
            alert("请求失败，请检查权限");
        }
    }
};



// --- 节奏点击逻辑 ---
const rhythmGame = {
    track: document.getElementById('rhythm-track'),
    combo: 0,
    running: false,
    timer: null,
    audioCtx: new (window.AudioContext || window.webkitAudioContext)(),

    // 播放清脆的打击音
    playPop: function () {
        const osc = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        osc.connect(g); g.connect(this.audioCtx.destination);
        // 随机一个清脆的高音
        osc.frequency.setValueAtTime(800 + Math.random() * 400, this.audioCtx.currentTime);
        g.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.05);
        osc.start(); osc.stop(this.audioCtx.currentTime + 0.05);
    },

    start: function () {
        if (this.running) return;
        this.running = true;
        this.combo = 0;
        document.getElementById('rhythm-combo').innerText = "0";
        this.spawnLoop();
    },

    spawnLoop: function () {
        if (!this.running || !document.getElementById('rhythm-game').classList.contains('active')) {
            this.running = false; return;
        }

        this.createNote();
        
        setTimeout(() => this.spawnLoop(), 800);
    },

    createNote: function () {
        const note = document.createElement('div');
        // 样式设置
        Object.assign(note.style, {
            position: 'absolute',
            left: '0px',
            top: '80px',
            width: '40px',
            height: '40px',
            background: 'radial-gradient(circle, #fff, #4facfe)',
            borderRadius: '50%',
            boxShadow: '0 0 15px #4facfe',
            cursor: 'pointer',
            transition: 'left 2s linear', // 2秒走完全程，速度很慢很稳
            zIndex: '5'
        });

        this.track.appendChild(note);

        // 启动动画：让它飞向右侧
        setTimeout(() => { note.style.left = '110%'; }, 20);

        // 点击判定
        note.onmousedown = (e) => {
            e.stopPropagation();
            const rect = note.getBoundingClientRect();
            const trackRect = this.track.getBoundingClientRect();
            const hitX = rect.left - trackRect.left;
            this.hit(note);
        };

        // 如果没点中，到时间自动消失
        setTimeout(() => {
            if (note.parentNode) {
                note.remove();
                this.miss();
            }
        }, 2100);
    },

    hit: function (note) {
        this.combo++;
        this.playPop();
        userData.money += 5;
        updateUI();
        document.getElementById('rhythm-combo').innerText = this.combo;

        // 爆炸特效
        note.style.transform = 'scale(2)';
        note.style.opacity = '0';
        setTimeout(() => note.remove(), 100);

        // 显示 Perfect!
        const pText = document.getElementById('perfect-text');
        pText.style.display = 'block';
        setTimeout(() => pText.style.display = 'none', 300);
    },

    miss: function () {
        this.combo = 0;
        document.getElementById('rhythm-combo').innerText = "0";
    }
};
const msgBoard = {
    list: [],
    api: '/api/messages',
    timer: null, // 闹钟变量

    // 1. 初始化
    init: async function () {
        console.log("留言板实时系统启动...");
        await this.fetchMessages();
        // 关键：每 5 秒自动拉取一次
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => this.fetchMessages(), 5000);
    },

    // 2. 核心：获取数据
    fetchMessages: async function () {
        try {
            const response = await fetch(this.api + '?t=' + new Date().getTime());
            const newList = await response.json();

            // --- 关键修改点 ---
            // 满足以下任意一个条件就重新渲染：
            // 1. 留言数量变了
            // 2. 或者是为了确保管理员登录后能立刻看到删除键，我们添加一个状态记录
            if (newList.length !== this.list.length || this.lastAdminStatus !== adminSystem.isLoggedIn) {
                this.list = newList;
                this.lastAdminStatus = adminSystem.isLoggedIn; // 记录当前的管理员状态
                this.render();
                console.log("同步成功，界面已更新");
            }
        } catch (err) {
            console.error("同步失败:", err);
        }
    },

    // 3. 发送留言
    post: async function () {
        const input = document.getElementById('msg-input');
        const content = input.value.trim();
        if (!content) return;

        const newMsg = {
            user: currentUser || "访客", // 修改这里，使用全局变量 currentUser
            content: content,
            time: new Date().toLocaleString()
        };

        try {
            const response = await fetch(this.api, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newMsg)
            });

            if (response.ok) {
                input.value = "";
                // 发完后立刻手动刷一次，不等那5秒
                await this.fetchMessages();
            }
        } catch (err) {
            alert("无法连接到树莓派，请检查网络");
        }
    },


    // 4. 渲染界面
    render: function () {
        const container = document.getElementById('msg-list');
        // 为避免修改原数组，先复制并反转用于显示（最新在前）
        const displayList = this.list.slice().reverse();

        container.innerHTML = displayList.map((m, displayIdx) => {
            // 计算原数组中的索引，便于发送到后端删除时使用正确 index
            const originalIndex = this.list.length - 1 - displayIdx;
            return `
        <div class="glass-panel" style="padding:15px; margin-bottom:10px; position:relative;">
            <strong style="color:#fc6076;">${m.user}</strong>
            <small style="opacity:0.6; margin-left:10px;">${m.time}</small>
            <p style="margin:10px 0 0 0;">${m.content}</p>
            ${(adminSystem.isLoggedIn) ? `<button class="delete-btn" onclick="adminSystem.deleteMsg(${originalIndex})">删除</button>` : ''}
        </div>`;
        }).join('');
    }

};

// 确保在页面加载后只调用一次 init
document.addEventListener('DOMContentLoaded', () => {
    msgBoard.init();
});

function toggleNavGroup(header) {
    // 找到当前标题下的内容体
    const body = header.nextElementSibling;
    // 切换 active 类
    const isActive = body.classList.contains('active');

    // 如果你想让其他组自动关闭，可以取消下面这两行的注释
    // document.querySelectorAll('.group-body').forEach(b => b.classList.remove('active'));

    if (!isActive) {
        body.classList.add('active');
    } else {
        body.classList.remove('active');
    }
}

// --- 游戏: 贪吃蛇 (支持道具) ---
const snakeGame = {
    canvas: document.getElementById('snakeCanvas'),
    ctx: document.getElementById('snakeCanvas').getContext('2d'),
    grid: 20, count: 0,
    snake: { x: 160, y: 160, dx: 20, dy: 0, cells: [], maxCells: 4 },
    apple: { x: 320, y: 320 },
    running: false, score: 0,

    start: function () {
        if (this.running) return;
        this.running = true;
        this.snake = { x: 160, y: 160, dx: 20, dy: 0, cells: [], maxCells: 4 };
        this.score = 0;
        document.getElementById('snake-score').innerText = 0;
        document.addEventListener('keydown', this.handleInput);
        this.loop();
    },

    handleInput: function (e) {
        const s = snakeGame.snake;
        if (e.which === 37 && s.dx === 0) { s.dx = -20; s.dy = 0; }
        else if (e.which === 38 && s.dy === 0) { s.dy = -20; s.dx = 0; }
        else if (e.which === 39 && s.dx === 0) { s.dx = 20; s.dy = 0; }
        else if (e.which === 40 && s.dy === 0) { s.dy = 20; s.dx = 0; }
    },

    loop: function () {
        if (!snakeGame.running) return;
        requestAnimationFrame(snakeGame.loop);

        // 道具效果：减速药水 (正常速度是 8，药水后变成 12)
        const speed = userData.inventory.includes('slow_potion') ? 12 : 8;
        if (++snakeGame.count < speed) return;
        snakeGame.count = 0;

        const ctx = snakeGame.ctx;
        const cvs = snakeGame.canvas;
        const s = snakeGame.snake;

        ctx.clearRect(0, 0, cvs.width, cvs.height);

        s.x += s.dx; s.y += s.dy;
        if (s.x < 0) s.x = cvs.width - snakeGame.grid;
        else if (s.x >= cvs.width) s.x = 0;
        if (s.y < 0) s.y = cvs.height - snakeGame.grid;
        else if (s.y >= cvs.height) s.y = 0;

        s.cells.unshift({ x: s.x, y: s.y });
        if (s.cells.length > s.maxCells) s.cells.pop();

        ctx.fillStyle = '#ff66b3';
        ctx.fillRect(snakeGame.apple.x, snakeGame.apple.y, snakeGame.grid - 1, snakeGame.grid - 1);

        ctx.fillStyle = '#00f2fe';
        s.cells.forEach(function (cell, index) {
            ctx.fillRect(cell.x, cell.y, snakeGame.grid - 1, snakeGame.grid - 1);
            if (cell.x === snakeGame.apple.x && cell.y === snakeGame.apple.y) {
                s.maxCells++;
                snakeGame.score += 10;
                userData.money += 5; // 吃苹果赚钱
                saveUserData();
                document.getElementById('snake-score').innerText = snakeGame.score;
                snakeGame.apple.x = Math.floor(Math.random() * (cvs.width / snakeGame.grid)) * snakeGame.grid;
                snakeGame.apple.y = Math.floor(Math.random() * (cvs.height / snakeGame.grid)) * snakeGame.grid;
            }
            for (let i = index + 1; i < s.cells.length; i++) {
                if (cell.x === s.cells[i].x && cell.y === s.cells[i].y) {
                    // 道具效果：复活
                    const lifeIdx = userData.inventory.indexOf('extra_life');
                    if (lifeIdx > -1) {
                        userData.inventory.splice(lifeIdx, 1); // 消耗复活币
                        s.cells.pop(); // 移除尾巴避免再次碰撞
                        saveUserData();
                        updateUI();
                        alert("💖 复活之心生效！你复活了！");
                    } else {
                        snakeGame.running = false;
                        alert("游戏结束");
                    }
                }
            }
        });
    }
};

// --- 游戏: 打砖块---
const breakoutGame = {
    canvas: document.getElementById('breakoutCanvas'),
    ctx: document.getElementById('breakoutCanvas').getContext('2d'),
    ball: { x: 300, y: 350, dx: 3, dy: -3, radius: 8 },
    paddle: { x: 250, width: 100, height: 12 },
    bricks: [],
    rowCount: 4,
    colCount: 6,
    brickW: 80,
    brickH: 25,
    padding: 15,
    offsetTop: 40,
    offsetLeft: 35,
    running: false,
    score: 0,
    rightPressed: false, // 监听按键状态
    leftPressed: false,

    init: function () {
        // 绑定键盘事件
        document.addEventListener("keydown", (e) => {
            if (e.key === "Right" || e.key === "ArrowRight") this.rightPressed = true;
            else if (e.key === "Left" || e.key === "ArrowLeft") this.leftPressed = true;
        }, false);
        document.addEventListener("keyup", (e) => {
            if (e.key === "Right" || e.key === "ArrowRight") this.rightPressed = false;
            else if (e.key === "Left" || e.key === "ArrowLeft") this.leftPressed = false;
        }, false);
    },

    start: function () {
        if (this.running) return;
        if (this.bricks.length === 0) this.init(); // 确保只初始化一次监听

        // 重置砖块
        this.bricks = [];
        for (let c = 0; c < this.colCount; c++) {
            this.bricks[c] = [];
            for (let r = 0; r < this.rowCount; r++) {
                this.bricks[c][r] = { x: 0, y: 0, status: 1 };
            }
        }

        this.score = 0;
        this.ball = { x: 300, y: 350, dx: 3, dy: -3, radius: 8 };
        this.paddle.x = (this.canvas.width - this.paddle.width) / 2;
        this.running = true;
        document.getElementById('breakout-score').innerText = "0";
        this.loop();
    },

    // 供手机端按钮调用
    moveLeft: function () { this.paddle.x = Math.max(0, this.paddle.x - 50); },
    moveRight: function () { this.paddle.x = Math.min(this.canvas.width - this.paddle.width, this.paddle.x + 50); },

    loop: function () {
        if (!this.running) return;

        // 1. 处理板子平滑移动
        if (this.rightPressed) {
            this.paddle.x = Math.min(this.canvas.width - this.paddle.width, this.paddle.x + 7);
        } else if (this.leftPressed) {
            this.paddle.x = Math.max(0, this.paddle.x - 7);
        }

        const ctx = this.ctx;
        const cvs = this.canvas;
        ctx.clearRect(0, 0, cvs.width, cvs.height);

        // 2. 绘制砖块
        for (let c = 0; c < this.colCount; c++) {
            for (let r = 0; r < this.rowCount; r++) {
                let b = this.bricks[c][r];
                if (b.status === 1) {
                    let brickX = (c * (this.brickW + this.padding)) + this.offsetLeft;
                    let brickY = (r * (this.brickH + this.padding)) + this.offsetTop;
                    b.x = brickX; b.y = brickY;
                    ctx.fillStyle = `hsl(${r * 45 + 180}, 70%, 60%)`;
                    ctx.beginPath();
                    ctx.roundRect(brickX, brickY, this.brickW, this.brickH, 4);
                    ctx.fill();

                    // 砖块碰撞检测
                    if (this.ball.x > brickX && this.ball.x < brickX + this.brickW &&
                        this.ball.y > brickY && this.ball.y < brickY + this.brickH) {
                        this.ball.dy = -this.ball.dy;
                        b.status = 0;
                        this.score += 20;
                        userData.money += 5;
                        saveUserData();
                        document.getElementById('breakout-score').innerText = this.score;
                    }
                }
            }
        }

        // 3. 绘制球
        ctx.beginPath();
        ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();

        // 4. 绘制挡板
        ctx.fillStyle = "#4facfe";
        ctx.beginPath();
        ctx.roundRect(this.paddle.x, cvs.height - 20, this.paddle.width, this.paddle.height, 10);
        ctx.fill();

        // 5. 边界检测
        if (this.ball.x + this.ball.dx > cvs.width - this.ball.radius || this.ball.x + this.ball.dx < this.ball.radius) {
            this.ball.dx = -this.ball.dx;
        }
        if (this.ball.y + this.ball.dy < this.ball.radius) {
            this.ball.dy = -this.ball.dy;
        } else if (this.ball.y + this.ball.dy > cvs.height - 20) {
            if (this.ball.x > this.paddle.x && this.ball.x < this.paddle.x + this.paddle.width) {
                this.ball.dy = -this.ball.dy;
                // 增加一点反弹角度变化（可选）
                this.ball.dx = 8 * ((this.ball.x - (this.paddle.x + this.paddle.width / 2)) / this.paddle.width);
            } else if (this.ball.y > cvs.height) {
                this.running = false;
                alert("游戏结束！");
            }
        }

        this.ball.x += this.ball.dx;
        this.ball.y += this.ball.dy;

        requestAnimationFrame(() => this.loop());
    }
};

// --- 新游戏: 点击之星 ---
const clickerGame = {
    canvas: document.getElementById('clickerCanvas'),
    ctx: document.getElementById('clickerCanvas').getContext('2d'),
    star: null,
    lastSpawn: 0,
    score: 0,
    running: false,

    start: function () {
        if (this.running) return;
        this.running = true;
        this.score = 0;
        this.star = null;
        document.getElementById('clicker-score').innerText = 0;
        document.getElementById('clicker-overlay').style.display = 'none';
        this.lastSpawn = 0;
        this.ctx.font = "30px Arial";
        this.canvas.removeEventListener('click', this.handleClick);
        this.canvas.addEventListener('click', this.handleClick);
        this.loop(performance.now());
    },

    handleClick: function (e) {
        if (!clickerGame.star) return;
        const rect = clickerGame.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const dx = x - clickerGame.star.x;
        const dy = y - clickerGame.star.y;
        if (dx * dx + dy * dy < 900) { // 半径30
            clickerGame.score += 10;
            userData.money += 10;
            saveUserData();
            document.getElementById('clicker-score').innerText = clickerGame.score;
            clickerGame.star = null;
        }
    },

    loop: function (timestamp) {
        if (!clickerGame.running) return;
        requestAnimationFrame(clickerGame.loop);

        const now = performance.now();
        // 产生星星
        if (!clickerGame.star) {
            clickerGame.star = {
                x: Math.random() * (clickerGame.canvas.width - 60) + 30,
                y: Math.random() * (clickerGame.canvas.height - 60) + 30
            };
            clickerGame.lastSpawn = now;
        }
        // 超时则消失
        if (clickerGame.star && now - clickerGame.lastSpawn > 1000) {
            clickerGame.star = null;
        }

        clickerGame.ctx.clearRect(0, 0, clickerGame.canvas.width, clickerGame.canvas.height);
        if (clickerGame.star) {
            clickerGame.ctx.fillText("⭐", clickerGame.star.x, clickerGame.star.y);
        }
    }
};
msgBoard.init();
