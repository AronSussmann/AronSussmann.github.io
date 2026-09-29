(() => {
  "use strict";
  const canvas = document.getElementById("kirkenes-game");
  if (!canvas) return;
  const portfolio = document.getElementById("portfolio");
  const ctx = canvas.getContext("2d", { alpha: false });
  const W = canvas.width, H = canvas.height, HORIZON = 236, WORLD_END = 2760, GOAL_X = WORLD_END - 176;
  const LOW_Z = 0.035, HIGH_Z = 0.965;
  const scriptBase = new URL("assets/", document.currentScript.src);
  const makeImage = (name) => { const image = new Image(); image.src = new URL(name, scriptBase).href; return image; };
  const art = {
    town: makeImage("kirkenes-snow.png"),
    rotor: makeImage("vindmolle-brawler.png"),
    tobiasActions: makeImage("tobias-actions.png"),
    rotorActions: makeImage("vindmolle-actions.png"),
    aletteActions: makeImage("alette-actions.png"),
    reindeer: makeImage("rein-npc.png")
  };
  const overlay = document.getElementById("game-overlay");
  const overlayKicker = document.getElementById("game-overlay-kicker");
  const overlayTitle = document.getElementById("game-overlay-title");
  const overlayText = document.getElementById("game-overlay-text");
  const overlayButton = document.getElementById("game-overlay-button");
  const livesText = document.getElementById("player-lives");
  const comboText = document.getElementById("combo-readout");
  const scoreText = document.getElementById("score-readout");
  const bossReadout = document.getElementById("boss-readout");
  const soundButton = document.getElementById("sound-toggle");

  const held = { left: false, right: false, up: false, down: false, block: false };
  const wavePlans = {
    1: [{ type: "runner", offset: 0, z: 0.38 }, { type: "drifter", offset: 128, z: 0.70 }],
    2: [{ type: "drifter", offset: 0, z: 0.30 }, { type: "runner", offset: 142, z: 0.62 }, { type: "brute", offset: 278, z: 0.46 }],
    3: [{ type: "brute", offset: 0, z: 0.66 }, { type: "runner", offset: 158, z: 0.35 }, { type: "brute", offset: 306, z: 0.52 }],
    4: [{ type: "boss", offset: 0, z: 0.53 }]
  };
  const enemyStats = {
    runner: { hp: 2, speed: 108, damage: 1, label: "ROTOR-RUSHER", scale: 0.93, windup: 0.50, range: 105, score: 120 },
    drifter: { hp: 3, speed: 68, damage: 1, label: "VINDMØLLEFOLK", scale: 1, windup: 0.64, range: 110, score: 170 },
    brute: { hp: 6, speed: 47, damage: 1, label: "SNØBRØYTER", scale: 1.15, windup: 0.80, range: 125, score: 300 },
    boss: { hp: 20, speed: 67, damage: 2, label: "ALETTE SCHREINER", scale: 1.48, windup: 0.95, range: 178, score: 1500 }
  };

  let state = "ready", player, enemies = [], particles = [], floaters = [], pickups = [];
  let cameraX = 0, currentWave = 1, allCleared = false, score = 0;
  let bestScore = readBest(), gameTime = 0, lastFrame = performance.now();
  let hitStop = 0, shake = 0, flash = 0, stageNotice = { text: "", timer: 0 };
  let bufferedAttack = null, attackBufferTimer = 0;
  let soundOn = true, audioContext = null;
  const weather = [];
  for (let i = 0; i < 68; i += 1) weather.push({ x: (i * 137) % W, y: (i * 79) % H, speed: 25 + (i % 7) * 9, drift: (i % 2 ? 1 : -1) * (5 + i % 6), size: i % 8 === 0 ? 3 : 2 });

  function readBest() {
    try { return Number(localStorage.getItem("kirkenes-beat-em-up-best") || 0); } catch (_) { return 0; }
  }
  function saveBest() {
    try {
      if (score > bestScore) {
        bestScore = score;
        localStorage.setItem("kirkenes-beat-em-up-best", String(bestScore));
      }
    } catch (_) {}
  }
  function zToY(z) { return HORIZON + 18 + z * (H - HORIZON - 25); }
  function scaleAt(z) { return 0.70 + z * 0.48; }
  function screenX(worldX) { return worldX - cameraX; }
  function drawActionFrame(image, row, column, width, height) {
    const cellWidth = image.naturalWidth / 3, cellHeight = image.naturalHeight / 3;
    ctx.drawImage(image, column * cellWidth, row * cellHeight, cellWidth, cellHeight, -width / 2, -height, width, height);
  }
  function drawPlayerLogo(row, column, h, s) {
    const positions = [
      [[0, -0.58], [-0.05, -0.58], [-0.03, -0.58]],
      [[-0.02, -0.59], [-0.12, -0.61], [-0.02, -0.59]],
      [[0, -0.59], [-0.17, -0.60], [-0.07, -0.60]]
    ];
    const [x, y] = positions[row][column];
    ctx.save(); ctx.translate(x * h, y * h);
    if (player.face < 0) ctx.scale(-1, 1);
    ctx.textAlign = "center"; ctx.font = "900 " + Math.max(8, Math.round(10 * s)) + "px ui-monospace, monospace";
    ctx.lineWidth = 2 * s; ctx.strokeStyle = "#59431a"; ctx.fillStyle = "#fff8d6";
    ctx.strokeText("UKA", 0, 4 * s); ctx.fillText("UKA", 0, 4 * s); ctx.restore();
  }

  function createEnemy(type, x, z) {
    const stats = enemyStats[type];
    return { type, x, z, hp: stats.hp, maxHp: stats.hp, speed: stats.speed, damage: stats.damage,
      scale: stats.scale, windup: stats.windup, range: stats.range, label: stats.label, reward: stats.score,
      face: -1, mode: "idle", timer: 0, attackWindup: stats.windup, attackFlash: 0, hurt: 0, knockback: 0, dead: false,
      removeTimer: 0, attackSerial: 0, attackStyle: "punch", lastAttackStyle: "punch", attackPhaseTime: 0, step: 0 };
  }
  function spawnWave(number, firstX) {
    currentWave = number;
    const plan = wavePlans[number], startX = firstX === undefined ? 520 : firstX;
    enemies = plan.map((spec) => createEnemy(spec.type, startX + spec.offset, spec.z));
    notice(number === 4 ? "BOSS: ALETTE SCHREINER" : "BØLGE " + number + " / 4", 2.25);
    updateReadouts();
  }
  function resetGame() {
    player = { x: 144, z: 0.56, face: 1, hp: 10, maxHp: 10, special: 20, attack: null, comboStage: 0,
      comboCount: 0, comboTimer: 0, invulnerable: 2.50, hurt: 0, stun: 0, dashTimer: 0, dashCooldown: 0,
      parry: 0, blocking: false, blockWasDown: false, step: 0, walkPulse: 0, attackFlash: 0 };
    enemies = []; particles = []; floaters = []; pickups = []; cameraX = 0; score = 0;
    currentWave = 1; allCleared = false; hitStop = 0; shake = 0; flash = 0; stageNotice = { text: "", timer: 0 };
    bufferedAttack = null; attackBufferTimer = 0;
    spawnWave(1, 500);
    state = "running"; overlay.hidden = true; clearHeld(); updateReadouts(); canvas.focus({ preventScroll: true });
    initSound(); playTone(440, 0.09, "triangle", 0.035); playTone(660, 0.12, "triangle", 0.025, 0.07);
  }
  function showOverlay(mode) {
    overlay.hidden = false;
    if (mode === "paused") {
      overlayKicker.textContent = "PAUSE · KIRKENES"; overlayTitle.textContent = "Pust ut. Hold garden.";
      overlayText.textContent = "Trykk P eller fortsett-knappen når du er klar."; overlayButton.textContent = "Fortsett";
    } else if (mode === "won") {
      overlayKicker.textContent = "OPPDRAG FULLFØRT"; overlayTitle.textContent = "Reinen er trygg.";
      overlayText.textContent = "Alette Schreiner er slått ut. Du fikk " + score + " poeng" + (score >= bestScore ? " og ny rekord!" : ".") + " Vil du ta en runde til?";
      overlayButton.textContent = "Spill igjen";
    } else if (mode === "lost") {
      overlayKicker.textContent = "GAME OVER"; overlayTitle.textContent = currentWave >= 4 ? "Alette vant runden." : "Vindmøllefolket vant runden.";
      overlayText.textContent = "Prøv å blokkere idet angrepsvarselet blinker, og dash til en bedre posisjon.";
      overlayButton.textContent = "Prøv igjen";
    }
  }
  function pauseGame() {
    if (state === "running") { state = "paused"; clearHeld(); showOverlay("paused"); }
    else if (state === "paused") { state = "running"; overlay.hidden = true; canvas.focus({ preventScroll: true }); }
  }
  function finishGame(won) {
    if (state !== "running") return;
    state = won ? "won" : "lost"; clearHeld();
    if (won) {
      score += 1000; createBurst(GOAL_X, player.z, 34, ["#fff4a7", "#ffcf67", "#b8ffd1", "#ffffff"]);
      showFloater("KIRKENES REDDET!", GOAL_X, player.z, "#b7ffc9", 20); shake = Math.max(shake, 9);
      playTone(520, 0.18, "triangle", 0.045); playTone(780, 0.20, "triangle", 0.035, 0.14); playTone(1040, 0.24, "triangle", 0.03, 0.30);
    }
    saveBest(); updateReadouts(); showOverlay(state);
  }
  function notice(text, duration) { stageNotice.text = text; stageNotice.timer = duration; }
  function updateReadouts() {
    if (!player) return;
    livesText.textContent = player.hp + " / " + player.maxHp;
    comboText.textContent = player.comboCount > 1 ? "x" + player.comboCount : "—";
    scoreText.textContent = String(score);
    const boss = enemies.find((enemy) => enemy.type === "boss" && !enemy.dead);
    bossReadout.hidden = !boss;
    if (boss) bossReadout.querySelector("strong").textContent = boss.hp + " / " + boss.maxHp;
  }
  function initSound() {
    if (!soundOn || audioContext) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    try { audioContext = new AudioCtor(); } catch (_) { audioContext = null; }
  }
  function playTone(frequency, duration, type, volume, delay) {
    if (!soundOn) return;
    initSound();
    if (!audioContext) return;
    const start = audioContext.currentTime + (delay || 0), oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.type = type || "square"; oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume || 0.02, start); gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(start); oscillator.stop(start + duration);
  }
  function sfx(name) {
    if (name === "punch") playTone(185, 0.08, "square", 0.022);
    if (name === "kick") playTone(118, 0.12, "sawtooth", 0.023);
    if (name === "hit") { playTone(330, 0.055, "square", 0.03); playTone(205, 0.10, "triangle", 0.025, 0.035); }
    if (name === "parry") { playTone(760, 0.10, "triangle", 0.038); playTone(1040, 0.14, "triangle", 0.03, 0.07); }
    if (name === "dash") playTone(280, 0.10, "sawtooth", 0.017);
    if (name === "special") { playTone(120, 0.24, "sawtooth", 0.035); playTone(560, 0.22, "triangle", 0.025, 0.07); }
    if (name === "ko") playTone(86, 0.22, "square", 0.025);
    if (name === "pickup") playTone(680, 0.10, "sine", 0.025);
  }
  function clearHeld() {
    held.left = held.right = held.up = held.down = held.block = false;
    if (player) { player.blocking = false; player.blockWasDown = false; }
  }

  function requestAttack(kind) {
    if (state !== "running" || player.dashTimer > 0) return;
    if (kind === "special" && player.special < 45) {
      notice("SPESIALMÅLEREN ER IKKE FULL", 0.9); playTone(150, 0.06, "square", 0.012); return;
    }
    const targetDepth = kind === "special" ? 0.30 : kind === "kick" ? 0.22 : 0.20;
    const targetRange = kind === "special" ? 250 : kind === "kick" ? 190 : 170;
    const target = enemies.filter((enemy) => !enemy.dead && Math.abs(enemy.z - player.z) <= targetDepth && Math.abs(enemy.x - player.x) <= targetRange)
      .sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x))[0];
    if (target && Math.abs(target.x - player.x) > 4) player.face = target.x > player.x ? 1 : -1;
    if (player.stun > 0) { bufferedAttack = kind; attackBufferTimer = 0.42; return; }
    if (kind === "special") {
      player.special -= 45;
      player.attack = { kind: "special", time: 0, windup: 0.16, activeEnd: 0.54, duration: 0.76, damage: 5, range: 236, depth: 0.30, knockback: 240, hit: new Set(), sequence: 0 };
      player.comboStage = 0; player.attackFlash = 0.55; sfx("special"); shake = Math.max(shake, 6); flash = Math.max(flash, 0.15); return;
    }
    const previous = player.attack;
    if (previous && previous.time < previous.duration - 0.13) { bufferedAttack = kind; attackBufferTimer = 0.42; return; }
    bufferedAttack = null; attackBufferTimer = 0;
    if (kind === "punch") {
      player.comboStage = player.comboTimer > 0 ? (player.comboStage % 3) + 1 : 1;
      player.comboTimer = 0.72;
      const stage = player.comboStage;
      player.attack = { kind: "punch", time: 0, windup: stage === 3 ? 0.12 : 0.085,
        activeEnd: stage === 3 ? 0.28 : 0.22, duration: stage === 3 ? 0.49 : 0.37,
        damage: stage === 3 ? 2 : 1, range: stage === 3 ? 142 : 121, depth: 0.18,
        knockback: stage === 3 ? 250 : 150, hit: new Set(), sequence: stage };
      sfx("punch");
    } else {
      player.comboStage = 0; player.comboTimer = 0;
      player.attack = { kind: "kick", time: 0, windup: 0.14, activeEnd: 0.34, duration: 0.53,
        damage: 2, range: 164, depth: 0.20, knockback: 290, hit: new Set(), sequence: 0 };
      sfx("kick");
    }
  }
  function dash() {
    if (state !== "running" || player.dashCooldown > 0 || player.stun > 0) return;
    player.dashTimer = 0.22; player.dashCooldown = 0.72; player.invulnerable = Math.max(player.invulnerable, 0.25);
    if (!held.left && !held.right && !held.up && !held.down) player.x += player.face * 90;
    sfx("dash");
  }
  function nudge(direction) {
    if (state !== "running" || !player) return;
    if (direction === "left") player.x -= 12;
    if (direction === "right") player.x += 12;
    if (direction === "up") player.z -= 0.016;
    if (direction === "down") player.z += 0.016;
    player.x = Math.max(66, Math.min(WORLD_END - 75, player.x));
    player.z = Math.max(LOW_Z, Math.min(HIGH_Z, player.z));
    player.step += 1.25; player.walkPulse = 0.22;
  }
  function spawnWaveAfterClear() {
    if (enemies.some((enemy) => !enemy.dead)) return;
    if (currentWave >= 4) {
      if (!allCleared) { allCleared = true; notice("VEIEN ER ÅPEN · REDD REINEN", 3); score += 600; updateReadouts(); }
      return;
    }
    const next = currentWave + 1;
    if (player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + 2);
      showFloater("+2 LIV", player.x, player.z, "#c0ffc9", 14);
    }
    const base = Math.max(500 + (next - 1) * 215, player.x + 245);
    spawnWave(next, Math.min(base, WORLD_END - 650));
  }
  function attackIsActive(attack) { return attack && attack.time >= attack.windup && attack.time <= attack.activeEnd; }
  function applyPlayerHits() {
    const attack = player.attack;
    if (!attackIsActive(attack)) return;
    for (const enemy of enemies) {
      if (enemy.dead || attack.hit.has(enemy)) continue;
      const dx = enemy.x - player.x, inFront = dx * player.face >= -22;
      if (!inFront || Math.abs(dx) > attack.range * scaleAt(player.z) || Math.abs(enemy.z - player.z) > attack.depth) continue;
      attack.hit.add(enemy); enemy.hp -= attack.damage; enemy.hurt = 0.28; enemy.mode = "stun"; enemy.timer = 0.34;
      enemy.knockback = player.face * attack.knockback; enemy.face = dx >= 0 ? -1 : 1;
      player.special = Math.min(100, player.special + (attack.kind === "special" ? 1 : attack.damage * 9));
      player.comboCount += 1; player.comboTimer = 1.18;
      score += 35 * attack.damage + Math.min(player.comboCount, 15) * 8;
      const color = attack.kind === "special" ? "#ffe58a" : attack.kind === "kick" ? "#ffb18d" : "#f5ffff";
      createBurst(enemy.x, enemy.z, attack.kind === "special" ? 14 : 8, [color, "#8eeeff", "#ffffff"]);
      showFloater(attack.kind === "special" ? "WHAM!" : attack.damage > 1 ? "SMÆKK!" : "POW!", enemy.x, enemy.z, color, attack.kind === "special" ? 17 : 14);
      hitStop = Math.max(hitStop, attack.damage > 1 ? 0.074 : 0.052); shake = Math.max(shake, attack.damage > 1 ? 6.5 : 4);
      sfx("hit"); if (navigator.vibrate) navigator.vibrate(11);
      if (enemy.hp <= 0) defeatEnemy(enemy);
      updateReadouts();
    }
  }
  function defeatEnemy(enemy) {
    enemy.dead = true; enemy.mode = "down"; enemy.removeTimer = enemy.type === "boss" ? 1.3 : 0.84;
    score += enemy.reward; createBurst(enemy.x, enemy.z, enemy.type === "boss" ? 32 : 17, ["#fff3a5", "#ff956d", "#8de6ff", "#ffffff"]);
    showFloater(enemy.type === "boss" ? "BOSS NED!" : "UTSLÅTT", enemy.x, enemy.z, "#fff1a5", 17);
    if (enemy.type === "boss") { shake = Math.max(shake, 12); flash = Math.max(flash, 0.25); }
    if (enemy.type === "brute" || enemy.type === "boss" || Math.random() < 0.23)
      pickups.push({ x: enemy.x, z: enemy.z, type: player.hp < player.maxHp ? "cocoa" : "charge", bob: Math.random() * 6, life: 12 });
    sfx("ko");
  }
  function receiveEnemyHit(enemy, damage) {
    if (player.invulnerable > 0) return;
    if (player.parry > 0 && player.blocking) {
      enemy.mode = "stun"; enemy.timer = 1.15; enemy.knockback = -enemy.face * 280; enemy.hp -= 1;
      player.special = Math.min(100, player.special + 22); score += 180; player.comboCount += 1; player.comboTimer = 1.2;
      createBurst(player.x, player.z, 17, ["#fff29a", "#a9f4ff", "#ffffff"]);
      showFloater("PARRY!", player.x, player.z, "#fff08a", 21);
      hitStop = 0.13; shake = Math.max(shake, 10); sfx("parry");
      if (navigator.vibrate) navigator.vibrate(22);
      if (enemy.hp <= 0) defeatEnemy(enemy);
      updateReadouts(); return;
    }
    const blocked = player.blocking, actualDamage = blocked ? Math.max(0.5, damage * 0.32) : damage;
    player.hp = Math.max(0, player.hp - actualDamage); player.invulnerable = blocked ? 0.72 : 1.42;
    player.hurt = 0.48; player.stun = blocked ? 0.10 : 0.34; player.comboCount = 0; player.comboTimer = 0; player.attack = null;
    player.x += enemy.face * (blocked ? -26 : -54); player.special = Math.min(100, player.special + (blocked ? 4 : 2));
    createBurst(player.x, player.z, blocked ? 6 : 12, blocked ? ["#cbe8ff", "#ffffff"] : ["#ffb29a", "#ffffff", "#ffc85f"]);
    showFloater(blocked ? "GUARD" : "OUCH!", player.x, player.z, blocked ? "#cbe8ff" : "#ffb29a", 14);
    hitStop = blocked ? 0.035 : 0.085; shake = Math.max(shake, blocked ? 3.5 : 8); flash = Math.max(flash, blocked ? 0.04 : 0.16);
    if (!blocked) sfx("hit");
    if (navigator.vibrate) navigator.vibrate(blocked ? 8 : 18);
    updateReadouts(); if (player.hp <= 0) finishGame(false);
  }
  function updateEnemies(dt) {
    for (const enemy of enemies) {
      if (enemy.dead) { enemy.removeTimer -= dt; continue; }
      enemy.hurt = Math.max(0, enemy.hurt - dt); enemy.attackFlash = Math.max(0, enemy.attackFlash - dt);
      enemy.attackPhaseTime = enemy.mode === "tell" || enemy.mode === "recover" ? enemy.attackPhaseTime + dt : 0;
      if (enemy.mode === "approach") enemy.step += dt * 11;
      const dx = player.x - enemy.x, dz = player.z - enemy.z, distance = Math.abs(dx);
      enemy.face = dx < 0 ? -1 : 1;
      if (enemy.mode === "stun") {
        enemy.x += enemy.knockback * dt; enemy.knockback *= Math.exp(-9 * dt); enemy.timer -= dt;
        if (enemy.timer <= 0) enemy.mode = "approach";
        continue;
      }
      if (distance > 350) { enemy.mode = "idle"; continue; }
      if (enemy.mode === "tell") {
        enemy.timer -= dt;
        if (enemy.timer <= 0) {
          const inRange = distance <= enemy.range * scaleAt(enemy.z) && Math.abs(dz) <= (enemy.type === "boss" ? 0.25 : 0.18);
          if (inRange) receiveEnemyHit(enemy, enemy.damage);
          enemy.mode = "recover"; enemy.timer = enemy.type === "boss" ? (enemy.hp < enemy.maxHp * 0.48 ? 0.70 : 1.12) : 0.96;
          enemy.lastAttackStyle = enemy.attackStyle; enemy.attackPhaseTime = 0;
          enemy.attackSerial += 1;
        }
        continue;
      }
      if (enemy.mode === "recover") { enemy.timer -= dt; if (enemy.timer <= 0) enemy.mode = "approach"; continue; }
      const engageDistance = enemy.range * scaleAt(enemy.z) * 0.82;
      if (distance < engageDistance && Math.abs(dz) < 0.19) {
        enemy.mode = "tell";
        enemy.attackStyle = enemy.attackSerial % 2 === 0 ? "punch" : "kick";
        enemy.attackPhaseTime = 0;
        enemy.attackWindup = enemy.type === "boss" && enemy.hp < enemy.maxHp * 0.48 ? 0.58 : enemy.windup;
        enemy.timer = enemy.attackWindup;
        enemy.attackFlash = enemy.timer; continue;
      }
      enemy.mode = "approach";
      const moveX = distance > engageDistance * 0.72 ? Math.sign(dx) : 0;
      if (Math.abs(dz) > 0.09) enemy.z += Math.sign(dz) * Math.min(Math.abs(dz), (enemy.type === "boss" ? 0.38 : 0.46) * dt);
      const enrage = enemy.type === "boss" && enemy.hp < enemy.maxHp * 0.48 ? 1.32 : 1;
      enemy.x += moveX * enemy.speed * enrage * dt;
      enemy.x = Math.max(66, Math.min(WORLD_END - 260, enemy.x));
    }
  }
  function updatePickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i -= 1) {
      const item = pickups[i]; item.bob += dt * 4; item.life -= dt;
      if (Math.abs(item.x - player.x) < 48 && Math.abs(item.z - player.z) < 0.14) {
        if (item.type === "cocoa") player.hp = Math.min(player.maxHp, player.hp + 1);
        else player.special = Math.min(100, player.special + 28);
        score += 100; createBurst(item.x, item.z, 10, ["#b7ffd0", "#fff2a4", "#ffffff"]);
        showFloater(item.type === "cocoa" ? "+1 LIV" : "+SPESIAL", item.x, item.z, "#c0ffc9", 13);
        sfx("pickup"); pickups.splice(i, 1); updateReadouts();
      } else if (item.life <= 0) pickups.splice(i, 1);
    }
  }

  function update(dt) {
    if (state !== "running") return;
    if (hitStop > 0) { hitStop = Math.max(0, hitStop - dt); return; }
    gameTime += dt; stageNotice.timer = Math.max(0, stageNotice.timer - dt);
    flash = Math.max(0, flash - dt * 1.9); shake = Math.max(0, shake - dt * 16);
    player.invulnerable = Math.max(0, player.invulnerable - dt); player.hurt = Math.max(0, player.hurt - dt);
    player.stun = Math.max(0, player.stun - dt); player.dashTimer = Math.max(0, player.dashTimer - dt);
    player.walkPulse = Math.max(0, player.walkPulse - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt); player.parry = Math.max(0, player.parry - dt);
    player.attackFlash = Math.max(0, player.attackFlash - dt); player.comboTimer = Math.max(0, player.comboTimer - dt);
    attackBufferTimer = Math.max(0, attackBufferTimer - dt);
    if (player.comboTimer <= 0) player.comboCount = 0;

    const wantsBlock = held.block && player.stun <= 0 && player.dashTimer <= 0;
    player.blocking = wantsBlock;
    if (wantsBlock && !player.blockWasDown) { player.parry = 0.23; playTone(390, 0.045, "triangle", 0.012); }
    player.blockWasDown = wantsBlock;
    if (player.attack) { player.attack.time += dt; if (player.attack.time > player.attack.duration) player.attack = null; }

    if (player.stun <= 0) {
      let ax = Number(held.right) - Number(held.left), az = Number(held.down) - Number(held.up);
      const length = Math.hypot(ax, az) || 1; ax /= length; az /= length;
      if (ax !== 0) player.face = ax > 0 ? 1 : -1;
      if (player.dashTimer > 0) {
        if (ax === 0 && az === 0) ax = player.face;
        player.x += ax * 560 * dt; player.z += az * 0.72 * dt;
      } else if (player.blocking) {
        player.x += ax * 76 * dt; player.z += az * 0.24 * dt;
      } else if (!player.attack || player.attack.time < player.attack.windup) {
        player.x += ax * 235 * dt; player.z += az * 0.58 * dt;
      } else {
        player.x += ax * 82 * dt; player.z += az * 0.22 * dt;
      }
      if (ax !== 0 || az !== 0) player.step += dt * (player.dashTimer > 0 ? 22 : 11);
    }
    player.x = Math.max(66, Math.min(WORLD_END - 75, player.x));
    player.z = Math.max(LOW_Z, Math.min(HIGH_Z, player.z));

    applyPlayerHits(); updateEnemies(dt); updatePickups(dt); spawnWaveAfterClear();
    if (bufferedAttack && attackBufferTimer > 0 && player.stun <= 0 && player.dashTimer <= 0 && (!player.attack || player.attack.time >= player.attack.duration - 0.13)) {
      const nextAttack = bufferedAttack; bufferedAttack = null; requestAttack(nextAttack);
    }
    if (attackBufferTimer <= 0) bufferedAttack = null;
    for (const p of particles) { p.x += p.vx * dt; p.z += p.vz * dt; p.lift += p.vy * dt; p.vy -= p.gravity * dt; p.life -= dt; }
    particles = particles.filter((p) => p.life > 0);
    for (const f of floaters) { f.lift += f.speed * dt; f.life -= dt; }
    floaters = floaters.filter((f) => f.life > 0);
    for (const flake of weather) {
      flake.x += flake.drift * dt; flake.y += flake.speed * dt;
      if (flake.y > H) { flake.y = -5; flake.x = (flake.x + 113) % W; }
      if (flake.x < -4) flake.x = W + 2;
      if (flake.x > W + 4) flake.x = -2;
    }
    const cameraTarget = Math.max(0, Math.min(WORLD_END - W, player.x - W * 0.40));
    cameraX += (cameraTarget - cameraX) * Math.min(1, dt * 6.5);
    if (allCleared && Math.abs(player.x - GOAL_X) < 62 && Math.abs(player.z - 0.58) < 0.22) finishGame(true);
    updateReadouts();
  }

  function makePath(points, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath(); ctx.fill();
  }
  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 75);
    sky.addColorStop(0, "#4f88c6"); sky.addColorStop(0.62, "#a8cde3"); sky.addColorStop(1, "#d9e9ef");
    ctx.fillStyle = sky; ctx.fillRect(-20, -20, W + 40, H + 40);
    const tileW = 1086, tileH = 362, offset = (cameraX * 0.115) % tileW;
    if (art.town.complete && art.town.naturalWidth) {
      for (let x = -offset; x < W + 10; x += tileW) ctx.drawImage(art.town, x, -15, tileW, tileH);
    } else { ctx.fillStyle = "#7696b1"; ctx.fillRect(0, HORIZON - 80, W, 145); }
    ctx.fillStyle = "#edf6f6"; ctx.fillRect(0, HORIZON + 20, W, H - HORIZON - 20);
    makePath([[0, HORIZON + 28], [W * 0.44, HORIZON + 13], [W * 0.57, HORIZON + 13], [W, HORIZON + 27], [W, H], [0, H]], "#daeaf0");
    makePath([[W * 0.425, HORIZON + 20], [W * 0.575, HORIZON + 20], [W * 1.05, H + 15], [-W * 0.05, H + 15]], "#b9d5e1");
    makePath([[W * 0.455, HORIZON + 20], [W * 0.545, HORIZON + 20], [W * 0.83, H + 10], [W * 0.17, H + 10]], "rgba(242,250,252,.78)");
    ctx.lineWidth = 2;
    for (let i = -5; i <= 5; i += 1) {
      ctx.strokeStyle = i === 0 ? "rgba(255,255,255,.30)" : "rgba(95,135,156,.14)";
      ctx.beginPath(); ctx.moveTo(W / 2 + i * 13, HORIZON + 23); ctx.lineTo(W / 2 + i * 146, H + 5); ctx.stroke();
    }
    for (let i = 1; i <= 6; i += 1) {
      const z = i / 7, y = zToY(z);
      ctx.strokeStyle = i % 2 ? "rgba(255,255,255,.30)" : "rgba(91,134,153,.13)"; ctx.lineWidth = 1 + z * 1.1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,.40)"; ctx.fillRect(0, H - 19, W, 3);
    ctx.fillStyle = "rgba(87,127,148,.16)"; ctx.fillRect(0, H - 16, W, 2);
  }
  function drawPine(worldX, z, tint) {
    const x = screenX(worldX); if (x < -90 || x > W + 90) return;
    const foot = zToY(z), size = 34 * scaleAt(z);
    ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = "#514e4a"; ctx.fillRect(x - size * 0.08, foot - size * 0.15, size * 0.16, size * 0.15);
    for (let i = 0; i < 4; i += 1) {
      const y = foot - size * (0.30 + i * 0.17), half = size * (0.18 + (3 - i) * 0.045);
      makePath([[x, y - size * 0.22], [x - half, y + size * 0.12], [x + half, y + size * 0.12]], tint || "#244f4a");
      ctx.fillStyle = "rgba(239,250,252,.78)"; ctx.fillRect(x - half * 0.62, y + size * 0.035, half * 1.15, size * 0.035);
    }
    ctx.restore();
  }
  function drawStreetLamp(worldX, z) {
    const x = screenX(worldX); if (x < -40 || x > W + 40) return;
    const foot = zToY(z), s = scaleAt(z);
    ctx.fillStyle = "#354d56"; ctx.fillRect(x - 2 * s, foot - 52 * s, 4 * s, 52 * s); ctx.fillRect(x - 8 * s, foot - 54 * s, 16 * s, 3 * s);
    ctx.fillStyle = "#ffe3a2"; ctx.fillRect(x - 4 * s, foot - 62 * s, 8 * s, 8 * s);
    ctx.fillStyle = "rgba(255,228,160,.19)"; ctx.beginPath(); ctx.arc(x, foot - 58 * s, 17 * s, 0, Math.PI * 2); ctx.fill();
  }
  function drawReindeer() {
    const x = screenX(GOAL_X), z = 0.58, y = zToY(z), s = scaleAt(z);
    ctx.fillStyle = allCleared ? "rgba(85,140,93,.2)" : "rgba(38,59,63,.33)"; ctx.fillRect(x - 56 * s, y - 2 * s, 112 * s, 18 * s);
    if (art.reindeer.complete && art.reindeer.naturalWidth) {
      const rw = 90 * s, rh = rw * (art.reindeer.naturalHeight / art.reindeer.naturalWidth), bob = allCleared ? Math.sin(gameTime * 5) * 2 : 0;
      ctx.drawImage(art.reindeer, x - rw / 2, y - rh + bob, rw, rh);
    } else {
      ctx.fillStyle = "#9c6a43"; ctx.fillRect(x - 20 * s, y - 39 * s, 40 * s, 30 * s); ctx.fillRect(x + 9 * s, y - 56 * s, 24 * s, 22 * s);
      ctx.fillStyle = "#d9b58a"; ctx.fillRect(x + 14 * s, y - 48 * s, 16 * s, 8 * s);
    }
    if (allCleared) {
      ctx.fillStyle = "#fff0a4"; ctx.font = "bold 10px ui-monospace, monospace"; ctx.textAlign = "center";
      ctx.fillText("GÅ HIT FOR Å REDDE REINEN", x, y - 119 * s);
    }
  }
  function drawEnemy(enemy) {
    if (enemy.dead && enemy.removeTimer <= 0) return;
    const x = screenX(enemy.x), foot = zToY(enemy.z), s = scaleAt(enemy.z) * enemy.scale;
    const h = (enemy.type === "boss" ? 196 : 174) * s, w = h * 0.835;
    const bob = enemy.mode === "approach" ? Math.abs(Math.sin(enemy.step)) * 2.2 * s : 0;
    const tellShake = enemy.mode === "tell" ? Math.sin(gameTime * 42) * 2.8 * s : 0;
    const fall = enemy.dead ? (1 - Math.max(0, enemy.removeTimer) / (enemy.type === "boss" ? 1.3 : 0.84)) : 0;
    ctx.save(); ctx.globalAlpha = enemy.dead ? Math.max(0, 1 - fall * 1.15) : 1;
    ctx.translate(x + tellShake, foot - bob + fall * 18 * s); ctx.scale(enemy.face > 0 ? -1 : 1, 1);
    if (enemy.mode === "tell" && !enemy.dead) {
      ctx.fillStyle = "rgba(247,87,61,.17)"; ctx.beginPath(); ctx.ellipse(0, -7 * s, enemy.range * 0.62 * s, 14 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ff775c"; ctx.font = "900 " + Math.round(15 * s) + "px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.fillText("!", 0, -h - 8 * s);
    }
    if (enemy.hurt > 0 && Math.floor(gameTime * 32) % 2 === 0) ctx.globalAlpha *= 0.42;
    const actionArt = enemy.type === "boss" ? art.aletteActions : art.rotorActions;
    if (actionArt.complete && actionArt.naturalWidth) {
      let row = 0, column = 0;
      if (enemy.mode === "tell") {
        row = enemy.attackStyle === "kick" ? 2 : 1;
        column = enemy.attackPhaseTime > enemy.attackWindup * 0.68 ? 1 : 0;
      } else if (enemy.mode === "recover") {
        row = enemy.lastAttackStyle === "kick" ? 2 : 1;
        column = enemy.attackPhaseTime < 0.16 ? 1 : 2;
      } else if (!enemy.dead && enemy.mode === "approach") {
        column = 1 + (Math.floor(enemy.step / Math.PI) % 2);
      }
      drawActionFrame(actionArt, row, column, h * 1.04, h);
    } else if (enemy.type !== "boss" && art.rotor.complete && art.rotor.naturalWidth) ctx.drawImage(art.rotor, -w / 2, -h, w, h);
    else if (enemy.type === "boss") {
      ctx.fillStyle = "#33302e"; ctx.fillRect(-w * 0.30, -h * 0.78, w * 0.60, h * 0.68);
      ctx.fillStyle = "#d5b394"; ctx.fillRect(-w * 0.18, -h * 1.02, w * 0.36, h * 0.27);
      ctx.fillStyle = "#343234"; ctx.fillRect(-w * 0.22, -h * 1.10, w * 0.44, h * 0.13);
      ctx.fillStyle = "#dbe6e2"; ctx.fillRect(-w * 0.11, -h * 0.91, w * 0.08, h * 0.035); ctx.fillRect(w * 0.03, -h * 0.91, w * 0.08, h * 0.035);
    } else {
      ctx.fillStyle = "#086174"; ctx.fillRect(-w * 0.33, -h * 0.74, w * 0.66, h * 0.48);
      ctx.fillStyle = "#eeeeec"; ctx.fillRect(-w * 0.15, -h * 0.98, w * 0.30, h * 0.27); ctx.fillRect(-w * 0.045, -h * 1.2, w * 0.09, h * 0.19);
    }
    if (enemy.type === "boss" && !enemy.dead) {
      ctx.restore(); drawBar(x, foot - h - 8, 80 * scaleAt(enemy.z), 6, enemy.hp / enemy.maxHp, "#ee6955", "rgba(14,26,32,.75)");
      ctx.fillStyle = "#fff1dc"; ctx.font = "bold 9px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.fillText("ALETTE SCHREINER", x, foot - h - 14); return;
    }
    if (!enemy.dead && enemy.hp < enemy.maxHp) {
      ctx.restore(); drawBar(x, foot - h - 7, 38 * scaleAt(enemy.z), 4, enemy.hp / enemy.maxHp, "#f18870", "rgba(14,26,32,.7)"); return;
    }
    ctx.restore();
  }
  function drawPlayer() {
    const foot = zToY(player.z), s = scaleAt(player.z), h = 214 * s;
    const walking = held.left || held.right || held.up || held.down || player.walkPulse > 0;
    const bob = walking ? Math.abs(Math.sin(player.step)) * 2.3 * s : Math.sin(gameTime * 2.2) * 1.1 * s;
    const attack = player.attack;
    let row = 0, column = 0;
    if (attack && attack.time < attack.duration && (attack.kind === "punch" || attack.kind === "kick")) {
      row = attack.kind === "kick" ? 2 : 1;
      column = attack.time < attack.windup ? 0 : attack.time <= attack.activeEnd ? 1 : 2;
    } else if (walking) column = 1 + (Math.floor(player.step / Math.PI) % 2);
    const hiddenFlash = player.invulnerable > 0 && Math.floor(gameTime * 24) % 2 === 0;
    if (!hiddenFlash) {
      ctx.save(); ctx.translate(screenX(player.x), foot + bob); ctx.scale(player.face < 0 ? -1 : 1, 1);
      if (art.tobiasActions.complete && art.tobiasActions.naturalWidth) {
        drawActionFrame(art.tobiasActions, row, column, h * 1.12, h);
        drawPlayerLogo(row, column, h, s);
      } else {
        ctx.fillStyle = "#e8b900"; ctx.fillRect(-h * 0.28, -h * 0.75, h * 0.56, h * 0.38);
        ctx.fillStyle = "#34221d"; ctx.fillRect(-h * 0.20, -h, h * 0.40, h * 0.24);
        ctx.fillStyle = "#255c85"; ctx.fillRect(-h * 0.26, -h * 0.37, h * 0.52, h * 0.28);
      }
      ctx.restore();
    }
    if (player.blocking) {
      ctx.strokeStyle = player.parry > 0 ? "rgba(255,240,135,.94)" : "rgba(153,213,255,.78)"; ctx.lineWidth = player.parry > 0 ? 3 : 2;
      ctx.beginPath(); ctx.arc(screenX(player.x), foot - h * 0.60, 40 * s, -1.2, 1.2); ctx.stroke();
    }
    if (player.dashTimer > 0) for (let i = 1; i <= 3; i += 1) {
      ctx.fillStyle = "rgba(202,239,255," + (0.35 - i * 0.07) + ")";
      ctx.fillRect(screenX(player.x) - player.face * i * 12 * s - 2, foot - 20 * s, 5 * s, 3 * s);
    }
  }
  function drawBar(cx, y, width, height, ratio, color, back) {
    ctx.fillStyle = back; ctx.fillRect(cx - width / 2, y, width, height);
    ctx.fillStyle = color; ctx.fillRect(cx - width / 2 + 1, y + 1, Math.max(0, (width - 2) * ratio), height - 2);
  }
  function drawPickups() {
    for (const item of pickups) {
      const x = screenX(item.x), y = zToY(item.z) - 22 - Math.sin(item.bob) * 5;
      ctx.fillStyle = "rgba(14,28,35,.76)"; ctx.fillRect(x - 11, y - 10, 22, 22);
      ctx.fillStyle = item.type === "cocoa" ? "#ffcf8e" : "#99e8ff"; ctx.fillRect(x - 8, y - 7, 16, 16);
      ctx.fillStyle = "#29454b"; ctx.font = "bold 12px ui-monospace, monospace"; ctx.textAlign = "center";
      ctx.fillText(item.type === "cocoa" ? "+" : "✦", x, y + 6);
    }
  }
  function createBurst(x, z, count, colors) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.PI * 2 * i / count + Math.random() * 0.6, speed = 35 + Math.random() * 175;
      particles.push({ x, z, lift: 28 + Math.random() * 95, vx: Math.cos(angle) * speed,
        vz: Math.sin(angle) * speed / 260, vy: 20 + Math.random() * 140, gravity: 280 + Math.random() * 180,
        life: 0.34 + Math.random() * 0.5, maxLife: 0.84, size: 2 + Math.random() * 5, color: colors[i % colors.length] });
    }
  }
  function showFloater(text, x, z, color, size) { floaters.push({ text, x, z, lift: 108, speed: 38, life: 0.74, maxLife: 0.74, color, size: size || 14 }); }
  function drawEffects() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife); ctx.fillStyle = p.color;
      const x = screenX(p.x), y = zToY(p.z) - p.lift, size = p.size * (0.55 + p.life / p.maxLife * 0.55);
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    for (const f of floaters) {
      ctx.globalAlpha = Math.min(1, f.life / 0.19); ctx.fillStyle = "rgba(10,24,28,.78)";
      ctx.font = "900 " + f.size + "px ui-monospace, monospace"; ctx.textAlign = "center";
      const x = screenX(f.x), y = zToY(f.z) - f.lift; ctx.fillText(f.text, x + 1, y + 2);
      ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
    }
    ctx.globalAlpha = 1;
  }
  function drawHud() {
    ctx.fillStyle = "rgba(3,15,21,.97)"; ctx.fillRect(15, 14, 330, 112);
    ctx.strokeStyle = "rgba(235,248,241,.68)"; ctx.lineWidth = 2; ctx.strokeRect(16, 15, 328, 110);
    ctx.fillStyle = "#c8ffdb"; ctx.font = "900 19px ui-monospace, monospace"; ctx.textAlign = "left";
    ctx.fillText("TOBIAS  //  KIRKENES", 28, 38); ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px ui-monospace, monospace"; ctx.fillText("LIV", 28, 62);
    for (let i = 0; i < player.maxHp; i += 1) {
      ctx.fillStyle = i < player.hp ? "#ff9d8b" : "#52636a"; ctx.fillRect(63 + i * 22, 47, 17, 15);
      if (i < player.hp) { ctx.fillStyle = "#fff0e9"; ctx.fillRect(66 + i * 22, 49, 6, 4); }
    }
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px ui-monospace, monospace"; ctx.fillText("SPESIAL", 28, 97);
    ctx.fillStyle = "rgba(255,255,255,.24)"; ctx.fillRect(112, 83, 167, 15);
    ctx.fillStyle = player.special >= 45 ? "#f4cc69" : "#69d5f0"; ctx.fillRect(114, 85, 163 * (player.special / 100), 11);
    ctx.fillStyle = "#ffffff"; ctx.font = "900 15px ui-monospace, monospace"; ctx.fillText(Math.floor(player.special) + "%", 286, 97);
    ctx.fillStyle = "rgba(3,15,21,.97)"; ctx.fillRect(W - 207, 14, 192, 55); ctx.strokeStyle = "rgba(235,248,241,.68)"; ctx.strokeRect(W - 206, 15, 190, 53);
    ctx.fillStyle = "#ffffff"; ctx.font = "900 17px ui-monospace, monospace"; ctx.textAlign = "right"; ctx.fillText("BØLGE " + Math.min(currentWave, 4) + " / 4", W - 27, 37);
    ctx.fillStyle = "#e2eee9"; ctx.font = "bold 15px ui-monospace, monospace"; ctx.fillText(String(score).padStart(6, "0") + " P", W - 27, 58);
    const boss = enemies.find((enemy) => enemy.type === "boss" && !enemy.dead);
    if (boss) {
      ctx.fillStyle = "rgba(3,15,21,.97)"; ctx.fillRect(W / 2 - 220, 14, 440, 51);
      ctx.strokeStyle = "rgba(235,248,241,.68)"; ctx.strokeRect(W / 2 - 219, 15, 438, 49);
      ctx.fillStyle = "#ffffff"; ctx.font = "900 17px ui-monospace, monospace"; ctx.textAlign = "center";
      ctx.fillText("ALETTE SCHREINER" + (boss.hp < boss.maxHp * 0.48 ? " · RASER" : ""), W / 2, 35);
      drawBar(W / 2, 45, 410, 11, boss.hp / boss.maxHp, boss.hp < boss.maxHp * 0.48 ? "#ff755f" : "#ecaf62", "#29383b");
    }
    if (player.comboCount > 1 && player.comboTimer > 0) {
      ctx.textAlign = "center"; ctx.font = "900 19px ui-monospace, monospace"; ctx.fillStyle = "rgba(18,31,34,.85)";
      ctx.fillText("KOMBO x" + player.comboCount, W / 2 + 1, 93); ctx.fillStyle = "#fff0a2"; ctx.fillText("KOMBO x" + player.comboCount, W / 2, 91);
    }
    if (stageNotice.timer > 0) {
      ctx.globalAlpha = Math.min(1, stageNotice.timer * 2); ctx.fillStyle = "rgba(12,25,30,.83)"; ctx.fillRect(W / 2 - 182, H - 49, 364, 30);
      ctx.fillStyle = "#eaf7ee"; ctx.font = "900 14px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.fillText(stageNotice.text, W / 2, H - 30); ctx.globalAlpha = 1;
    }
  }
  function drawWeather() {
    ctx.fillStyle = "rgba(255,255,255,.78)";
    for (const flake of weather) ctx.fillRect(Math.round(flake.x), Math.round(flake.y), flake.size, flake.size);
  }
  function render() {
    ctx.save();
    const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0, sy = shake > 0 ? (Math.random() - 0.5) * shake * 0.7 : 0;
    ctx.translate(sx, sy); drawBackground();
    for (let i = 0; i < 10; i += 1) drawPine(i * 344 + 108, 0.13 + (i % 3) * 0.025, i % 2 ? "#315e57" : "#244e52");
    for (let i = 0; i < 9; i += 1) drawStreetLamp(i * 405 + 205, 0.30 + (i % 2) * 0.46);
    const drawables = enemies.filter((enemy) => !enemy.dead || enemy.removeTimer > 0).map((enemy) => ({ z: enemy.z, type: "enemy", value: enemy }));
    drawables.push({ z: 0.58, type: "reindeer", value: null });
    drawables.push({ z: player.z, type: "player", value: player }); drawables.sort((a, b) => a.z - b.z);
    for (const d of drawables) {
      if (d.type === "enemy") drawEnemy(d.value);
      else if (d.type === "player") drawPlayer();
      else drawReindeer();
    }
    drawPickups(); drawEffects(); drawHud(); drawWeather();
    if (flash > 0) { ctx.fillStyle = "rgba(255,242,201," + Math.min(0.28, flash) + ")"; ctx.fillRect(-10, -10, W + 20, H + 20); }
    ctx.restore();
  }
  function frame(now) {
    const dt = Math.min(0.04, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now;
    if (portfolio.hidden) { window.requestAnimationFrame(frame); return; }
    if (state === "running") update(dt);
    if (state === "ready") {
      player = player || { x: 144, z: 0.56, face: 1, hp: 10, maxHp: 10, special: 20, comboCount: 0, comboTimer: 0, invulnerable: 0, dashTimer: 0, blocking: false, parry: 0, step: 0 };
      if (!enemies.length) enemies = [createEnemy("runner", 520, 0.42), createEnemy("drifter", 650, 0.69)];
    }
    render(); window.requestAnimationFrame(frame);
  }
  function onKeyDown(event) {
    if (portfolio.hidden) return;
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key)) event.preventDefault();
    if (key === "p" || key === "escape") { if (!event.repeat) pauseGame(); return; }
    if (state !== "running") return;
    if (key === "arrowleft" || key === "a") { held.left = true; if (!event.repeat) nudge("left"); }
    if (key === "arrowright" || key === "d") { held.right = true; if (!event.repeat) nudge("right"); }
    if (key === "arrowup" || key === "w") { held.up = true; if (!event.repeat) nudge("up"); }
    if (key === "arrowdown" || key === "s") { held.down = true; if (!event.repeat) nudge("down"); }
    if (!event.repeat && (key === "j" || key === "z")) requestAttack("punch");
    if (!event.repeat && (key === "k" || key === "x")) requestAttack("kick");
    if (!event.repeat && (key === "c" || key === "l")) requestAttack("special");
    if (!event.repeat && key === " ") dash();
    if (key === "b") held.block = true;
  }
  function onKeyUp(event) {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") held.left = false;
    if (key === "arrowright" || key === "d") held.right = false;
    if (key === "arrowup" || key === "w") held.up = false;
    if (key === "arrowdown" || key === "s") held.down = false;
    if (key === "b") held.block = false;
  }
  overlayButton.addEventListener("click", () => { if (state === "paused") pauseGame(); else resetGame(); });
  soundButton.addEventListener("click", () => {
    soundOn = !soundOn; soundButton.textContent = soundOn ? "LYD: PÅ" : "LYD: AV";
    soundButton.setAttribute("aria-pressed", String(soundOn));
    if (soundOn) { initSound(); playTone(520, 0.08, "triangle", 0.025); }
  });
  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp); window.addEventListener("blur", clearHeld);
  document.querySelectorAll("[data-hold]").forEach((button) => {
    const name = button.dataset.hold;
    button.addEventListener("pointerdown", (event) => { event.preventDefault(); held[name] = true; nudge(name); button.setPointerCapture(event.pointerId); });
    const release = () => { held[name] = false; };
    button.addEventListener("pointerup", release); button.addEventListener("pointercancel", release); button.addEventListener("lostpointercapture", release);
  });
  document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "punch") requestAttack("punch");
    if (action === "kick") requestAttack("kick");
    if (action === "special") requestAttack("special");
    if (action === "dash") dash();
  }));
  player = { x: 144, z: 0.56, face: 1, hp: 10, maxHp: 10, special: 20, comboCount: 0, comboTimer: 0, invulnerable: 0, dashTimer: 0, blocking: false, parry: 0, step: 0 };
  enemies = [createEnemy("runner", 520, 0.42), createEnemy("drifter", 650, 0.69)];
  updateReadouts(); window.requestAnimationFrame(frame);
})();
