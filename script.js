// --- STATE & Flow Controller ---
const screens = {
  intro: document.getElementById('s-intro'),
  story: document.getElementById('s-story'),
  game: document.getElementById('s-game'),
  photos: document.getElementById('s-photos'),
  transition: document.getElementById('s-transition'),
  final: document.getElementById('s-final')
};

function switchScreen(fromId, toId) {
  screens[fromId].classList.remove('active');
  setTimeout(() => {
    screens[fromId].classList.add('hidden');
    screens[toId].classList.remove('hidden');
    // small reflow
    void screens[toId].offsetWidth;
    screens[toId].classList.add('active');
  }, 1200); // UI fade time based on CSS
}

// --- AUDIO LOGIC ---
const bgAudio = new Audio('assets/bg-music.mp3');
bgAudio.loop = true;
bgAudio.volume = 0; // start at 0 for fade
let isMuted = false;

const muteBtn = document.getElementById('mute-btn');
const iconSound = document.getElementById('icon-sound');
const iconMute = document.getElementById('icon-mute');

function initAudio() {
  let playPromise = bgAudio.play();
  if (playPromise !== undefined) {
    playPromise.then(_ => {
      // Fade in smoothly
      let fadeAudio = setInterval(() => {
        if (bgAudio.volume < 0.4) {
          bgAudio.volume = Math.min(bgAudio.volume + 0.05, 0.4);
        } else {
          clearInterval(fadeAudio);
        }
      }, 200);
    }).catch(error => {
      console.log('Audio autoplay prevented, wait for further interaction.');
    });
  }
}

muteBtn.addEventListener('click', () => {
  isMuted = !isMuted;
  bgAudio.muted = isMuted;
  if(isMuted) {
    iconSound.classList.add('hidden');
    iconMute.classList.remove('hidden');
  } else {
    iconMute.classList.add('hidden');
    iconSound.classList.remove('hidden');
  }
});

// --- SEQUENCE 1. Intro ---
document.getElementById('btn-start').addEventListener('click', () => {
  switchScreen('intro', 'story');
  setTimeout(runStorySequence, 1200);
});

// --- SEQUENCE 2. Story Text Reveal ---
const storyLines = [
  "I thought of writing something normal...",
  "But that didn't feel right for you.",
  "Because you're not... normal 😄",
  "So I made something instead."
];
const storyText = document.getElementById('story-text');
const btnPlayIt = document.getElementById('btn-play-it');

async function runStorySequence() {
  for (let i = 0; i < storyLines.length; i++) {
    storyText.style.opacity = 0;
    await new Promise(r => setTimeout(r, 800)); // wait for fade out
    storyText.innerText = storyLines[i];
    storyText.style.opacity = 1;
    await new Promise(r => setTimeout(r, 2000)); // read time
  }
  btnPlayIt.classList.remove('hidden');
}

btnPlayIt.addEventListener('click', () => {
  muteBtn.classList.remove('hidden'); // Show mute button from now on
  initAudio();
  switchScreen('story', 'game');
  setTimeout(initGame, 1200);
});

// --- SEQUENCE 3. GAME (Flappy Bird style) ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const gameMessage = document.getElementById('game-message');
const modal = document.getElementById('game-over-modal');
const modalDesc = document.getElementById('modal-desc');

let gameLoop;
let isPlaying = false;
let frames = 0;
let score = 0;
const specialScoreThreshold = 12;

// Sizes
canvas.width = 400; // max width of container
canvas.height = 600;

let baseSpeed = 2.5; // slow at start

// Face Image Placeholder
const faceImg = new Image();
faceImg.src = 'assets/face.png';
let faceLoaded = false;
faceImg.onload = () => faceLoaded = true;

const player = {
  x: 60,
  y: canvas.height/2,
  radius: 18,
  velocity: 0,
  gravity: 0.18,
  jump: -4.8,
  draw: function() {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    // soft glow
    ctx.shadowColor = '#F8EDEE';
    ctx.shadowBlur = 10;
    
    if (faceLoaded) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(faceImg, this.x - this.radius, this.y - this.radius, this.radius*2, this.radius*2);
      ctx.restore();
      // outline
      ctx.strokeStyle = '#eacdd0';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#eacdd0';
      ctx.fill();
    }
    ctx.restore();
  },
  update: function() {
    this.velocity += this.gravity;
    this.y += this.velocity;
  }
};

const obstacles = [];
const obstacleGap = 170; // medium gap, balanced
const obstacleWidth = 40;

function drawObstacles() {
  ctx.fillStyle = '#e0b4b8';
  for(let i=0; i<obstacles.length; i++) {
    let obs = obstacles[i];
    // Top pipe
    ctx.fillRect(obs.x, 0, obstacleWidth, obs.top);
    // Bottom pipe
    ctx.fillRect(obs.x, canvas.height - obs.bottom, obstacleWidth, obs.bottom);
  }
}

function updateObstacles() {
  // Speed gradually increases slightly over time based on score
  let currentSpeed = baseSpeed + (score * 0.12);
  if (currentSpeed > 5) currentSpeed = 5;

  for(let i=0; i<obstacles.length; i++) {
    let obs = obstacles[i];
    obs.x -= currentSpeed;
    
    // Score logic
    if(!obs.passed && obs.x + obstacleWidth < player.x) {
      score++;
      scoreDisplay.innerText = score;
      obs.passed = true;
      if (score === 5) gameMessage.innerText = "You're getting it!";
      if (score === 10) gameMessage.innerText = "Almost there 🤔";
      if (score === specialScoreThreshold) gameMessage.innerText = "Wow! You actually did it 🎉";
    }

    // Collision Logic with pipe
    if(
      player.x + player.radius > obs.x && player.x - player.radius < obs.x + obstacleWidth &&
      (player.y - player.radius < obs.top || player.y + player.radius > canvas.height - obs.bottom)
    ) {
      gameOver();
    }
  }

  // Generate new obstacles based on distance
  // Instead of frame count, ensuring gap consistency
  let lastObstacle = obstacles[obstacles.length - 1];
  if (!lastObstacle || (canvas.width - lastObstacle.x) >= 220) {
    let minHeight = 60;
    let maxTopHeight = canvas.height - obstacleGap - minHeight;
    let topHeight = Math.floor(Math.random()*(maxTopHeight - minHeight + 1) + minHeight);
    
    obstacles.push({
      x: canvas.width,
      top: topHeight,
      bottom: canvas.height - (topHeight + obstacleGap),
      passed: false
    });
  }

  // Remove off-screen obstacles
  if(obstacles.length > 0 && obstacles[0].x < -obstacleWidth) {
    obstacles.shift();
  }
  
  // Floor/Ceiling collision
  if(player.y + player.radius > canvas.height || player.y - player.radius < 0) {
    gameOver();
  }
}

function drawBackground() {
  ctx.clearRect(0,0, canvas.width, canvas.height);
}

function gameLoopFunc() {
  if(!isPlaying) return;
  drawBackground();
  player.draw();
  player.update();
  drawObstacles();
  updateObstacles();
  frames++;
  requestAnimationFrame(gameLoopFunc);
}

function initGame() {
  player.y = canvas.height/2;
  player.velocity = 0;
  obstacles.length = 0;
  frames = 0;
  score = 0;
  scoreDisplay.innerText = score;
  gameMessage.innerText = "Tap to fly";
  modal.classList.add('hidden');
  document.querySelector('.game-container').classList.remove('shake');
  drawBackground();
  player.draw();
  isPlaying = true;
  
  // Controller
  window.addEventListener('mousedown', flap);
  window.addEventListener('touchstart', flapPlay, {passive: false});
  window.addEventListener('keydown', keyFlap);
  
  gameLoopFunc();
}

function stopInputs() {
  window.removeEventListener('mousedown', flap);
  window.removeEventListener('touchstart', flapPlay);
  window.removeEventListener('keydown', keyFlap);
}

function keyFlap(e) {
  if(e.code === 'Space') flap();
}
function flapPlay(e) { 
  if(e.target === canvas || e.target.tagName !== 'BUTTON') {
      e.preventDefault(); 
      flap(); 
  }
}

function flap() {
  if(!isPlaying) return;
  player.velocity = player.jump;
}

function gameOver() {
  isPlaying = false;
  stopInputs();
  // hit animation
  document.querySelector('.game-container').classList.add('shake');
  
  setTimeout(() => {
    modal.classList.remove('hidden');
    if (score >= specialScoreThreshold) {
      modalDesc.innerText = `You scored ${score}! You conquered the game.`;
    } else {
      modalDesc.innerText = `You scored ${score}. That was tougher than it looked!`;
    }
  }, 500);
}

document.getElementById('btn-play-again').addEventListener('click', initGame);
document.getElementById('btn-continue').addEventListener('click', () => {
  switchScreen('game', 'photos');
  setTimeout(initPhotos, 1200);
});


// --- SEQUENCE 4. Photos ---
function initPhotos() {
  const p1 = document.getElementById('p1');
  const p2 = document.getElementById('p2');
  const p3 = document.getElementById('p3');
  const btnTrans = document.getElementById('btn-transition');
  
  setTimeout(() => p1.classList.add('show'), 500);
  setTimeout(() => p2.classList.add('show'), 1500);
  setTimeout(() => p3.classList.add('show'), 2500);
  setTimeout(() => btnTrans.classList.add('show'), 3500);
}

document.getElementById('btn-transition').addEventListener('click', () => {
  switchScreen('photos', 'transition');
  setTimeout(runTransitionSequence, 1200);
});

// --- SEQUENCE 5. Transition ---
async function runTransitionSequence() {
  const tText = document.getElementById('transition-text');
  tText.innerText = "Because this was never about the game.";
  tText.style.opacity = 1;
  
  await new Promise(r => setTimeout(r, 2500)); // Wait and read
  
  tText.style.opacity = 0;
  await new Promise(r => setTimeout(r, 1500)); // Meaningful pause 1.5s
  
  tText.innerText = "It's about you.";
  tText.style.opacity = 1;
  
  await new Promise(r => setTimeout(r, 2500));
  
  switchScreen('transition', 'final');
}
