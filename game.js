const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Fullscreen Canvas Setup ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Call immediately on load

// --- UI Elements & Glitch Effect ---
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const victoryScreen = document.getElementById('victory-screen');
const hud = document.getElementById('hud');
const hpValue = document.getElementById('hp-value');
const timeValue = document.getElementById('time-value');
const subtitle = document.getElementById('subtitle');

// Creepy Wingdings Text Glitch
if (subtitle) {
    const normalText = "The man who speaks in hands awaits...";
    const wingdingsText = "❄︎☟︎☜︎ ✞︎⚐︎✋︎👎︎ 👍︎⚐︎☠︎💧︎🕆︎💣︎☜︎💧︎ ✌︎☹︎☹︎"; // "THE VOID CONSUMES ALL"
    
    setInterval(() => {
        if (!gameActive && Math.random() < 0.3) {
            subtitle.style.fontFamily = "Wingdings, sans-serif";
            subtitle.innerText = wingdingsText;
            
            setTimeout(() => {
                subtitle.style.fontFamily = "'Courier New', Courier, monospace";
                subtitle.innerText = normalText;
            }, 100 + Math.random() * 300); // Glitch back to normal quickly
        }
    }, 1000);
}

// --- Game State ---
let gameActive = false;
let animationId;
let projectiles = [];
let warnings = [];
let maxHp = 3;
let currentHp = maxHp;

// --- Audio & Timeline Engine ---
const bgMusic = new Audio('Dark-Darker-Yet-Darker-Remix.mp3');
let nextAttackIndex = 0;
const songLength = 120; // Triggers victory at 2 minutes

// --- Player Object ---
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 16, // Small hitbox for tight dodging
    speed: 6,
    color: '#ffffff',
    isDashing: false,
    dashCooldown: 0,
    dashDuration: 0,
    dashSpeed: 15,
    invulnerable: 0
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
    currentHp = maxHp;
    hpValue.innerText = currentHp;
    
    projectiles = [];
    warnings = [];
    nextAttackIndex = 0;
    gameActive = true;

    // Start Audio
    bgMusic.currentTime = 0;
    bgMusic.play().catch(e => console.log("Audio blocked by browser. Click to interact.", e));

    updateLoop();
}

// --- Custom Gaster Attacks ---
function spawnGasterBlaster(x, y, w, h) {
    warnings.push({ x, y, w, h, life: 30, maxLife: 30 });
    setTimeout(() => {
        if (gameActive) projectiles.push({ x, y, w, h, dx: 0, dy: 0, life: 45, type: 'laser' });
    }, 500); // 0.5s warning before laser fires
}

function spawnVoidHands() {
    const numHands = 16; // High density
    const radius = Math.max(canvas.width, canvas.height) / 2;
    for (let i = 0; i < numHands; i++) {
        let angle = (Math.PI * 2 / numHands) * i;
        let startX = player.x + Math.cos(angle) * radius;
        let startY = player.y + Math.sin(angle) * radius;
        
        // Aim exactly at where the player is currently standing
        let dx = Math.cos(angle + Math.PI) * 6; 
        let dy = Math.sin(angle + Math.PI) * 6;
        
        projectiles.push({ x: startX, y: startY, w: 14, h: 14, dx, dy, life: 200, type: 'hand' });
    }
}

function spawnGlitchWall(direction) {
    let speed = 10;
    let gap = 55; // Tight gaps
    
    if (direction === 'horizontal') {
        for (let y = 0; y < canvas.height; y += gap) {
            // Leave a tight random safe zone tracking the player's general area
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
    // Intro - Assessing the soul
    { time: 1.0, action: () => spawnGasterBlaster(0, canvas.height / 2 - 100, canvas.width, 200) },
    { time: 2.5, action: () => spawnGasterBlaster(canvas.width / 2 - 100, 0, 200, canvas.height) },
    { time: 3.5, action: () => spawnVoidHands() },
    
    // Trapping the player
    { time: 6.0, action: () => spawnGlitchWall('horizontal') },
    { time: 6.5, action: () => spawnGasterBlaster(0, 0, canvas.width, 150) },
    { time: 6.5, action: () => spawnGasterBlaster(0, canvas.height - 150, canvas.width, 150) },
    { time: 8.0, action: () => spawnVoidHands() },
    
    // Crossfire
    { time: 10.0, action: () => spawnGasterBlaster(0, player.y - 80, canvas.width, 160) },
    { time: 10.5, action: () => spawnGasterBlaster(player.x - 80, 0, 160, canvas.height) },
    { time: 11.5, action: () => spawnGlitchWall('vertical') },
    
    // Fast Rhythm Section (Overlapping attacks)
    { time: 14.0, action: () => spawnVoidHands() },
    { time: 14.5, action: () => spawnGlitchWall('horizontal') },
    { time: 15.0, action: () => spawnVoidHands() },
    { time: 15.5, action: () => spawnGlitchWall('vertical') },
    
    // Screen Wipe (Forces precise positioning or dashing)
    { time: 18.0, action: () => spawnGasterBlaster(0, 0, canvas.width, canvas.height / 3) },
    { time: 18.5, action: () => spawnGasterBlaster(0, canvas.height / 3, canvas.width, canvas.height / 3) },
    { time: 19.0, action: () => spawnGasterBlaster(0, (canvas.height / 3) * 2, canvas.width, canvas.height / 3) },
    
    // The Swarm
    { time: 21.0, action: () => { spawnVoidHands(); spawnVoidHands(); } },
    { time: 22.0, action: () => {
        spawnGasterBlaster(0, player.y - 120, canvas.width, 100);
        spawnGasterBlaster(0, player.y + 20, canvas.width, 100);
    }},
    { time: 23.5, action: () => spawnGlitchWall('horizontal') },
    { time: 24.5, action: () => spawnGlitchWall('vertical') },
    
    // Continuous pressure
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

    // Win condition check
    if (currentTime >= songLength) {
        gameWon();
        return;
    }

    executeAttacks(currentTime);

    // Player Movement & Dash Logic
    let currentSpeed = player.speed;
    
    if (keys[' '] && player.dashCooldown === 0) {
        player.isDashing = true;
        player.dashDuration = 12;
        player.dashCooldown = 45;
        player.invulnerable = 15;
    }
    
    if (player.isDashing) {
        currentSpeed = player.dashSpeed;
        player.dashDuration--;
        if (player.dashDuration <= 0) player.isDashing = false;
    }
    if (player.dashCooldown > 0) player.dashCooldown--;
    if (player.invulnerable > 0) player.invulnerable--;

    if (keys.w || keys.ArrowUp) player.y -= currentSpeed;
    if (keys.s || keys.ArrowDown) player.y += currentSpeed;
    if (keys.a || keys.ArrowLeft) player.x -= currentSpeed;
    if (keys.d || keys.ArrowRight) player.x += currentSpeed;

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

        // Collision Check (AABB)
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
    currentHp--;
    hpValue.innerText = currentHp;
    player.invulnerable = 60; // 1 second i-frames
    if (currentHp <= 0) gameOver();
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

    // Draw Warnings (Pulsing Purple)
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

    // Draw Player (Blinking when invulnerable)
    if (player.invulnerable % 4 < 2) { 
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
        ctx.fill();
    }
}
