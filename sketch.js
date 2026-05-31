let video;
let hands;
let predictionReady = false;
let handsData = []; 
let gameStarted = false; 

const rawWords = [
  { ch: "星期四", en: "Thursday" }, { ch: "四個星期", en: "Fourweeks" },
  { ch: "星期天", en: "Sunday" }, { ch: "生日", en: "Birthday" },
  { ch: "今天", en: "Today" }, { ch: "昨天", en: "Yesterday" },
  { ch: "明天", en: "Tomorrow" }, { ch: "臺灣", en: "Taiwan" }, 
  { ch: "夏天", en: "Summer" },  { ch: "快樂", en: "Happy" }, 
  { ch: "住在", en: "Live" }, { ch: "現在", en: "Now" },
  { ch: "星期", en: "Week" }, { ch: "一年", en: "one year" },
  { ch: "兩個月", en: "Two months" }
];

let cards = [];
let matchedCount = 0; 

let handStatus = [
  { grabbed: null, pointer: { x: 0, y: 0 }, isFist: false, isThumbsUp: false },
  { grabbed: null, pointer: { x: 0, y: 0 }, isFist: false, isThumbsUp: false }
];

let resetTimer = 0;
let particles = [];
let gameCleared = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  video = createCapture(VIDEO);
  video.size(windowWidth, windowHeight);
  video.hide();

  hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 2, 
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
  });

  hands.onResults(onHandResults);

  const camera = new Camera(video.elt, {
    onFrame: async () => { await hands.send({ image: video.elt }); },
    width: windowWidth, height: windowHeight
  });
  camera.start();
}

function startGameClick() {
  gameStarted = true;
  document.getElementById('start-menu').style.opacity = 0;
  setTimeout(() => {
    document.getElementById('start-menu').style.display = 'none';
  }, 500);
  document.getElementById('ui-layer').classList.remove('hidden-ui');
  initGame();
}

function initGame() {
  cards = [];
  matchedCount = 0; 
  resetTimer = 0;
  gameCleared = false;
  handStatus.forEach(h => h.grabbed = null);
  updateScoreUI();
  
  // 隨機選 3 組生成 6 張字卡
  let shuffledRaw = [...rawWords].sort(() => random() - 0.5);
  let selectedWords = shuffledRaw.slice(0, 3);

  selectedWords.forEach((pair, index) => {
    cards.push(createCard(index, 'CH', pair.ch, pair.en));
    cards.push(createCard(index, 'EN', pair.en, pair.ch));
  });

  distributeCards();
}

function createCard(id, type, txt, match) {
  return {
    id: id, type: type, text: txt, matchText: match,
    x: 0, y: 0, 
    w: 150, h: 85, 
    hoverScale: 0, shakeTimer: 0, active: true
  };
}

// 讓 6 張字卡在畫面上自動分散防碰撞
function distributeCards() {
  cards.forEach(card => {
    let validPosition = false;
    let attempts = 0;

    while (!validPosition && attempts < 100) {
      let testX = random(120, width - 120);
      let testY = random(240, height - 150);
      
      let tooClose = false;
      for (let other of cards) {
        if (other.x !== 0 && other.y !== 0) {
          if (dist(testX, testY, other.x, other.y) < 220) { 
            tooClose = true;
            break;
          }
        }
      }
      
      if (!tooClose) {
        card.x = testX;
        card.y = testY;
        validPosition = true;
      }
      attempts++;
    }
    
    if (!validPosition) {
      card.x = random(120, width - 120);
      card.y = random(240, height - 150);
    }
  });
}

function onHandResults(results) {
  if (!gameStarted) return;
  handsData = results.multiHandLandmarks || [];
  predictionReady = handsData.length > 0;

  handStatus.forEach(h => { h.isFist = false; h.isThumbsUp = false; });

  handsData.forEach((lm, index) => {
    if (index > 1) return; 
    let h = handStatus[index];
    h.pointer.x = (1 - lm[9].x) * width;
    h.pointer.y = lm[9].y * height;
    h.isFist = checkIsFist(lm);
    h.isThumbsUp = checkThumbsUp(lm);
  });
}

function checkThumbsUp(lm) {
  let thumbUp = (lm[4].y < lm[3].y) && (lm[3].y < lm[2].y);
  let othersDown = (lm[8].y > lm[6].y) && (lm[12].y > lm[10].y) && (lm[16].y > lm[14].y) && (lm[20].y > lm[18].y);
  return thumbUp && othersDown;
}

function checkIsFist(lm) {
  let count = 0;
  if (lm[8].y > lm[6].y) count++;
  if (lm[12].y > lm[10].y) count++;
  if (lm[16].y > lm[14].y) count++;
  if (lm[20].y > lm[18].y) count++;
  return count >= 3;
}

function draw() {
  drawGradientBackground();

  if (gameStarted) {
    // 高清晰鏡頭背景 (透明度 55)
    push();
    translate(width, 0); scale(-1, 1);
    tint(255, 55); 
    image(video, 0, 0, width, height);
    pop();

    drawCards();

    if (predictionReady) {
      handleMultiHandInteraction();
      drawPointers();
      handleResetGesture();
    }

    handleParticles();
    if (gameCleared) drawCelebration();
  }
}

function drawGradientBackground() {
  let c1 = color('#a1c4fd');
  let c2 = color('#c2e9fb');
  for (let y = 0; y <= height; y++) {
    let inter = map(y, 0, height, 0, 1);
    let c = lerpColor(c1, c2, inter);
    stroke(c);
    line(0, y, width, y);
  }
}

function drawCards() {
  rectMode(CENTER);
  textAlign(CENTER, CENTER);

  cards.forEach(card => {
    if (!card.active) return;
    
    let isTargeted = handStatus.some(h => dist(h.pointer.x, h.pointer.y, card.x, card.y) < 70);
    card.hoverScale = lerp(card.hoverScale, isTargeted ? 1.0 : 0, 0.2);

    let shakeX = 0;
    if (card.shakeTimer > 0) {
      shakeX = sin(frameCount * 0.8) * 8;
      card.shakeTimer--;
    }

    push();
    translate(card.x + shakeX, card.y + (card.hoverScale * -8));
    
    noStroke(); 
    fill(0, map(card.hoverScale, 0, 1, 15, 35));
    rect(5 + card.hoverScale*5, 5 + card.hoverScale*5, card.w, card.h, 15);
    
    fill(255); 
    stroke(card.type === 'CH' ? '#ff9a9e' : '#a1c4fd');
    strokeWeight(card.hoverScale * 2 + 2.5);
    rect(0, 0, card.w, card.h, 15);
    
    fill('#333'); noStroke();
    textSize(card.text.length > 5 ? 14 : 18);
    text(card.text, 0, 0);
    pop();
  });
}

function handleMultiHandInteraction() {
  handStatus.forEach((h, index) => {
    if (!handsData[index]) return;

    if (h.isFist && !h.grabbed) {
      for (let card of cards) {
        if (!card.active) continue;
        let alreadyGrabbed = handStatus.some(otherH => otherH.grabbed === card);
        if (!alreadyGrabbed && dist(h.pointer.x, h.pointer.y, card.x, card.y) < 65) {
          h.grabbed = card;
          break;
        }
      }
    }

    if (h.isFist && h.grabbed) {
      h.grabbed.x = lerp(h.grabbed.x, h.pointer.x, 0.3);
      h.grabbed.y = lerp(h.grabbed.y, h.pointer.y, 0.3);
    }

    if (!h.isFist && h.grabbed) {
      checkMatch(h.grabbed);
      h.grabbed = null;
    }
  });
}

function checkMatch(movedCard) {
  for (let other of cards) {
    if (!other.active || other === movedCard) continue;
    
    if (dist(movedCard.x, movedCard.y, other.x, other.y) < 80) {
      if (movedCard.id === other.id && movedCard.type !== other.type) {
        movedCard.active = false;
        other.active = false;
        
        matchedCount += 2; 
        showToast("🎉 成功配對！", "correct");
        
        for(let i=0; i<15; i++) {
          particles.push(new Particle((movedCard.x + other.x)/2, (movedCard.y + other.y)/2));
        }
        break;
      } else if (movedCard.type !== other.type) {
        movedCard.shakeTimer = 20;
        other.shakeTimer = 20;
        showToast("😢 沒對上唷，再試試！", "wrong");
        break;
      }
    }
  }
  
  updateScoreUI();
  if (matchedCount >= 6) gameCleared = true;
}

function updateScoreUI() {
  let scoreSpan = document.getElementById('matched-count');
  if (scoreSpan) scoreSpan.innerText = matchedCount;
}

function handleResetGesture() {
  // 雙手比讚 👍👍
  if (handsData.length >= 2 && handStatus[0].isThumbsUp && handStatus[1].isThumbsUp) {
    resetTimer++;
    
    push();
    noFill(); strokeWeight(8); stroke(255, 255, 255, 100);
    ellipse(width/2, height/2 + 50, 100);
    
    stroke(255, 215, 0); 
    // 120 幀對應 60fps 正好是 2 秒鐘！
    let angle = map(resetTimer, 0, 120, 0, TWO_PI); 
    arc(width/2, height/2 + 50, 100, 100, -HALF_PI, angle - HALF_PI);
    
    textAlign(CENTER, CENTER);
    fill(255); noStroke(); textSize(20);
    text("正在重置遊戲...", width/2, height/2 + 120);
    pop();

    if (resetTimer > 120) { // 滿 2 秒立刻重置
      initGame();
      showToast("🔄 重新挑戰！", "correct");
    }
  } else {
    resetTimer = 0;
  }
}

function drawPointers() {
  handStatus.forEach((h, i) => {
    if (!handsData[i]) return;
    push(); noStroke();
    let baseCol = (i === 0) ? color(114, 237, 242) : color(194, 174, 250);
    
    if (h.isFist) {
      fill(255, 107, 129, 180);
      ellipse(h.pointer.x, h.pointer.y, 45);
    } else if (h.isThumbsUp) {
      fill(255, 215, 0, 200);
      ellipse(h.pointer.x, h.pointer.y, 50);
    } else {
      fill(baseCol.levels[0], baseCol.levels[1], baseCol.levels[2], 150);
      ellipse(h.pointer.x, h.pointer.y, 45);
    }
    fill(255, 240); ellipse(h.pointer.x, h.pointer.y, 15);
    pop();
  });
}

function showToast(text, type) {
  let toast = document.getElementById('toast');
  toast.innerText = text;
  toast.className = `correct ${type}`;
  setTimeout(() => { toast.className = "hidden"; }, 1200);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

class Particle {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = random(-4, 4); this.vy = random(-4, 4);
    this.alpha = 255;
    this.color = color(`hsl(${floor(random(360))}, 100%, 75%)`);
  }
  update() { this.x += this.vx; this.y += this.vy; this.alpha -= 6; }
  draw() {
    push(); noStroke();
    fill(this.color.levels[0], this.color.levels[1], this.color.levels[2], this.alpha);
    ellipse(this.x, this.y, 8); pop();
  }
}

function handleParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update(); particles[i].draw();
    if (particles[i].alpha <= 0) particles.splice(i, 1);
  }
}

function drawCelebration() {
  if (frameCount % 4 === 0) {
    let p = new Particle(random(width), height + 10);
    p.vy = random(-8, -14); p.vx = random(-2, 2);
    particles.push(p);
  }
  push(); textAlign(CENTER, CENTER); fill('#ff4757'); textSize(40);
  text("🏆 成功配對 6 張！挑戰成功 🏆", width/2, height/2); pop();
}