const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const bestEl = document.getElementById("best");
const soundButton = document.getElementById("sound");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GROUND_H = 112;
const SKY_H = HEIGHT - GROUND_H;
const FPS = 60;
const STEP = 1000 / FPS;

const TUNING = {
  gravity: 0.25,
  flap: -4.6,
  maxFall: 8.0,
  pipeSpeed: 2.0,
  pipeInterval: 90,
  pipeWidth: 52,
  gap: 100,
  birdX: 57,
  birdRadius: 12,
  birdHitW: 22,
  birdHitH: 18,
};

const palette = {
  sky: "#70c5ce",
  cloud: "#e7fbff",
  hillBack: "#6fc180",
  hillFront: "#9bd36e",
  ground: "#ded895",
  groundTop: "#d2a84a",
  soil: "#c58d46",
  pipe: "#75bf2f",
  pipeLight: "#9be65a",
  pipeDark: "#4d8e24",
  pipeLip: "#65ad2b",
  ink: "#2f1c10",
  white: "#fff8df",
  yellow: "#f8cf45",
  orange: "#ef7e2d",
  red: "#d6452b",
};

let state;
let accumulator = 0;
let lastTime = performance.now();
let soundOn = localStorage.getItem("flappy-flight-sound") !== "off";
let best = Number(localStorage.getItem("flappy-flight-best") || 0);
let audioCtx;

bestEl.textContent = best;
soundButton.textContent = soundOn ? "Sound On" : "Sound Off";

function reset(mode = "ready") {
  state = {
    mode,
    frame: 0,
    score: 0,
    flash: 0,
    groundOffset: 0,
    bird: {
      x: TUNING.birdX,
      y: 214,
      vy: 0,
      rotation: 0,
      wing: 0,
    },
    pipes: [],
  };
}

function startGame() {
  reset("playing");
  flap();
}

function flap() {
  if (state.mode === "ready") {
    startGame();
    return;
  }

  if (state.mode === "gameover") {
    startGame();
    return;
  }

  if (state.mode !== "playing") return;
  state.bird.vy = TUNING.flap;
  state.bird.wing = 7;
  playTone(560, 0.045, "square", 0.05);
}

function gameOver() {
  if (state.mode === "gameover") return;
  state.mode = "gameover";
  state.flash = 7;
  playTone(160, 0.12, "sawtooth", 0.055);

  if (state.score > best) {
    best = state.score;
    localStorage.setItem("flappy-flight-best", String(best));
    bestEl.textContent = best;
  }
}

function spawnPipe() {
  const topMin = 52;
  const topMax = SKY_H - TUNING.gap - 46;
  const topH = Math.floor(topMin + Math.random() * (topMax - topMin));
  state.pipes.push({
    x: WIDTH + 10,
    top: topH,
    bottom: topH + TUNING.gap,
    scored: false,
  });
}

function update() {
  state.frame += 1;

  if (state.mode === "ready") {
    state.bird.y = 214 + Math.sin(state.frame * 0.1) * 5;
    state.bird.rotation = 0;
    state.groundOffset = (state.groundOffset + TUNING.pipeSpeed) % 24;
    return;
  }

  if (state.mode === "playing") {
    if (state.frame % TUNING.pipeInterval === 1) spawnPipe();

    const bird = state.bird;
    bird.vy = Math.min(bird.vy + TUNING.gravity, TUNING.maxFall);
    bird.y += bird.vy;
    bird.rotation = Math.max(-0.45, Math.min(1.45, bird.vy / 7));
    bird.wing = Math.max(0, bird.wing - 1);

    for (const pipe of state.pipes) {
      pipe.x -= TUNING.pipeSpeed;
      if (!pipe.scored && pipe.x + TUNING.pipeWidth < bird.x) {
        pipe.scored = true;
        state.score += 1;
        playTone(880, 0.06, "square", 0.045);
      }
    }

    state.pipes = state.pipes.filter((pipe) => pipe.x > -TUNING.pipeWidth - 12);
    state.groundOffset = (state.groundOffset + TUNING.pipeSpeed) % 24;

    if (collides()) gameOver();
  } else if (state.mode === "gameover") {
    const bird = state.bird;
    if (bird.y + TUNING.birdRadius < SKY_H) {
      bird.vy = Math.min(bird.vy + TUNING.gravity, TUNING.maxFall);
      bird.y += bird.vy;
      bird.rotation = Math.min(1.55, bird.rotation + 0.07);
    }
  }

  state.flash = Math.max(0, state.flash - 1);
}

function collides() {
  const bird = getBirdBox();
  if (bird.y < -8) return true;
  if (bird.y + bird.h >= SKY_H) return true;

  for (const pipe of state.pipes) {
    const inX = bird.x < pipe.x + TUNING.pipeWidth && bird.x + bird.w > pipe.x;
    if (!inX) continue;
    if (bird.y < pipe.top || bird.y + bird.h > pipe.bottom) return true;
  }

  return false;
}

function getBirdBox() {
  return {
    x: state.bird.x - TUNING.birdHitW / 2,
    y: state.bird.y - TUNING.birdHitH / 2,
    w: TUNING.birdHitW,
    h: TUNING.birdHitH,
  };
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawWorld();
  drawPipes();
  drawGround();
  drawBird();
  drawScore();
  drawOverlay();

  if (state.flash > 0) {
    ctx.globalAlpha = state.flash / 10;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
  }
}

function drawWorld() {
  ctx.fillStyle = palette.sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawCloud(32, 84, 0.85);
  drawCloud(154, 52, 0.65);
  drawCloud(235, 112, 0.75);

  ctx.fillStyle = palette.hillBack;
  drawHill(-28, SKY_H, 72, 95);
  drawHill(86, SKY_H, 82, 118);
  drawHill(210, SKY_H, 70, 86);

  ctx.fillStyle = palette.hillFront;
  drawHill(18, SKY_H + 10, 54, 64);
  drawHill(120, SKY_H + 12, 70, 78);
  drawHill(224, SKY_H + 8, 62, 68);
}

function drawCloud(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = palette.cloud;
  ctx.beginPath();
  ctx.arc(0, 12, 13, 0, Math.PI * 2);
  ctx.arc(15, 4, 16, 0, Math.PI * 2);
  ctx.arc(32, 12, 12, 0, Math.PI * 2);
  ctx.fillRect(-4, 12, 42, 13);
  ctx.fill();
  ctx.restore();
}

function drawHill(x, base, w, h) {
  ctx.beginPath();
  ctx.moveTo(x - w, base);
  ctx.quadraticCurveTo(x, base - h, x + w, base);
  ctx.closePath();
  ctx.fill();
}

function drawPipes() {
  for (const pipe of state.pipes) {
    drawPipe(pipe.x, 0, pipe.top, true);
    drawPipe(pipe.x, pipe.bottom, SKY_H - pipe.bottom, false);
  }
}

function drawPipe(x, y, h, top) {
  const w = TUNING.pipeWidth;
  const lipH = 24;
  const lipY = top ? y + h - lipH : y;

  ctx.fillStyle = palette.pipeDark;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = palette.pipe;
  ctx.fillRect(x + 4, y, w - 8, h);
  ctx.fillStyle = palette.pipeLight;
  ctx.fillRect(x + 8, y, 9, h);

  ctx.fillStyle = palette.pipeDark;
  ctx.fillRect(x - 4, lipY, w + 8, lipH);
  ctx.fillStyle = palette.pipeLip;
  ctx.fillRect(x, lipY + 4, w, lipH - 8);
  ctx.fillStyle = palette.pipeLight;
  ctx.fillRect(x + 7, lipY + 4, 10, lipH - 8);

  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.strokeRect(x - 4, lipY, w + 8, lipH);
}

function drawGround() {
  ctx.fillStyle = palette.groundTop;
  ctx.fillRect(0, SKY_H, WIDTH, 16);

  for (let x = -24 - state.groundOffset; x < WIDTH + 24; x += 24) {
    ctx.fillStyle = x / 24 % 2 ? "#e7c76b" : "#dba948";
    ctx.beginPath();
    ctx.moveTo(x, SKY_H);
    ctx.lineTo(x + 24, SKY_H);
    ctx.lineTo(x + 12, SKY_H + 16);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, SKY_H + 16, WIDTH, GROUND_H - 16);

  ctx.fillStyle = palette.soil;
  for (let x = -12 - state.groundOffset; x < WIDTH + 16; x += 24) {
    ctx.fillRect(x, SKY_H + 33, 12, 5);
    ctx.fillRect(x + 10, SKY_H + 56, 16, 5);
    ctx.fillRect(x - 2, SKY_H + 82, 14, 5);
  }
}

function drawBird() {
  const bird = state.bird;
  const wingUp = bird.wing > 0 || Math.sin(state.frame * 0.45) > 0;

  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.rotation);

  ctx.fillStyle = palette.orange;
  ctx.beginPath();
  ctx.ellipse(3, 2, 18, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = palette.yellow;
  ctx.beginPath();
  ctx.ellipse(-4, 0, 14, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = palette.white;
  ctx.beginPath();
  ctx.ellipse(6, -6, 7, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = palette.ink;
  ctx.beginPath();
  ctx.arc(8, -6, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.red;
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(28, -4);
  ctx.lineTo(28, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffe877";
  ctx.beginPath();
  ctx.ellipse(-8, wingUp ? 3 : 8, 10, 6, wingUp ? -0.45 : 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawScore() {
  drawText(String(state.score), WIDTH / 2, 46, 34, "center");
}

function drawOverlay() {
  if (state.mode === "playing") return;

  if (state.mode === "ready") {
    drawText("Get Ready", WIDTH / 2, 132, 28, "center");
    drawText("Tap", WIDTH / 2, 188, 22, "center");
    drawText("Space / Click", WIDTH / 2, 226, 16, "center");
    return;
  }

  const boxX = 38;
  const boxY = 154;
  const boxW = WIDTH - boxX * 2;
  const boxH = 142;

  drawText("Game Over", WIDTH / 2, 116, 28, "center");
  ctx.fillStyle = "#f7e4a4";
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 3;
  roundRect(boxX, boxY, boxW, boxH, 8);
  ctx.fill();
  ctx.stroke();

  drawText("Score", boxX + 22, boxY + 38, 16, "left");
  drawText(String(state.score), boxX + boxW - 20, boxY + 40, 24, "right");
  drawText("Best", boxX + 22, boxY + 78, 16, "left");
  drawText(String(best), boxX + boxW - 20, boxY + 80, 24, "right");
  drawText("Tap to Retry", WIDTH / 2, boxY + 118, 17, "center");
}

function drawText(text, x, y, size, align) {
  ctx.save();
  ctx.font = `900 ${size}px "Trebuchet MS", Arial, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = Math.max(3, size * 0.14);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "#fff7d8";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function playTone(freq, duration, type, gain) {
  if (!soundOn) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  audioCtx ||= new Audio();
  if (audioCtx.state === "suspended") audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(gain, audioCtx.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(amp).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function loop(now) {
  accumulator += Math.min(80, now - lastTime);
  lastTime = now;

  while (accumulator >= STEP) {
    update();
    accumulator -= STEP;
  }

  draw();
  requestAnimationFrame(loop);
}

function handleAction(event) {
  if (event.cancelable) event.preventDefault();
  flap();
}

canvas.addEventListener("pointerdown", handleAction, { passive: false });
window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") handleAction(event);
});

soundButton.addEventListener("click", () => {
  soundOn = !soundOn;
  localStorage.setItem("flappy-flight-sound", soundOn ? "on" : "off");
  soundButton.textContent = soundOn ? "Sound On" : "Sound Off";
});

reset();
requestAnimationFrame(loop);
