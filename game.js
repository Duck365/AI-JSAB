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
let maxHp = 3;
let currentHp = maxHp;
let totalHits = 0;
let debugMode = true; 

// --- Audio & Timeline Engine ---
const bgMusic = new Audio('Dark-Darker-Yet-Darker-Remix.mp3');
let nextAttackIndex = 0;
const songLength = 120; 

// --- Player Object (Red Square Soul) ---
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 14, // Small square
    speed: 6,
    color: '#ff0000', // Undertale Red
    dashCooldown: 0,
    dashDistance: 150, // Instant teleport distance
    invulnerable: 0,
    trails: [] // Stores dash visual effects
};

// --- Controls ---
const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false, ' ': false };

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
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

// --- Custom Gaster Attacks ---
function spawnGasterBlaster(x, y, w, h) {
    warnings.push({ x, y, w, h, life: 30, maxLife: 30 });
    setTimeout(() => {
        if (gameActive) projectiles.push({ x, y, w, h, dx: 0, dy: 0, life: 45, type: 'laser' });
    }, 500); 
}

function spawnVoidHands() {
    const numHands = 16; 
    const radius = Math.max(canvas.width, canvas.height) / 2;
    for (let i = 0; i < numHands; i++) {
        let angle = (Math.PI * 2 / numHands) * i;
        let startX = player.x + Math.cos(angle) * radius;
        let startY = player.y + Math.sin(angle) * radius;
        
        let dx = Math.cos(angle + Math.PI) * 6; 
        let dy = Math.sin(angle + Math.PI) * 6;
        
        projectiles.push({ x: startX, y: startY, w: 14, h: 14, dx, dy, life: 200, type: 'hand' });
    }
}

function spawnGlitchWall(direction) {
    let speed = 10;
    let gap = 55; 
    
    if (direction === 'horizontal') {
        for (let y = 0; y < canvas.height; y += gap) {
            if (y < player.y - 70 || y > player.y + 70) {
                projectiles.push({ x: canvas.width, y, w: 25, h: 12, dx: -speed, dy: 0, life: 250, type: 'glitch' });
            }
        }
    } else {
        for (let x = 0; x < canvas.width; x += gap) {
            if (x < player.x - 70 || x > player.x + 70) {
                projectiles.push({ x, y: -20, w: 12, h: 25, dx: 0, dy: speed, life: 250, type: 'glitch' });
            }
        }
    }
}

// --- Attack Timeline ---
const gasterSequence = [
    { time: 1.0, action: () => spawnGasterBlaster(0, canvas.height / 2 - 100, canvas.width, 200) },
    { time: 2.5, action: () => spawnGasterBlaster(canvas.width / 2 - 100, 0, 200, canvas.height) },
    { time: 3.5, action: () => spawnVoidHands() },
    { time: 6.0, action: () => spawnGlitchWall('horizontal') },
    { time: 6.5, action: () => spawnGasterBlaster(0, 0, canvas.width, 150) },
    { time: 6.5, action: () => spawnGasterBlaster(0, canvas.height - 150, canvas.width, 150) },
    { time: 8.0, action: () => spawnVoidHands() },
    { time: 10.0, action: () => spawnGasterBlaster(0, player.y - 80, canvas.width, 160) },
    { time: 10.5, action: () => spawnGasterBlaster(player.x - 80, 0, 160, canvas.height) },
    { time: 11.5, action: () => spawnGlitchWall('vertical') },
    { time: 14.0, action: () => spawnVoidHands() },
    { time: 14.5, action: () => spawnGlitchWall('horizontal') },
    { time: 15.0, action: () => spawnVoidHands() },
    { time: 15.5, action: () => spawnGlitchWall('vertical') },
    { time: 18.0, action: () => spawnGasterBlaster(0, 0, canvas.width, canvas.height / 3) },
    { time: 18.5, action: () => spawnGasterBlaster(0, canvas.height / 3, canvas.width, canvas.height / 3) },
    { time: 19.0, action: () => spawnGasterBlaster(0, (canvas.height / 3) * 2, canvas.width, canvas.height / 3) },
    { time: 21.0, action: () => { spawnVoidHands(); spawnVoidHands(); } },
    { time: 22.0, action: () => {
        spawnGasterBlaster(0, player.y - 120, canvas.width, 100);
        spawnGasterBlaster(0, player.y + 20, canvas.width, 100);
    }},
    { time: 23.5, action: () => spawnGlitchWall('horizontal') },
    { time: 24.5, action: () => spawnGlitchWall('vertical') },
    { time: 27.0, action: () => spawnVoidHands() },
    { time: 28.0, action: () => spawnGasterBlaster(canvas.width/4, 0, canvas.width/2, canvas.height) },
    { time: 29.0, action: () => spawnVoidHands() },
];

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
        player.trails.push({ x: player.x, y: player.y, targetX: player.x + dx * player.dashDistance, targetY: player.y + dy * player.dashDistance, life: 10 });
        
        // Instant Teleport
        player.x += dx * player.dashDistance;
        player.y += dy * player.dashDistance;
        
        player.dashCooldown = 45;
        player.invulnerable = 15;
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
    player.x = Math.max(player.size / 2, Math.min(canvas.width - player.size / 2, player.x));
    player.y = Math.max(player.size / 2, Math.min(canvas.height - player.size / 2, player.y));

    // Update Projectiles & Warnings
    warnings.forEach(w => w.life--);
    warnings = warnings.filter(w => w.life > 0);

    projectiles.forEach(p => {
        p.x += p.dx;
        p.y += p.dy;
        p.life--;

        // Collision Check (AABB adapted for square player)
        if (player.invulnerable === 0 && 
            player.x - player.size/2 < p.x + (p.w/2 || p.w) &&
            player.x + player.size/2 > p.x - (p.w/2 || 0) &&
            player.y - player.size/2 < p.y + (p.h/2 || p.h) &&
            player.y + player.size/2 > p.y - (p.h/2 || 0)) {
            
            takeDamage();
        }
    });
    projectiles = projectiles.filter(p => p.life > 0);

    draw();
    animationId = requestAnimationFrame(updateLoop);
}

function takeDamage() {
    totalHits++; 
    currentHp--;
    hpValue.innerText = currentHp;
    player.invulnerable = 60; 
    // if (currentHp <= 0) gameOver(); // Commented out for debug mode testing!
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Warnings 
    warnings.forEach(w => {
        ctx.fillStyle = `rgba(106, 13, 173, ${w.life / w.maxLife})`; 
        ctx.fillRect(w.x, w.y, w.w, w.h);
    });

    // Draw Projectiles
    projectiles.forEach(p => {
        ctx.fillStyle = p.type === 'laser' ? '#ffffff' : '#6a0dad';
        if (p.type === 'laser') {
            ctx.fillRect(p.x, p.y, p.w, p.h);
        } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.w, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // Draw Teleport Trails
    player.trails.forEach(t => {
        ctx.strokeStyle = `rgba(255, 0, 0, ${t.life / 10})`;
        ctx.lineWidth = player.size;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.targetX, t.targetY);
        ctx.stroke();
    });

    // Draw Player (Square, Blinking when invulnerable)
    if (player.invulnerable % 4 < 2) { 
        ctx.fillStyle = player.color;
        ctx.fillRect(player.x - player.size / 2, player.y - player.size / 2, player.size, player.size);
    }

    // --- DEBUG HUD ---
    if (debugMode) {
        ctx.fillStyle = '#ffff00'; 
        ctx.font = '18px "Courier New", Courier, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`DEBUG - HITS TAKEN: ${totalHits}`, 20, canvas.height - 20);
    }
}
