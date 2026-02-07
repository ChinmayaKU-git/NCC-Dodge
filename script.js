const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Constants
const GRAVITY = 0.08;
const JUMP = -2.6;
const PIPE_SPEED = 1.5;
const PIPE_SPAWN_RATE = 150;
const PIPE_GAP = 120;
const PIPE_WIDTH = 52;
const PIPE_START_DELAY = 180;

// Game State
let frames = 0;
let score = 0;
let currentState = 'LOGIN'; // START, PLAYING, GAMEOVER, LOGIN
let gameLoopId;
let currentUser = null; // { username: string, highScore: number }

// Service API
const API_URL = 'http://localhost:3000/api';

async function registerUser(username, password) {
    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            return { success: true, message: 'Registration successful! Please login.' };
        } else {
            return { success: false, message: data.error };
        }
    } catch (e) {
        console.error("Registration error:", e);
        return { success: false, message: 'Network error - Ensure server is running at http://localhost:3000' };
    }
}

async function loginUser(username, password) {
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            return { success: true, user: { username: data.username, highScore: data.highScore } };
        } else {
            return { success: false, message: data.error };
        }
    } catch (e) {
        console.error("Login error:", e);
        return { success: false, message: 'Network error - Ensure server is running at http://localhost:3000' };
    }
}

async function submitScore(score) {
    if (!currentUser) return;
    try {
        const res = await fetch(`${API_URL}/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username, score })
        });
        const data = await res.json();
        if (data.newHighScore) {
            currentUser.highScore = data.newHighScore;
        }
    } catch (e) {
        console.error('Error submitting score:', e);
    }
}

async function getLeaderboard() {
    try {
        const res = await fetch(`${API_URL}/leaderboard`);
        if (res.ok) return await res.json();
        return [];
    } catch (e) {
        return [];
    }
}

// UI Elements
const loginScreen = document.getElementById('login-screen');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreDisplay = document.getElementById('score-display');
const finalScoreSpan = document.getElementById('final-score');
const bestScoreSpan = document.getElementById('best-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const menuBtn = document.getElementById('menu-btn');
const logoutBtn = document.getElementById('logout-btn');

const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const authMessage = document.getElementById('auth-message');
const currentUserDisplay = document.getElementById('current-user-display');
const leaderboardList = document.getElementById('leaderboard-list');

// Assets
const sprites = {
    bird: new Image(),
    pipeTop: new Image(),
    pipeBottom: new Image(),
    bg: new Image()
};

sprites.bird.src = 'A.png';
sprites.pipeTop.src = 'G.png';
sprites.pipeBottom.src = 'N.png';
sprites.bg.src = 'city.png';

const sounds = {
    jump: new Audio('fart.mp3'),
    hit: new Audio('fahh.mp3'),
    start: new Audio('yee.mp3'),
    bgm: new Audio('Swing.mp3')
};
sounds.bgm.loop = true;

// --- Game Objects ---

const bird = {
    x: 50, y: 150, w: 51, h: 36, speed: 0, rotation: 0,

    draw: function () {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        if (sprites.bird.complete && sprites.bird.naturalWidth !== 0) {
            ctx.drawImage(sprites.bird, -this.w / 2, -this.h / 2, this.w, this.h);
        } else {
            ctx.fillStyle = 'yellow';
            ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
        }
        ctx.restore();
    },

    update: function () {
        this.speed += GRAVITY;
        this.y += this.speed;

        if (this.speed < 0) {
            this.rotation = -25 * Math.PI / 180;
        } else {
            this.rotation += 2 * Math.PI / 180;
            if (this.rotation > 90 * Math.PI / 180) {
                this.rotation = 90 * Math.PI / 180;
            }
        }

        if (this.y + this.h / 2 >= canvas.height) {
            this.y = canvas.height - this.h / 2;
            gameOver();
        }
    },

    jump: function () {
        this.speed = JUMP;
        playSound('jump');
    },

    reset: function () {
        this.y = 150;
        this.speed = 0;
        this.rotation = 0;
    }
};

const background = {
    x: 0, dx: 1,
    draw: function () {
        if (sprites.bg.complete && sprites.bg.naturalWidth !== 0) {
            ctx.drawImage(sprites.bg, this.x, 0, canvas.width, canvas.height);
            ctx.drawImage(sprites.bg, this.x + canvas.width, 0, canvas.width, canvas.height);
        }
    },
    update: function () {
        this.x = (this.x - this.dx) % canvas.width;
    }
};

const pipes = {
    items: [],
    reset: function () { this.items = []; },
    draw: function () {
        for (let i = 0; i < this.items.length; i++) {
            let p = this.items[i];
            let topImg = p.topSprite || sprites.pipeTop;
            if (topImg.complete && topImg.naturalWidth !== 0) {
                ctx.save();
                ctx.translate(p.x + PIPE_WIDTH / 2, p.y + p.h / 2);
                ctx.rotate(Math.PI);
                ctx.drawImage(topImg, -PIPE_WIDTH / 2, -p.h / 2, PIPE_WIDTH, p.h);
                ctx.restore();
            } else {
                ctx.fillStyle = 'green';
                ctx.fillRect(p.x, p.y, PIPE_WIDTH, p.h);
            }

            let bottomImg = p.bottomSprite || sprites.pipeBottom;
            if (bottomImg.complete && bottomImg.naturalWidth !== 0) {
                ctx.drawImage(bottomImg, p.x, p.y + p.h + PIPE_GAP, PIPE_WIDTH, canvas.height - (p.y + p.h + PIPE_GAP));
            } else {
                ctx.fillStyle = 'green';
                ctx.fillRect(p.x, p.y + p.h + PIPE_GAP, PIPE_WIDTH, canvas.height - (p.y + p.h + PIPE_GAP));
            }
        }
    },
    update: function () {
        if (frames >= PIPE_START_DELAY && (frames - PIPE_START_DELAY) % PIPE_SPAWN_RATE === 0) {
            const minHeight = 50;
            const maxPos = canvas.height - PIPE_GAP - minHeight;
            const h = Math.floor(Math.random() * (maxPos - minHeight + 1) + minHeight);
            const pipeOptions = [sprites.pipeTop, sprites.pipeBottom];
            const randomTop = pipeOptions[Math.floor(Math.random() * pipeOptions.length)];
            const randomBottom = pipeOptions[Math.floor(Math.random() * pipeOptions.length)];

            this.items.push({
                x: canvas.width, y: 0, h: h, passed: false,
                topSprite: randomTop, bottomSprite: randomBottom
            });
        }

        for (let i = 0; i < this.items.length; i++) {
            let p = this.items[i];
            p.x -= PIPE_SPEED;

            const padding = 8;
            const birdLeft = bird.x - bird.w / 2 + padding;
            const birdRight = bird.x + bird.w / 2 - padding;
            const birdTop = bird.y - bird.h / 2 + padding;
            const birdBottom = bird.y + bird.h / 2 - padding;

            if (birdRight > p.x && birdLeft < p.x + PIPE_WIDTH && birdTop < p.y + p.h) gameOver();

            const bottomPipeY = p.y + p.h + PIPE_GAP;
            if (birdRight > p.x && birdLeft < p.x + PIPE_WIDTH && birdBottom > bottomPipeY) gameOver();

            if (p.x + PIPE_WIDTH < bird.x && !p.passed) {
                score++;
                scoreDisplay.innerText = score;
                p.passed = true;
            }

            if (p.x + PIPE_WIDTH <= 0) {
                this.items.shift();
                i--;
            }
        }
    }
};

// --- Game Control ---

function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Input
    window.addEventListener('keydown', function (e) {
        if (e.code === 'Space') action();
    });
    canvas.addEventListener('click', action);
    canvas.addEventListener('touchstart', function (e) {
        e.preventDefault();
        action();
    });

    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', resetGame);
    menuBtn.addEventListener('click', showStartScreen);
    logoutBtn.addEventListener('click', handleLogout);

    loginBtn.addEventListener('click', handleLogin);
    registerBtn.addEventListener('click', handleRegister);

    loop();
}

function resizeCanvas() {
    canvas.width = 320;
    canvas.height = 480;
}

function action() {
    if (currentState === 'PLAYING') {
        bird.jump();
    }
}

async function handleLogin() {
    const u = usernameInput.value.trim();
    const p = passwordInput.value.trim();
    if (!u || !p) { authMessage.innerText = "Please enter both fields"; return; }

    authMessage.innerText = "Logging in...";
    const result = await loginUser(u, p);
    if (result.success) {
        currentUser = result.user;
        authMessage.innerText = "";
        showStartScreen();
    } else {
        authMessage.innerText = result.message;
    }
}

async function handleRegister() {
    const u = usernameInput.value.trim();
    const p = passwordInput.value.trim();
    if (!u || !p) { authMessage.innerText = "Please enter both fields"; return; }
    if (p.length < 6) { authMessage.innerText = "Password must be at least 6 characters"; return; }

    authMessage.innerText = "Registering...";
    const result = await registerUser(u, p);
    authMessage.innerText = result.message;
}

function handleLogout() {
    currentUser = null;
    currentState = 'LOGIN';
    loginScreen.classList.remove('hidden');
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    scoreDisplay.classList.add('hidden');
    usernameInput.value = "";
    passwordInput.value = "";
    authMessage.innerText = "";
}

async function showStartScreen() {
    currentState = 'START';
    loginScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    gameOverScreen.classList.add('hidden');
    scoreDisplay.classList.add('hidden');

    currentUserDisplay.innerText = currentUser ? currentUser.username : "Guest";

    // update leaderboard
    renderLeaderboard();
}

async function renderLeaderboard() {
    leaderboardList.innerHTML = "Loading...";
    const players = await getLeaderboard();
    leaderboardList.innerHTML = "";
    players.forEach((p, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="rank">#${index + 1} ${p.username}</span> <span class="score">${p.high_score}</span>`;
        leaderboardList.appendChild(li);
    });
}

function startGame() {
    currentState = 'PLAYING';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    scoreDisplay.classList.remove('hidden');
    playSound('start');

    bird.reset();
    pipes.reset();
    score = 0;
    scoreDisplay.innerText = score;
    frames = 0;

    // Start BGM
    sounds.bgm.currentTime = 0;
    sounds.bgm.play().catch(e => console.log('BGM play error:', e));
}

function gameOver() {
    currentState = 'GAMEOVER';
    playSound('hit');

    // Stop BGM
    sounds.bgm.pause();
    sounds.bgm.currentTime = 0;

    // Submit score
    if (currentUser) {
        if (score > currentUser.highScore) {
            currentUser.highScore = score; // optimistic update
        }
        submitScore(score);
    }

    finalScoreSpan.innerText = score;
    bestScoreSpan.innerText = currentUser ? currentUser.highScore : 0; // Show User's high score

    scoreDisplay.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
}

function resetGame() {
    startGame();
}

function playSound(name) {
    if (sounds[name]) {
        sounds[name].currentTime = 0;
        sounds[name].play().catch(e => console.log('Audio play error:', e));
    }
}

function loop() {
    update();
    draw();
    gameLoopId = requestAnimationFrame(loop);
}

function update() {
    if (currentState === 'PLAYING') {
        bird.update();
        pipes.update();
        background.update();
        frames++;
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    background.draw();
    pipes.draw();
    bird.draw();
}

// Start
init();
