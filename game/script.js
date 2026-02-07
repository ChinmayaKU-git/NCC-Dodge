const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Constants
const GRAVITY = 0.08; // Reduced from 0.15
const JUMP = -2.6;   // Adjusted for lower gravity
const PIPE_SPEED = 1.5; // Reduced from 2
const PIPE_SPAWN_RATE = 150; // Increased to match slower speed (was 120)
const PIPE_GAP = 120; // fixed gap between top and bottom pipes
const PIPE_WIDTH = 52; // Width of the pipe sprite
const PIPE_START_DELAY = 180; // 3 seconds (60fps * 3)

// Game State
let frames = 0;
let score = 0;
let bestScore = localStorage.getItem('flappy_best_score') || 0;
let currentState = 'START'; // START, PLAYING, GAMEOVER
let gameLoopId;

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreDisplay = document.getElementById('score-display');
const finalScoreSpan = document.getElementById('final-score');
const bestScoreSpan = document.getElementById('best-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

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
sprites.bg.src = 'city.png'; // Switched to city.png as requested

const sounds = {
    jump: new Audio('fart.mp3'),
    hit: new Audio('fahh.mp3'),
    start: new Audio('yee.mp3')
};

// --- Game Objects ---

const bird = {
    x: 50,
    y: 150,
    w: 51, // Increased size (was 34), approx 1.5x
    h: 36, // Increased size (was 24), approx 1.5x
    speed: 0,
    rotation: 0,

    draw: function () {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        // Draw centered
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

        // Rotation logic
        if (this.speed < 0) {
            this.rotation = -25 * Math.PI / 180;
        } else {
            this.rotation += 2 * Math.PI / 180;
            if (this.rotation > 90 * Math.PI / 180) {
                this.rotation = 90 * Math.PI / 180;
            }
        }

        // Ground collision (simple floor at bottom of canvas)
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
    x: 0,
    dx: 1, // scroll speed (slower than pipes usually)

    draw: function () {
        // If image failed to load, just use CSS background
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

    reset: function () {
        this.items = [];
    },

    draw: function () {
        for (let i = 0; i < this.items.length; i++) {
            let p = this.items[i];

            // Top Pipe
            let topImg = p.topSprite || sprites.pipeTop; // Fallback if undefined (shouldn't happen)
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

            // Bottom Pipe
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
        // Spawn new pipes
        if (frames >= PIPE_START_DELAY && (frames - PIPE_START_DELAY) % PIPE_SPAWN_RATE === 0) {
            // Random height for top pipe
            // Minimum pipe height 50px
            const minHeight = 50;
            const maxPos = canvas.height - PIPE_GAP - minHeight;
            const h = Math.floor(Math.random() * (maxPos - minHeight + 1) + minHeight);

            // Randomize pipe images
            const pipeOptions = [sprites.pipeTop, sprites.pipeBottom];
            const randomTop = pipeOptions[Math.floor(Math.random() * pipeOptions.length)];
            const randomBottom = pipeOptions[Math.floor(Math.random() * pipeOptions.length)];

            this.items.push({
                x: canvas.width,
                y: 0, // Top pipe starts at top
                h: h,
                passed: false,
                topSprite: randomTop,
                bottomSprite: randomBottom
            });
        }

        for (let i = 0; i < this.items.length; i++) {
            let p = this.items[i];
            p.x -= PIPE_SPEED;

            // Collision Detection
            // Use a smaller hitbox for fairer gameplay (forgiveness)
            const padding = 8; // Reduce hitbox by 8px on each side
            const birdLeft = bird.x - bird.w / 2 + padding;
            const birdRight = bird.x + bird.w / 2 - padding;
            const birdTop = bird.y - bird.h / 2 + padding;
            const birdBottom = bird.y + bird.h / 2 - padding;

            // Top Pipe Box
            if (
                birdRight > p.x &&
                birdLeft < p.x + PIPE_WIDTH &&
                birdTop < p.y + p.h
            ) {
                gameOver();
            }

            // Bottom Pipe Box
            const bottomPipeY = p.y + p.h + PIPE_GAP;
            if (
                birdRight > p.x &&
                birdLeft < p.x + PIPE_WIDTH &&
                birdBottom > bottomPipeY
            ) {
                gameOver();
            }

            // Score update
            if (p.x + PIPE_WIDTH < bird.x && !p.passed) {
                score++;
                scoreDisplay.innerText = score;
                p.passed = true;
                // We keep it simple, just increment.
            }

            // Remove off-screen pipes
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
        if (e.code === 'Space') {
            action();
        }
    });
    canvas.addEventListener('click', action);
    canvas.addEventListener('touchstart', function (e) {
        e.preventDefault(); // prevent scrolling
        action();
    });

    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', resetGame);

    // Preload basic check? Not strictly needed with html5 audio/img logic above

    loop();
}

function resizeCanvas() {
    // scale canvas logic if needed, but css handles display size. 
    // We set internal resolution to match display or fixed?
    // Let's keep it fixed resolution for consistency, scaled by CSS.
    canvas.width = 320;
    canvas.height = 480;
}

function action() {
    if (currentState === 'PLAYING') {
        bird.jump();
    } else if (currentState === 'START') {
        startGame();
    } else if (currentState === 'GAMEOVER') {
        // Optional: click to restart behavior? 
        // Currently we insist on the button, but spacebar triggers action too?
        // Let's make spacebar trigger restart if on gameover screen?
        // Actually, let's keep it simple: button only for restart to avoid accidental restarts
    }
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
}

function gameOver() {
    currentState = 'GAMEOVER';
    playSound('hit');

    // Save High Score
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('flappy_best_score', bestScore);
    }

    finalScoreSpan.innerText = score;
    bestScoreSpan.innerText = bestScore;

    scoreDisplay.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
}

function resetGame() {
    startGame();
}

function playSound(name) {
    if (sounds[name]) {
        // Reset and play to allow overlap/rapid re-play
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
    // 'START' state just waits. 'GAMEOVER' static.
}

function draw() {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Background
    background.draw();

    // Draw Pipes
    pipes.draw();

    // Draw Bird
    bird.draw();

    // Draw Ground? Logic handled in collision, maybe draw a strip at bottom?
}

// Start
init();
