const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Fullscreen Canvas Setup ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- UI Elements & Glitch Effect ---
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const victoryScreen = document.getElementById('victory-screen');
const hud = document.getElementById('hud');
const hpValue = document.getElementById('hp-value');
const timeValue = document.getElementById('time-value');
const subtitle = document.getElementById('subtitle');

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

// --- Game State & Debug ---
let gameActive = false;
let animationId;
let projectiles = [];
let warnings = [];
let maxHp = 5; // Increased slightly for the 4-minute gauntlet
let currentHp = maxHp;
let totalHits = 0;
let debugMode = false; 

// --- Audio & Timeline Engine ---
const bgMusic = new Audio('Dark-Darker-Yet-Darker-Remix.mp3');
let nextAttackIndex = 0;
const songLength = 240; // 4 minutes

// --- Player Object (Neon-Evasion Red Square Soul) ---
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 12, // Extremely tight hitbox for bullet hell
    visualSize: 14,
    speed: 6.5,
    color: '#ff0044', // Neon Red
    dashCooldown: 0,
    dashDistance: 160, // Instant teleport distance
    invulnerable: 0,
    trails: [] // Stores dash visual effects
};

// --- Controls ---
const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false, ' ': false };

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
    if (e.key === '`' || e.key === '~') debugMode = !debugMode; // Toggle debug with tilde/backtick
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

// --- Neon-Evasion Style Attack Library ---

function spawnWarningLaser(x, y, w, h, delay = 500, duration = 45) {
    warnings.push({ x, y, w, h, life: delay / 16, maxLife: delay / 16 });
    setTimeout(() => {
        if (gameActive) projectiles.push({ x, y, w, h, dx: 0, dy: 0, life: duration, type: 'laser' });
    }, delay); 
}

function spawnAimedBurst(count, speed, spread = 0.5) {
    for (let i = 0; i < count; i++) {
        let angle = Math.atan2(player.y - (canvas.height / 2), player.x - (canvas.width / 2));
        angle += (Math.random() - 0.5) * spread; // Slight randomization
        let dx = Math.cos(angle) * speed;
        let dy = Math.sin(angle) * speed;
        projectiles.push({ 
            x: canvas.width / 2, 
            y: canvas.height / 2, 
            w: 10, h: 10, dx, dy, life: 300, type: 'bullet' 
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

function spawnSweeper(direction, speed, safeZoneSize) {
    let gapStart = Math.random() * ( (direction === 'horizontal' ? canvas.height : canvas.width) - safeZoneSize - 100) + 50;
    
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

function spawnBulletHell(density, speed) {
    for (let i = 0; i < density; i++) {
        let x = Math.random() * canvas.width;
        let y = -20 - Math.random() * 100;
        let dx = (Math.random() - 0.5) * 2;
        let dy = speed + Math.random() * 2;
        projectiles.push({ x, y, w: 8, h: 8, dx, dy, life: 500, type: 'bullet' });
    }
}

// --- Generative Attack Timeline (Full 4 Minutes) ---
function generateTimeline() {
    let seq = [];
    
    // Phase 1: Intro (0s - 30s)
    for (let t = 2; t < 30; t += 2) {
        seq.push({ time: t, action: () => spawnAimedBurst(5, 7, 0.4) });
        if (t % 4 === 0) seq.push({ time: t + 0.5, action: () => spawnRing(canvas.width / 2, canvas.height / 2, 12, 5) });
    }

    // Phase 2: The Grid (30s - 60s)
    for (let t = 30; t < 60; t += 3) {
        seq.push({ time: t, action: () => spawnSweeper('horizontal', 8, 120) });
        seq.push({ time: t + 1.5, action: () => spawnSweeper('vertical', 8, 120) });
        seq.push({ time: t + 2, action: () => spawnWarningLaser(0, player.y - 40, canvas.width, 80, 600, 30) });
    }

    // Phase 3: Bullet Hell Barrage (60s - 100s)
    for (let t = 60; t < 100; t += 1) {
        if (t % 2 === 0) seq.push({ time: t, action: () => spawnBulletHell(10, 6) });
        if (t % 3 === 0) seq.push({ time: t, action: () => spawnAimedBurst(8, 9, 0.2) });
        if (t % 5 === 0) seq.push({ time: t, action: () => spawnRing(player.x, player.y, 16, 6) });
    }

    // Phase 4: Claustrophobia - Tight Corridors (100s - 140s)
    for (let t = 100; t < 140; t += 4) {
        seq.push({ time: t, action: () => spawnSweeper('horizontal', 12, 80) }); // Faster, tighter
        seq.push({ time: t + 1, action: () => spawnSweeper('horizontal', -12, 80) });
        seq.push({ time: t + 2, action: () => spawnSweeper('vertical', 12, 80) });
        seq.push({ time: t + 3, action: () => spawnSweeper('vertical', -12, 80) });
        seq.push({ time: t + 3.5, action: () => spawnAimedBurst(1, 15, 0) }); // Fast sniper shot
    }

    // Phase 5: Laser Chaos (140s - 180s)
    for (let t = 140; t < 180; t += 2) {
        seq.push({ time: t, action: () => {
            spawnWarningLaser(Math.random() * canvas.width, 0, 100, canvas.height, 400, 20);
            spawnWarningLaser(0, Math.random() * canvas.height, canvas.width, 100, 400, 20);
        }});
        if (t % 4 === 0) seq.push({ time: t + 1, action: () => spawnRing(canvas.width/2, canvas.height/2, 24, 7) });
    }

    // Phase 6: Maximum Overdrive (180s - 220s)
    for (let t = 180; t < 220; t += 1.5) {
        seq.push({ time: t, action: () => spawnBulletHell(15, 8) });
        seq.push({ time: t + 0.5, action: () => spawnSweeper(Math.random() > 0.5 ? 'horizontal' : 'vertical', 10, 100) });
        seq.push({ time: t + 1.0, action: () => spawnWarningLaser(0, player.y - 50, canvas.width, 100, 300, 15) }); // Instant tracking lasers
    }

    // Phase 7: The Final Squeeze (220s - 240s)
    for (let t = 220; t < 238; t += 0.5) {
        seq.push({ time: t, action: () => spawnAimedBurst(3, 12, 0.3) });
        if (t % 2 === 0) seq.push({ time: t, action: () => spawnRing(canvas.width / 2, canvas.height / 2, 30, 9) });
        if (t % 4 === 0) seq.push({ time: t, action: () => {
            spawnWarningLaser(canvas.width/4, 0, canvas.width/2, canvas.height, 500, 40);
            spawnWarningLaser(0, canvas.height/4, canvas.width, canvas.height/2, 500, 40);
        }});
    }

    // Sort by time just in case
    return seq.sort((a, b) => a.time - b.time);
}

const gasterSequence = generateTimeline();

function executeAttacks(time) {
    while (nextAttackIndex < gasterSequence.length && time >= gasterSequence[nextAttackIndex].time) {
        gasterSequence[nextAttackIndex].action();
        nextAttackIndex++;
    }
}

// --- Main Game Loop ---
function updateLoop() {
    if (!gameActive) return;

    let currentTime = bgMusic.currentTime;
    timeValue.innerText = Math.floor(currentTime / 60) + ":" + (Math.floor(currentTime % 60)).toString().padStart(2, '0');

    if (currentTime >= songLength) {
        gameWon();
        return;
    }

    executeAttacks(currentTime);

    // --- Player Movement & Teleport Dash ---
    let dx = 0;
    let dy = 0;

    if (keys.w || keys.ArrowUp) dy -= 1;
    if (keys.s || keys.ArrowDown) dy += 1;
    if (keys.a || keys.ArrowLeft) dx -= 1;
    if (keys.d || keys.ArrowRight) dx += 1;

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
        let length = Math.sqrt(dx * dx + dy * dy);
        dx /= length;
        dy /= length;
    }

    if (keys[' '] && player.dashCooldown === 0 && (dx !== 0 || dy !== 0)) {
        // Record trail for teleport animation
        player.trails.push({ x: player.x, y: player.y, targetX: player.x + dx * player.dashDistance, targetY: player.y + dy * player.dashDistance, life: 12 });
        
        // Instant Teleport
        player.x += dx * player.dashDistance;
        player.y += dy * player.dashDistance;
        
        player.dashCooldown = 40; // Tightened dash cooldown for bullet hell survival
        player.invulnerable = 12; // I-frames during recovery
    } else {
        // Normal movement
        player.x += dx * player.speed;
        player.y += dy * player.speed;
    }

    if (player.dashCooldown > 0) player.dashCooldown--;
    if (player.invulnerable > 0) player.invulnerable--;
    
    // Update teleport trails
    player.trails.forEach(t => t.life--);
    player.trails = player.trails.filter(t => t.life > 0);

    // Screen Boundaries
    player.x = Math.max(player.visualSize / 2, Math.min(canvas.width - player.visualSize / 2, player.x));
    player.y = Math.max(player.visualSize / 2, Math.min(canvas.height - player.visualSize / 2, player.y));

    // Update Projectiles & Warnings
    warnings.forEach(w => w.life--);
    warnings = warnings.filter(w => w.life > 0);

    projectiles.forEach(p => {
        p.x += p.dx;
        p.y += p.dy;
        p.life--;

        // Collision Check (AABB adapted for square player with tight hitbox)
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

// --- Drawing Logic ---
function draw() {
    // Slight trail effect on background clear for that Neon-Evasion feel
    ctx.fillStyle = 'rgba(5, 5, 5, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Neon Glow Settings
    ctx.shadowBlur = 15;

    // Draw Warnings 
    warnings.forEach(w => {
        ctx.shadowColor = '#8800ff';
        ctx.fillStyle = `rgba(136, 0, 255, ${w.life / w.maxLife * 0.5})`; 
        ctx.fillRect(w.x, w.y, w.w, w.h);
    });

    // Draw Projectiles
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

    // Draw Teleport Trails
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

    // Draw Player (Square, Blinking when invulnerable)
    if (player.invulnerable % 6 < 3) { 
        ctx.shadowColor = player.color;
        ctx.fillStyle = player.color;
        ctx.fillRect(player.x - player.visualSize / 2, player.y - player.visualSize / 2, player.visualSize, player.visualSize);
        
        // Inner white core for the neon look
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(player.x - player.visualSize / 4, player.y - player.visualSize / 4, player.visualSize / 2, player.visualSize / 2);
    }

    // Reset shadow for UI
    ctx.shadowBlur = 0;

    // --- DEBUG HUD ---
    if (debugMode) {
        ctx.fillStyle = '#00ffcc'; 
        ctx.font = 'bold 20px "Courier New", Courier, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`[DEBUG MODE ACTIVE] HITS TAKEN: ${totalHits} | TIME: ${timeValue.innerText} \vert{} ENTITIES:${projectiles.length}`, 20, canvas.height - 30);
        ctx.font = '14px "Courier New", Courier, monospace';
        ctx.fillText(`Press backtick (\`) to toggle debug mode. HP will not drain while active.`, 20, canvas.height - 10);
    }
}
