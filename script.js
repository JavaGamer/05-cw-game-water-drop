import {
  DIRECTIONS as directions,
  GAME_CONFIG,
  OPPOSITE as opposite,
  PIPE_TYPES as pipeTypes,
  createLevel,
  createQueue,
  createRandomPiece,
  getNextDirection,
  getOpenings,
  validateLevel,
} from "./game-engine.js";

const {
  countdownSeconds,
  queueSize,
} = GAME_CONFIG;
const board = document.getElementById("game-container");
const queueElement = document.getElementById("queue");
const scoreElement = document.getElementById("score");
const timeElement = document.getElementById("time");
const statusText = document.getElementById("status-text");
const statusPill = document.getElementById("status-pill");
const helperText = document.getElementById("helper-text");
const modal = document.getElementById("modal");
const pauseButton = document.getElementById("pause-btn");
let grid;
let queue;
let score = 0;
let timeLeft = countdownSeconds;
let gameState = "ready";
let timerId;
let flowTimer;
let flowPosition;
let flowVisited;
let level;
let levelNumber = 1;
let source;
let destination;
let availablePieces;
function updatePauseButton(isPaused) {
  pauseButton.classList.toggle("is-paused", isPaused);
  pauseButton.setAttribute("aria-label", isPaused ? "Resume game" : "Pause game");
  pauseButton.setAttribute("title", isPaused ? "Resume game" : "Pause game");
}
function nextPiece() {
  return availablePieces.shift() || createRandomPiece();
}
function generatePlayableLevel() {
  const baseSeed = Date.now() + levelNumber * 1000;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const candidate = createLevel(baseSeed + attempt, levelNumber);
      if (validateLevel(candidate)) return candidate;
    } catch (error) {
      console.warn("Level generation attempt failed", error);
    }
  }
  return null;
}
function showLevelGenerationError() {
  gameState = "generation-error";
  document.getElementById("start-btn").disabled = true;
  statusPill.className = "status-pill lost-status";
  statusText.textContent = "Level unavailable";
  helperText.textContent = "Try restarting to generate a fresh route.";
  document.getElementById("result-mark").textContent = "!";
  document.getElementById("result-kicker").textContent = "Route setup failed";
  document.getElementById("result-title").textContent = "Level unavailable";
  document.getElementById("result-copy").textContent =
    "We could not prepare a safe route. Restart to try again.";
  document.getElementById("next-btn").hidden = true;
  modal.hidden = false;
}
function resetGame() {
  clearInterval(timerId);
  clearTimeout(flowTimer);
  const nextLevel = generatePlayableLevel();
  if (!nextLevel) {
    showLevelGenerationError();
    return;
  }
  level = nextLevel;
  source = level.source;
  destination = level.destination;
  availablePieces = createQueue(level);
  queue = availablePieces.splice(0, queueSize);
  grid = Array.from({ length: level.rows }, () => Array(level.cols).fill(null));
  board.style.setProperty("--board-columns", level.cols);
  board.style.setProperty("--board-rows", level.rows);
  score = 0;
  timeLeft = level.timeLimit || countdownSeconds;
  gameState = "ready";
  flowPosition = null;
  flowVisited = new Set();
  modal.hidden = true;
  document.getElementById("level-label").textContent =
    `Community challenge ${String(levelNumber).padStart(2, "0")}`;
  document.getElementById("start-btn").disabled = false;
  updatePauseButton(false);
  statusPill.className = "status-pill";
  statusText.textContent = "Ready to build";
  helperText.textContent = "Tap an empty tile to place the next pipe.";
  updateStats();
  renderBoard();
  renderQueue();
}
function renderBoard() {
  board.innerHTML = "";
  for (let row = 0; row < level.rows; row += 1)
    for (let col = 0; col < level.cols; col += 1) {
      const cell = document.createElement("button");
      const piece = grid[row][col];
      cell.className = "board-cell";
      cell.type = "button";
      cell.setAttribute("role", "gridcell");
      if (row === source.row && col === source.col) {
        cell.classList.add("source-cell");
        cell.setAttribute("aria-label", "Treatment plant output, pointing right");
        cell.innerHTML =
          '<span class="cell-icon">●</span><span class="tile-label">PLANT <b class="tile-port">OUT -></b></span>';
      } else if (row === destination.row && col === destination.col) {
        cell.classList.add("destination-cell");
        cell.setAttribute("aria-label", "Community tank input, pointing left");
        cell.innerHTML =
          '<span class="cell-icon">○</span><span class="tile-label">TANK <b class="tile-port">IN <-</b></span>';
      } else if (piece) {
        cell.classList.add("pipe-cell");
        cell.setAttribute(
          "aria-label",
          `Placed ${pipeTypes[piece.type].label.toLowerCase()} pipe. Right-click to rotate.`,
        );
        cell.innerHTML = `<span class="pipe-glyph ${piece.type}" style="--rotation: ${piece.rotation * 90}deg">${pipeTypes[piece.type].symbol}</span><span class="pipe-label">${pipeTypes[piece.type].label}</span>`;
        if (
          flowPosition &&
          flowPosition.row === row &&
          flowPosition.col === col
        )
          cell.classList.add("flowing");
      } else {
        cell.classList.add("empty-cell");
        cell.setAttribute("aria-label", "Empty tile. Place the next pipe here.");
        cell.innerHTML = '<span class="empty-mark">+</span>';
      }
      cell.addEventListener("click", () => handleCellClick(row, col));
      cell.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        rotatePlacedPipe(row, col);
      });
      board.appendChild(cell);
    }
}
function renderQueue() {
  queueElement.innerHTML = "";
  queue.forEach((piece, index) => {
    const item = document.createElement("div");
    item.className = `queue-piece ${index === 0 ? "current-piece" : ""}`;
    item.innerHTML = `<span class="queue-index">${index === 0 ? "NEXT" : `0${index + 1}`}</span><span class="queue-pipe ${piece.type}" style="--rotation: ${piece.rotation * 90}deg">${pipeTypes[piece.type].symbol}</span><span>${pipeTypes[piece.type].label}</span>`;
    queueElement.appendChild(item);
  });
}
function handleCellClick(row, col) {
  if (
    gameState === "flowing" ||
    gameState === "won" ||
    gameState === "lost" ||
    (row === source.row && col === source.col) ||
    (row === destination.row && col === destination.col) ||
    !queue.length
  )
    return;
  if (grid[row][col]) {
    score = Math.max(0, score - 2);
    helperText.textContent = "Pipe replaced. The route is still in your hands.";
  } else {
    score += 5;
    helperText.textContent = "Nice placement. Keep the route connected.";
  }
  grid[row][col] = { type: queue[0].type, rotation: queue[0].rotation };
  queue.shift();
  queue.push(nextPiece());
  updateStats();
  renderBoard();
  renderQueue();
}
function rotatePlacedPipe(row, col) {
  if (!grid[row][col] || gameState === "flowing") return;
  grid[row][col].rotation += 1;
  renderBoard();
  helperText.textContent =
    "Pipe rotated. Check both connections before releasing pressure.";
}
function rotateCurrentPiece() {
  if (gameState === "flowing" || !queue.length) return;
  queue[0].rotation += 1;
  renderQueue();
}
function startGame() {
  if (gameState !== "ready" && gameState !== "paused") return;
  gameState = "building";
  document.getElementById("start-btn").disabled = true;
  updatePauseButton(false);
  statusPill.className = "status-pill active";
  statusText.textContent = "Pressure building";
  helperText.textContent = `The valve opens in ${timeLeft} seconds. Finish your route.`;
  timerId = setInterval(() => {
    timeLeft -= 1;
    updateStats();
    helperText.textContent =
      timeLeft > 0
        ? `The valve opens in ${timeLeft} seconds. Finish your route.`
        : "Pressure released. Water is moving.";
    if (timeLeft <= 0) beginFlow();
  }, 1000);
}
function beginFlow() {
  if (gameState === "flowing") return;
  score += Math.max(0, timeLeft) * 2;
  timeLeft = 0;
  clearInterval(timerId);
  gameState = "flowing";
  statusPill.className = "status-pill flowing-status";
  statusText.textContent = "Water flowing";
  helperText.textContent =
    "Follow the blue flow. One wrong connection ends the route.";
  flowPosition = { ...source };
  flowVisited = new Set([`${source.row},${source.col}`]);
  updateStats();
  renderBoard();
  flowTimer = setTimeout(() => advanceFlow(source.direction), 450);
}
function advanceFlow(direction) {
  if (gameState !== "flowing") return;
  const next = {
    row: flowPosition.row + directions[direction].row,
    col: flowPosition.col + directions[direction].col,
  };
  if (next.row === destination.row && next.col === destination.col) {
    finishGame(true);
    return;
  }
  const nextKey = `${next.row},${next.col}`;
  if (flowVisited.has(nextKey)) {
    finishGame(false);
    return;
  }
  const piece =
    next.row >= 0 &&
    next.row < level.rows &&
    next.col >= 0 &&
    next.col < level.cols
      ? grid[next.row][next.col]
      : null;
  if (!piece || !getOpenings(piece).includes(opposite[direction])) {
    finishGame(false);
    return;
  }
  flowPosition = next;
  flowVisited.add(nextKey);
  score += piece.type === "cross" ? 25 : 10;
  updateStats();
  renderBoard();
  const nextDirection = getNextDirection(piece, direction);
  if (!nextDirection) finishGame(false);
  else flowTimer = setTimeout(() => advanceFlow(nextDirection), 500);
}
function finishGame(won) {
  gameState = won ? "won" : "lost";
  clearInterval(timerId);
  clearTimeout(flowTimer);
  statusPill.className = `status-pill ${won ? "won-status" : "lost-status"}`;
  statusText.textContent = won ? "Community supplied" : "Route disconnected";
  document.getElementById("result-mark").textContent = won ? "✓" : "!";
  document.getElementById("result-kicker").textContent = won
    ? "Route complete"
    : "Supply interrupted";
  document.getElementById("result-title").textContent = won
    ? "Community supplied!"
    : "Contamination risk";
  document.getElementById("result-copy").textContent = won
    ? "Safe water made it to the community tank."
    : "The water spilled before it reached the tank. Try a different route.";
  document.getElementById("final-score").textContent = String(score).padStart(
    3,
    "0",
  );
  document.getElementById("next-btn").hidden = !won;
  modal.hidden = false;
}
function updateStats() {
  scoreElement.textContent = String(score).padStart(3, "0");
  timeElement.textContent = String(Math.max(0, timeLeft)).padStart(2, "0");
}
document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("valve-btn").addEventListener("click", () => {
  if (gameState === "building") beginFlow();
  else startGame();
});
document
  .getElementById("rotate-btn")
  .addEventListener("click", rotateCurrentPiece);
document.getElementById("restart-btn").addEventListener("click", resetGame);
document.getElementById("retry-btn").addEventListener("click", resetGame);
document.getElementById("next-btn").addEventListener("click", () => {
  levelNumber += 1;
  resetGame();
});
document.getElementById("close-modal-btn").addEventListener("click", () => {
  modal.hidden = true;
});
pauseButton.addEventListener("click", () => {
  if (gameState === "building") {
    gameState = "paused";
    clearInterval(timerId);
    updatePauseButton(true);
    statusText.textContent = "Paused";
    helperText.textContent = "Paused. Press the resume button to continue.";
  } else if (gameState === "paused") startGame();
});
document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "r") rotateCurrentPiece();
  if (event.code === "Space") {
    event.preventDefault();
    document.getElementById("valve-btn").click();
  }
});
resetGame();
