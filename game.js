// --- Game Setup & Variables ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameActive = false;
let isPaused = false;
let lastTime = 0;

// Player Stats
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    w: 15,
    h: 15,
    speed: 5,
    color: '#ffffff', // White player square
    hp: 3,
    isDashing: false,
    dashSpeed: 15,
    dashDuration: 10,
    dashTimer: 0,
    dashCooldown: 30,
    dashCooldownTimer: 0,
    invincible: false,
    invincibleTimer: 0
};

// Input Tracking
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });

// Projectiles and Warnings
let projectiles = [];
let warnings = [];

// --- Audio & Attack Sync Engine ---
const bgMusic = new Audio('Dark-Darker-Yet-Darker-Remix.mp3');
bgMusic.volume = 0.8;
let nextAttackIndex = 0;

// --- DOM Elements ---
const screens = {
    start: document.getElementById('start-screen'),
    gameOver: document.getElementById('game-over-screen'),
    victory: document.getElementById('victory-screen'),
    hud: document.getElementById('hud')
};
const displays = {
    hp: document.getElementById('hp-Here is the complete `game.js` file. It includes the player movement with dashing, precise collision detection, and the audio-synchronized timeline that triggers Gaster's attacks exactly to the music.

Create `game.js` in your repository and paste this exact code:

```javascript
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const victoryScreen = document.getElementById('victory-screen');
const hud = document.getElementById('hud');
const hpValue = document.getElementById('hp-value');
const timeValue = document.getElementById('time-value');

// Game State
let gameActive = false;
let animationId;
let projectiles = [];
let warnings = [];
let maxHp = 3;
let currentHp = maxHp;

// Audio & Timeline Engine
const bgMusic = new Audio('Dark-Darker-Yet-Darker-Remix.mp3');
let nextAttackIndex = 0;
const songLength = 120; // Set this to the song's end time in seconds to trigger Victory

// Player Object
const player = {
    x: 400,
    y: 300,
    size: 16, // Small hitbox for tight dodging
    speed: 5,
    color: '#ffffff',
    isDashing: false,
    dashCooldown: 0,
    dashDuration: 0,
    dashSpeed: 12,
    invulnerable: 0
};

// Controls
const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false, ' ': false };

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
});
window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

// Start Game Logic
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('home-btn').addEventListener('click', () => location.reload());

function startGame() {
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    victoryScreen.classList.add('hidden');
    hud.classList.remove('hidden');

    player.x = 400;
    player.y = 300;
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

// Custom Gaster Attacks
function spawnGasterBlaster(x, y, w, h) {
    // 0.5s warning before laser fires (assuming 60fps, 30 frames)
    warnings.push({ x, y, w, h, life: 30, maxLife: 30 });
    setTimeout(() => {
        if (gameActive) projectiles.push({ x, y, w, h, dx: 0, dy: 0, life: 40, type: 'laser' });
    }, 500);
}

function spawnVoidHands() {
    const numHands = 14; 
    const radius = 350;
    for (let i = 0; i < numHands; i++) {
        let angle = (Math.PI * 2 / numHands) * i;
        let startX = player.x + Math.cos(angle) * radius;
        let startY = player.y + Math.sin(angle) * radius;
        
        // Aim exactly at where the player is currently standing
        let dx = Math.cos(angle + Math.PI) * 5.5; 
        let dy = Math.sin(angle + Math.PI) * 5.5;
        
        projectiles.push({ x: startX, y: startY, w: 12, h: 12, dx, dy, life: 180, type: 'hand' });
    }
}

function spawnGlitchWall(direction) {
    let speed = 9;
    let gap = 50; 
    if (direction === 'horizontal') {
        for (let y = 0; y < canvas.height; y += gap) {
            // Leave a tight random safe zone
            if (y < player.y - 60 || y > player.y + 60) {
                projectiles.push({ x: canvas.width, y, w: 20, h: 10, dx: -speed, dy: 0, life: 120, type: 'glitch' });
            }
        }
    } else {
        for (let x = 0; x < canvas.width; x += gap) {
            if (x < player.x - 60 || x > player.x + 60) {
                projectiles.push({ x, y: -20, w: 10, h: 20, dx: 0, dy: speed, life: 120, type: 'glitch' });
            }
        }
    }
}

// Attack Timeline (Adjust the 'time' values to match beat drops in your specific mp3)
const gasterSequence = [
    { time: 1.5, action: () => spawnGasterBlaster(0, 200, canvas.width, 100) },
    { time: 2.5, action: () => spawnGasterBlaster(200, 0, 100, canvas.height) },
    { time: 4.0, action: () => spawnVoidHands() },
    { time: 6.5, action: () => spawnGlitchWall('horizontal') },
    { time: 7.5, action: () => spawnGlitchWall('vertical') },
    { time: 9.0, action: () => spawnVoidHands() },
    { time: 10.0, action: () => {
        spawnGasterBlaster(0, player.y - 100, canvas.width, 80);
        spawnGasterBlaster(0, player.y + 20, canvas.width, 80);
    }},
    { time: 12.0, action: () => spawnVoidHands() },
    { time: 12.5, action: () => spawnGlitchWall('horizontal') },
    // Add more attacks here following the song's progression!
];

function executeAttacks(time) {
    while (nextAttackIndex < gasterSequence.length && time >= gasterSequence[nextAttackIndex].time) {
        gasterSequence[nextAttackIndex].action();
        nextAttackIndex++;
    }
}

// Main Game Loop
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

    // Player Movement
    let currentSpeed = player.speed;
    
    // Dash Logic
    if (keys[' '] && player.dashCooldown === 0) {
        player.isDashing = true;
        player.dashDuration = 10;
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

    // Boundaries
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

// Drawing Logic
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Warnings
    warnings.forEach(w => {
        ctx.fillStyle = `rgba(106, 13, 173, ${w.life / w.maxLife})`; // Pulsing purple
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

    // Draw Player
    if (player.invulnerable % 4 < 2) { // Blinking effect when hurt/dashing
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
        ctx.fill();
    }
}
