(() => {
  "use strict";

  const canvas = document.getElementById("kirkenes-game");
  if (!canvas) return;

  const context = canvas.getContext("2d", { alpha: false });
  const width = canvas.width;
  const height = canvas.height;
  const ground = 420;
  const worldWidth = 1620;
  const spriteSize = 264;
  const background = new Image();
  const rider = new Image();
  background.src = "assets/kirkenes-snow.png";
  rider.src = "assets/tobias-rein.png";
  context.imageSmoothingEnabled = false;

  const overlay = document.getElementById("game-overlay");
  const portfolio = document.getElementById("portfolio");
  const overlayKicker = document.getElementById("game-overlay-kicker");
  const overlayTitle = document.getElementById("game-overlay-title");
  const overlayText = document.getElementById("game-overlay-text");
  const overlayButton = document.getElementById("game-overlay-button");
  const livesDisplay = document.getElementById("reindeer-lives");
  const scoreDisplay = document.getElementById("windmill-score");

  const input = { left: false, right: false };
  let projectiles = [];
  let windmills = [];
  let player;
  let cameraX = 0;
  let elapsed = 0;
  let running = false;
  let lives = 3;
  let defeated = 0;
  let lastFrame = performance.now();

  function resetWindmills() {
    return [
      { x: 500, hp: 2, damageDone: false, destroyed: false },
      { x: 760, hp: 2, damageDone: false, destroyed: false },
      { x: 1030, hp: 2, damageDone: false, destroyed: false },
      { x: 1320, hp: 2, damageDone: false, destroyed: false },
    ];
  }

  function updateHud() {
    livesDisplay.textContent = `${"♥ ".repeat(lives)}${"♡ ".repeat(3 - lives)}`.trim();
    scoreDisplay.textContent = `${defeated} / ${windmills.length}`;
  }

  function startGame() {
    player = {
      x: 155,
      jumpHeight: 0,
      jumpVelocity: 0,
      facing: 1,
      throwCooldown: 0,
      hurtTimer: 0,
      stride: 0,
    };
    cameraX = 0;
    projectiles = [];
    windmills = resetWindmills();
    lives = 3;
    defeated = 0;
    running = true;
    input.left = false;
    input.right = false;
    overlay.hidden = true;
    updateHud();
    canvas.focus({ preventScroll: true });
  }

  function finishGame(won) {
    if (!running) return;
    running = false;
    input.left = false;
    input.right = false;
    overlay.hidden = false;
    overlayKicker.textContent = won ? "KIRKENES · NIVÅ FULLFØRT" : "KIRKENES · GAME OVER";
    overlayTitle.textContent = won ? "Vindmøllene er nede!" : lives === 0 ? "Vindmølla tok reinen." : "Oppdraget er ikke ferdig.";
    overlayText.textContent = won
      ? "Tobias og reinen reddet Kirkenes. Budsjettet kan puste ut."
      : lives === 0
        ? "Ingen dramatikk vist — bare et spill over. Hopp over bladene, og kast snøballer før du prøver igjen."
        : `Du kom deg gjennom, men ${windmills.length - defeated} vindmølle(r) står fortsatt. Ta en ny runde!`;
    overlayButton.textContent = "Spill igjen";
  }

  function jump() {
    if (!running || player.jumpHeight > 0) return;
    player.jumpVelocity = 485;
  }

  function throwSnowball() {
    if (!running || player.throwCooldown > 0) return;
    player.throwCooldown = 0.38;
    projectiles.push({
      x: player.x + player.facing * 78,
      y: ground - 130 - player.jumpHeight,
      vx: player.facing * 520,
    });
  }

  function update(delta) {
    elapsed += delta;
    if (!running) return;

    const direction = Number(input.right) - Number(input.left);
    if (direction !== 0) {
      player.facing = direction;
      player.x += direction * 220 * delta;
      player.stride += delta * 12;
    }
    player.x = Math.max(115, Math.min(worldWidth - 75, player.x));
    player.jumpHeight += player.jumpVelocity * delta;
    if (player.jumpHeight > 0 || player.jumpVelocity > 0) {
      player.jumpVelocity -= 1120 * delta;
      if (player.jumpHeight <= 0) {
        player.jumpHeight = 0;
        player.jumpVelocity = 0;
      }
    }
    player.throwCooldown = Math.max(0, player.throwCooldown - delta);
    player.hurtTimer = Math.max(0, player.hurtTimer - delta);

    const cameraTarget = Math.max(0, Math.min(worldWidth - width, player.x - width * 0.3));
    cameraX += (cameraTarget - cameraX) * Math.min(1, delta * 5);

    for (const windmill of windmills) {
      if (windmill.destroyed) continue;
      if (Math.abs(player.x - windmill.x) < 80 && player.jumpHeight < 60 && !windmill.damageDone && player.hurtTimer <= 0) {
        windmill.damageDone = true;
        player.hurtTimer = 1.15;
        lives = Math.max(0, lives - 1);
        updateHud();
        if (lives === 0) finishGame(false);
      }
    }

    for (let index = projectiles.length - 1; index >= 0; index -= 1) {
      const snowball = projectiles[index];
      snowball.x += snowball.vx * delta;
      const target = windmills.find((windmill) => !windmill.destroyed && Math.abs(snowball.x - windmill.x) < 34 && Math.abs(snowball.y - (ground - 116)) < 105);
      if (target) {
        target.hp -= 1;
        projectiles.splice(index, 1);
        if (target.hp <= 0) {
          target.destroyed = true;
          defeated += 1;
          updateHud();
        }
      } else if (snowball.x < cameraX - 30 || snowball.x > cameraX + width + 70) {
        projectiles.splice(index, 1);
      }
    }

    if (player.x >= worldWidth - 105) finishGame(defeated === windmills.length);
  }

  function drawBackground() {
    context.fillStyle = "#8db4e8";
    context.fillRect(0, 0, width, height);
    if (background.complete && background.naturalWidth > 0) {
      context.drawImage(background, -Math.round(cameraX), 0, worldWidth, height);
    } else {
      context.fillStyle = "#f2f7fb";
      context.fillRect(0, ground - 65, width, height - ground + 65);
    }

    context.fillStyle = "#eff7fd";
    context.fillRect(0, ground, width, height - ground);
    context.fillStyle = "#c8dded";
    context.fillRect(0, ground, width, 5);
    context.fillStyle = "#f9fcff";
    for (let index = 0; index < 22; index += 1) {
      const x = ((index * 91 - cameraX * 0.65) % (width + 28) + (width + 28)) % (width + 28) - 14;
      const y = ground + 12 + (index * 37) % 96;
      context.fillRect(Math.round(x), y, 8 + (index % 3) * 3, 3);
    }

    context.fillStyle = "rgba(255,255,255,.82)";
    for (let index = 0; index < 52; index += 1) {
      const x = (index * 197 + elapsed * (8 + index % 5) * 9) % width;
      const y = (index * 83 + elapsed * (10 + index % 3) * 7) % (ground - 30);
      context.fillRect(Math.round(x), Math.round(y), index % 7 === 0 ? 3 : 2, index % 7 === 0 ? 3 : 2);
    }
  }

  function drawWindmill(windmill) {
    const x = Math.round(windmill.x - cameraX);
    if (x < -100 || x > width + 100) return;
    if (windmill.destroyed) {
      context.fillStyle = "#d8e7ee";
      context.fillRect(x - 17, ground - 11, 34, 11);
      for (let star = 0; star < 4; star += 1) {
        const starX = x - 22 + ((star * 17 + Math.floor(elapsed * 18)) % 47);
        const starY = ground - 24 - ((star * 13 + Math.floor(elapsed * 14)) % 24);
        context.fillStyle = star % 2 ? "#ffd466" : "#8be3a8";
        context.fillRect(starX, starY, 5, 5);
      }
      return;
    }

    const hubY = ground - 116;
    context.fillStyle = "#344c5e";
    context.fillRect(x - 8, hubY + 7, 16, ground - hubY - 7);
    context.fillStyle = "#6f8291";
    context.fillRect(x - 5, hubY + 15, 5, ground - hubY - 15);
    context.fillStyle = "#41586a";
    context.fillRect(x - 19, ground - 9, 38, 9);

    context.save();
    context.translate(x, hubY);
    context.rotate(elapsed * 1.8 + windmill.x * 0.015);
    for (let blade = 0; blade < 4; blade += 1) {
      context.rotate(Math.PI / 2);
      context.fillStyle = "#314657";
      context.fillRect(-5, -58, 10, 49);
      context.fillStyle = "#d9e7ef";
      context.fillRect(-11, -66, 22, 11);
      context.fillStyle = "#b6cbd7";
      context.fillRect(-6, -69, 12, 4);
    }
    context.restore();

    context.fillStyle = "#e5b957";
    context.fillRect(x - 8, hubY - 8, 16, 16);
    context.fillStyle = "#fff0b6";
    context.fillRect(x - 3, hubY - 3, 6, 6);
    context.fillStyle = "rgba(17,31,40,.72)";
    context.fillRect(x - 17, hubY - 87, 34, 6);
    context.fillStyle = "#f47d71";
    context.fillRect(x - 15, hubY - 85, 12 + (windmill.hp - 1) * 9, 2);
  }

  function drawPlayer() {
    const screenX = Math.round(player.x - cameraX);
    const bob = player.jumpHeight > 0 ? 0 : Math.round(Math.sin(player.stride || elapsed * 2) * (input.left || input.right ? 2 : 1));
    const drawY = Math.round(ground - spriteSize + 24 - player.jumpHeight + bob);
    const drawX = screenX - spriteSize / 2;
    const flashing = player.hurtTimer > 0 && Math.floor(elapsed * 13) % 2 === 0;
    context.save();
    if (flashing) context.globalAlpha = 0.42;
    if (rider.complete && rider.naturalWidth > 0) {
      if (player.facing < 0) {
        context.translate(screenX, 0);
        context.scale(-1, 1);
        context.drawImage(rider, -spriteSize / 2, drawY, spriteSize, spriteSize);
      } else {
        context.drawImage(rider, drawX, drawY, spriteSize, spriteSize);
      }
    } else {
      context.fillStyle = "#ffd43b";
      context.fillRect(drawX + 63, drawY + 48, 132, 120);
      context.fillStyle = "#725140";
      context.fillRect(drawX + 90, drawY + 8, 83, 51);
      context.fillStyle = "#b58351";
      context.fillRect(drawX + 15, drawY + 130, 234, 83);
    }
    context.restore();
  }

  function drawSnowballs() {
    for (const snowball of projectiles) {
      const x = Math.round(snowball.x - cameraX);
      const y = Math.round(snowball.y);
      context.fillStyle = "#7e9eb8";
      context.fillRect(x - 7, y - 7, 16, 16);
      context.fillStyle = "#f9fdff";
      context.fillRect(x - 5, y - 6, 12, 12);
      context.fillStyle = "#d9eef8";
      context.fillRect(x - 3, y - 5, 5, 4);
    }
  }

  function drawHud() {
    context.fillStyle = "rgba(13,28,37,.86)";
    context.fillRect(16, 15, 300, 53);
    context.fillStyle = "#bce9c6";
    context.font = "bold 15px ui-monospace, SFMono-Regular, Consolas, monospace";
    context.fillText("TOBIAS // KIRKENES", 29, 37);
    context.fillStyle = "#f5fbff";
    context.font = "bold 11px ui-monospace, SFMono-Regular, Consolas, monospace";
    context.fillText(`REINELIV ${lives}/3     VINDMØLLER ${defeated}/4`, 29, 56);
    context.fillStyle = "rgba(13,28,37,.74)";
    context.fillRect(width - 187, 15, 171, 31);
    context.fillStyle = "#e9f5fc";
    context.font = "bold 10px ui-monospace, SFMono-Regular, Consolas, monospace";
    context.fillText("SNØBALLER > VIND", width - 175, 35);
  }

  function render() {
    drawBackground();
    for (const windmill of windmills) drawWindmill(windmill);
    drawPlayer();
    drawSnowballs();
    drawHud();
  }

  function frame(now) {
    const delta = Math.min(0.04, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (!portfolio.hidden) {
      update(delta);
      render();
    }
    window.requestAnimationFrame(frame);
  }

  function clearMovement() {
    input.left = false;
    input.right = false;
  }

  function keydown(event) {
    if (!running) return;
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", " "].includes(key)) event.preventDefault();
    if (key === "arrowleft" || key === "a") input.left = true;
    if (key === "arrowright" || key === "d") input.right = true;
    if (!event.repeat && (key === "arrowup" || key === " " || key === "w")) jump();
    if (!event.repeat && (key === "x" || key === "enter")) throwSnowball();
  }

  function keyup(event) {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") input.left = false;
    if (key === "arrowright" || key === "d") input.right = false;
  }

  overlayButton.addEventListener("click", startGame);
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", clearMovement);

  document.querySelectorAll("[data-hold]").forEach((button) => {
    const direction = button.dataset.hold;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      input[direction] = true;
      button.setPointerCapture(event.pointerId);
    });
    button.addEventListener("pointerup", () => { input[direction] = false; });
    button.addEventListener("pointercancel", () => { input[direction] = false; });
    button.addEventListener("lostpointercapture", () => { input[direction] = false; });
  });

  document.querySelector('[data-action="jump"]').addEventListener("click", jump);
  document.querySelector('[data-action="throw"]').addEventListener("click", throwSnowball);

  player = { x: 155, jumpHeight: 0, jumpVelocity: 0, facing: 1, throwCooldown: 0, hurtTimer: 0, stride: 0 };
  windmills = resetWindmills();
  updateHud();
  window.requestAnimationFrame(frame);
})();
