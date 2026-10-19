const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const victoryScreen = document.getElementById('victory-screen');
const hud = document.getElementById('hud');
const hpValue = document.getElementById('hp-value');
const timeValue = document.getElementById('time-value');
const subtitle = document.getElementById('subtitle');
const debugBtn = document.getElementById('debug-btn');

if (subtitle) {
    const normalText = "The man who speaks in hands awaits...";
    const wingdingsText = "❄︎☟︎☜︎ ✞︎⚐︎✋︎👎︎ 👍︎⚐︎☠︎💧︎🕆︎💣︎☜︎💧︎ ✌︎☹︎☹︎"; 
    
    setInterval(() => {
        if (!gameActive && Math.random() < 0.3) {
            subtitle.style.fontFamily = "Wingdings, sans-serif";
            subtitle.innerText = wingdingsText;
            
            setTimeout(() => {
                subtitle.style.fontFamily = "'Courier New', Courier, monospace";
                subtitle.innerText = normalText;
            }, 100 + Math.random() * 300);
        }
    }, 1000);
}

let gameActive = false;
let animationId;
let projectiles = [];
let warnings = [];
let maxHp = 5; 
let currentHp = maxHp;
let totalHits = 0;
let debugMode = false;

// --- Debug Toggle Logic ---
function toggleDebug() {
    debugMode = !debugMode;
    if (debugBtn) {
        debugBtn.innerText = `Debug Mode: ${debugMode ? 'ON' : 'OFF'}`;
        debugBtn.style.color = debugMode ? '#00ffcc' : '#ffffff';
        debugBtn.style.borderColor = debugMode ? '#00ffcc' : '#ffffff';
    }
}

if (debugBtn) {
    debugBtn.addEventListener('click', toggleDebug);
}

const bgMusic = new Audio('Dark-Darker-Yet-Darker-Remix.mp3');
let nextAttackIndex = 0;
const songLength = 240; 

const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 10, 
    visualSize: 14,
    speed: 7, 
    color: '#ff0044',
    dashCooldown: 0,
    dashDistance: 160, 
    invulnerable: 0,
    trails: [] 
};

const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false, ' ': false };

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
    if (e.key === '`' || e.key === '~') toggleDebug(); 
});
window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('home-btn').addEventListener('click', () => location.reload());

function startGame() {
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    victoryScreen.classList.add('hidden');
    hud.classList.remove('hidden');

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.trails = [];
    currentHp = maxHp;
    hpValue.innerText = currentHp;
    
    projectiles = [];
    warnings = [];
    nextAttackIndex = 0;
    totalHits = 0;
    gameActive = true;

    bgMusic.currentTime = 0;
    bgMusic.play().catch(e => console.log("Audio blocked:", e));

    updateLoop();
}

// --- Attack Library ---

function spawnWarningLaser(x, y, w, h, delay = 400, duration = 20) {
    warnings.push({ x, y, w, h, life: delay / 16, maxLife: delay / 16, type: 'laser' });
    setTimeout(() => {
        if (gameActive) projectiles.push({ x, y, w, h, dx: 0, dy: 0, life: duration, type: 'laser' });
    }, delay); 
}

function spawnWarningRing(x, y, count, speed, delay = 600) { 
    warnings.push({ x, y, w: 40, h: 40, life: delay / 16, maxLife: delay / 16, type: 'ring' });
    setTimeout(() => {
        if (gameActive) spawnRing(x, y, count, speed);
    }, delay);
}

// NEW: Pre-calculates the gap, draws the warning, then spawns the wall
function spawnWarningSweeper(direction, speed, safeZoneSize, delay = 500) {
    let gapStart = Math.random() * ( (direction === 'horizontal' ? canvas.height : canvas.width) - safeZoneSize - 100) + 50;

    if (direction === 'horizontal') {
        warnings.push({ x: 0, y: 0, w: canvas.width, h: gapStart, life: delay/16, maxLife: delay/16, type: 'laser' });
        warnings.push({ x: 0, y: gapStart + safeZoneSize, w: canvas.width, h: canvas.height, life: delay/16, maxLife: delay/16, type: 'laser' });
    } else {
        warnings.push({ x: 0, y: 0, w: gapStart, h: canvas.height, life: delay/16, maxLife: delay/16, type: 'laser' });
        warnings.push({ x: gapStart + safeZoneSize, y: 0, w: canvas.width, h: canvas.height, life: delay/16, maxLife: delay/16, type: 'laser' });
    }

    setTimeout(() => {
        if (gameActive) {
            if (direction === 'horizontal') {
                let startX = speed > 0 ? -50 : canvas.width + 50;
                projectiles.push({ x: startX, y: 0, w: 40, h: gapStart, dx: speed, dy: 0, life: 400, type: 'wall' });
                projectiles.push({ x: startX, y: gapStart + safeZoneSize, w: 40, h: canvas.height, dx: speed, dy: 0, life: 400, type: 'wall' });
            } else {
                let startY = speed > 0 ? -50 : canvas.height + 50;
                projectiles.push({ x: 0, y: startY, w: gapStart, h: 40, dx: 0, dy: speed, life: 400, type: 'wall' });
                projectiles.push({ x: gapStart + safeZoneSize, y: startY, w: canvas.width, h: 40, dx: 0, dy: speed, life: 400, type: 'wall' });
            }
        }
    }, delay);
}

function spawnAimedBurst(count, speed, spread = 0.5) {
    let edge = Math.floor(Math.random() * 4);
    let startX, startY;
    if (edge === 0) { startX = Math.random() * canvas.width; startY = -50; } 
    else if (edge === 1) { startX = canvas.width + 50; startY = Math.random() * canvas.height; } 
    else if (edge === 2) { startX = Math.random() * canvas.width; startY = canvas.height + 50; } 
    else { startX = -50; startY = Math.random() * canvas.height; } 
    
    for (let i = 0; i < count; i++) {
        let angle = Math.atan2(player.y - startY, player.x - startX);
        angle += (Math.random() - 0.5) * spread;
        let dx = Math.cos(angle) * speed;
        let dy = Math.sin(angle) * speed;
        projectiles.push({ 
            x: startX, y: startY, w: 10, h: 10, dx, dy, life: 400, type: 'bullet' 
        });
    }
}

function spawnRing(x, y, count, speed) {
    for (let i = 0; i < count; i++) {
        let angle = (Math.PI * 2 / count) * i;
        let dx = Math.cos(angle) * speed;
        let dy = Math.sin(angle) * speed;
        projectiles.push({ x, y, w: 12, h: 12, dx, dy, life: 400, type: 'bullet' });
    }
}

function spawnBulletHell(density, speed) {
    for (let i = 0; i < density; i++) {
        let x = Math.random() * canvas.width;
        let y = -20 - Math.random() * 100;
        let dx = (Math.random() - 0.5) * 4;
        let dy = speed + Math.random() * 4;
        projectiles.push({ x, y, w: 9, h: 9, dx, dy, life: 500, type: 'bullet' });
    }
}

// --- Extreme Gaster/ULB Difficulty Timeline ---
function generateTimeline() {
    let seq = [];
    
    for (let t = 2; t < 30; t += 1.5) {
        seq.push({ time: t, action: () => spawnAimedBurst(8, 9, 0.6) });
        if (t % 3 === 0) seq.push({ time: t + 0.5, action: () => spawnWarningRing(canvas.width / 2, canvas.height / 2, 20, 6) });
        if (t % 4 === 0) seq.push({ time: t, action: () => spawnWarningLaser(player.x - 20, 0, 40, canvas.height, 400, 15) }); 
    }

    for (let t = 30; t < 60; t += 2) {
        seq.push({ time: t, action: () => spawnWarningSweeper('horizontal', 12, 65) }); 
        seq.push({ time: t + 1, action: () => spawnWarningSweeper('vertical', 12, 65) });
        seq.push({ time: t + 1.5, action: () => spawnAimedBurst(3, 11, 0.2) }); 
    }

    for (let t = 60; t < 100; t += 0.8) { 
        seq.push({ time: t, action: () => spawnBulletHell(18, 8) });
        if (t % 2 === 0) seq.push({ time: t, action: () => spawnWarningRing(player.x, player.y, 24, 7) });
        if (t % 2.5 === 0) seq.push({ time: t, action: () => spawnAimedBurst(10, 10, 0.8) });
    }

    for (let t = 100; t < 140; t += 1.5) {
        seq.push({ time: t, action: () => {
            spawnWarningLaser(Math.random() * canvas.width, 0, 150, canvas.height, 350, 15);
            spawnWarningLaser(0, Math.random() * canvas.height, canvas.width, 150, 350, 15);
        }});
        seq.push({ time: t + 0.5, action: () => spawnWarningSweeper(Math.random() > 0.5 ? 'horizontal' : 'vertical', 14, 80) });
    }

    for (let t = 140; t < 180; t += 2) {
        seq.push({ time: t, action: () => {
            spawnWarningLaser(0, 0, canvas.width / 2 - 50, canvas.height, 500, 25);
            spawnWarningLaser(canvas.width / 2 + 50, 0, canvas.width / 2, canvas.height, 500, 25);
        }});
        seq.push({ time: t + 1, action: () => spawnAimedBurst(15, 12, 1.2) });
    }

    for (let t = 180; t < 220; t += 1) {
        seq.push({ time: t, action: () => spawnBulletHell(25, 9) }); 
        if (t % 1.5 === 0) seq.push({ time: t, action: () => spawnWarningLaser(player.x - 30, 0, 60, canvas.height, 300, 10) }); 
        if (t % 2 === 0) seq.push({ time: t + 0.5, action: () => spawnWarningSweeper('horizontal', 15, 60) });
    }

    for (let t = 220; t < 238; t += 0.4) { 
        seq.push({ time: t, action: () => spawnAimedBurst(5, 15, 0.4) });
        if (t % 1.2 === 0) seq.push({ time: t, action: () => spawnWarningRing(canvas.width / 2, canvas.height / 2, 40, 10) });
        if (t % 2 === 0) seq.push({ time: t, action: () => {
            spawnWarningLaser(Math.random() * canvas.width, 0, 200, canvas.height, 400, 20);
            spawnWarningLaser(0, Math.random() * canvas.height, canvas.width, 200, 400, 20);
        }});
    }

    return seq.sort((a, b) => a.time - b.time);
}

const gasterSequence = generateTimeline();

function executeAttacks(time) {
    while (nextAttackIndex < gasterSequence.length && time >= gasterSequence[nextAttackIndex].time) {
        gasterSequence[nextAttackIndex].action();
        nextAttackIndex++;
    }
}

function updateLoop() {
    if (!gameActive) return;

    let currentTime = bgMusic.currentTime;
    timeValue.innerText = Math.floor(currentTime / 60) + ":" + (Math.floor(currentTime % 60)).toString().padStart(2, '0');

    if (currentTime >= songLength) {
        gameWon();
        return;
    }

    executeAttacks(currentTime);

    let dx = 0;
    let dy = 0;

    if (keys.w || keys.ArrowUp) dy -= 1;
    if (keys.s || keys.ArrowDown) dy += 1;
    if (keys.a || keys.ArrowLeft) dx -= 1;
    if (keys.d || keys.ArrowRight) dx += 1;

    if (dx !== 0 && dy !== 0) {
        let length = Math.sqrt(dx * dx + dy * dy);
        dx /= length;
        dy /= length;
    }

    if (keys[' '] && player.dashCooldown === 0 && (dx !== 0 || dy !== 0)) {
        player.trails.push({ x: player.x, y: player.y, targetX: player.x + dx * player.dashDistance, targetY: player.y + dy * player.dashDistance, life: 12 });
        player.x += dx * player.dashDistance;
        player.y += dy * player.dashDistance;
        player.dashCooldown = 30; 
        player.invulnerable = 15; 
    } else {
        player.x += dx * player.speed;
        player.y += dy * player.speed;
    }

    if (player.dashCooldown > 0) player.dashCooldown--;
    if (player.invulnerable > 0) player.invulnerable--;
    
    player.trails.forEach(t => t.life--);
    player.trails = player.trails.filter(t => t.life > 0);

    player.x = Math.max(player.visualSize / 2, Math.min(canvas.width - player.visualSize / 2, player.x));
    player.y = Math.max(player.visualSize / 2, Math.min(canvas.height - player.visualSize / 2, player.y));

    warnings.forEach(w => w.life--);
    warnings = warnings.filter(w => w.life > 0);

    projectiles.forEach(p => {
        p.x += p.dx;
        p.y += p.dy;
        p.life--;

        if (player.invulnerable === 0 && 
            player.x - player.size/2 < (p.type === 'laser' || p.type === 'wall' ? p.x + p.w : p.x + p.w/2) &&
            player.x + player.size/2 > (p.type === 'laser' || p.type === 'wall' ? p.x : p.x - p.w/2) &&
            player.y - player.size/2 < (p.type === 'laser' || p.type === 'wall' ? p.y + p.h : p.y + p.h/2) &&
            player.y + player.size/2 > (p.type === 'laser' || p.type === 'wall' ? p.y : p.y - p.h/2)) {
            
            takeDamage();
        }
    });
    
    projectiles = projectiles.filter(p => p.life > 0 && 
        (p.type === 'laser' || p.x > -100 && p.x < canvas.width + 100 && p.y > -100 && p.y < canvas.height + 100)
    );

    draw();
    animationId = requestAnimationFrame(updateLoop);
}

function takeDamage() {
    totalHits++; 
    if (!debugMode) {
        currentHp--;
        hpValue.innerText = currentHp;
    }
    player.invulnerable = 60; 
    if (currentHp <= 0 && !debugMode) gameOver();
}

function gameOver() {
    gameActive = false;
    bgMusic.pause();
    cancelAnimationFrame(animationId);
    gameOverScreen.classList.remove('hidden');
    hud.classList.add('hidden');
}

function gameWon() {
    gameActive = false;
    bgMusic.pause();
    cancelAnimationFrame(animationId);
    victoryScreen.classList.remove('hidden');
    hud.classList.add('hidden');
}

function draw() {
    ctx.fillStyle = 'rgba(5, 5, 5, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.shadowBlur = 15;

    warnings.forEach(w => {
        ctx.shadowColor = '#8800ff';
        if (w.type === 'laser') {
            ctx.fillStyle = `rgba(136, 0, 255, ${w.life / w.maxLife * 0.5})`; 
            ctx.fillRect(w.x, w.y, w.w, w.h);
        } else if (w.type === 'ring') {
            ctx.fillStyle = `rgba(136, 0, 255, ${w.life / w.maxLife * 0.5})`; 
            ctx.beginPath();
            ctx.arc(w.x, w.y, w.w, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    projectiles.forEach(p => {
        if (p.type === 'laser' || p.type === 'wall') {
            ctx.shadowColor = p.type === 'laser' ? '#ffffff' : '#aa00ff';
            ctx.fillStyle = p.type === 'laser' ? '#ffffff' : '#aa00ff';
            ctx.fillRect(p.x, p.y, p.w, p.h);
        } else {
            ctx.shadowColor = '#aa00ff';
            ctx.fillStyle = '#aa00ff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.w, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff0044';
    player.trails.forEach(t => {
        ctx.strokeStyle = `rgba(255, 0, 68, ${t.life / 12})`;
        ctx.lineWidth = player.visualSize;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.targetX, t.targetY);
        ctx.stroke();
    });

    if (player.invulnerable % 6 < 3) { 
        ctx.shadowColor = player.color;
        ctx.fillStyle = player.color;
        ctx.fillRect(player.x - player.visualSize / 2, player.y - player.visualSize / 2, player.visualSize, player.visualSize);
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(player.x - player.visualSize / 4, player.y - player.visualSize / 4, player.visualSize / 2, player.visualSize / 2);
    }
    ctx.shadowBlur = 0;

    if (debugMode) {
        ctx.fillStyle = '#00ffcc'; 
        ctx.font = 'bold 20px "Courier New", Courier, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`[DEBUG MODE ACTIVE] HITS TAKEN: ${totalHits} | TIME: ${timeValue.innerText} \vert{} ENTITIES:${projectiles.length}`, 20, canvas.height - 30);
        ctx.font = '14px "Courier New", Courier, monospace';
        ctx.fillText(`Press backtick (\`) to toggle debug mode. HP will not drain while active.`, 20, canvas.height - 10);
    }
}
