import {
  DIRECTIONS as directions,
  DIFFICULTY_CONFIG,
  GAME_CONFIG,
  MILESTONES,
  OPPOSITE as opposite,
  PIPE_TYPES as pipeTypes,
  createLevel,
  createQueue,
  createRandomPiece,
  getNextDirection,
  getOpenings,
  validateLevel,
} from "./game-engine.js";

import {
  renderPipeSvg,
  renderObstacleSvg,
  renderJerryCanBadge,
} from "./pipe-renderer.js";

import { soundManager } from "./audio.js";

const { countdownSeconds, queueSize } = GAME_CONFIG;

// Pacing constants for classic Pipe Mania real-time placement
const FLOW_PACE_MS = 1200; // 1.2s per pipe gives players time to actively place ahead of flow
const SPILL_WARNING_MS = 1000; // 0.9s clutch grace window to place a missing pipe before leak

// DOM Elements
const board = document.getElementById("game-container");
const queueElement = document.getElementById("queue");
const scoreElement = document.getElementById("score");
const bestScoreElement = document.getElementById("best-score");
const jerryCansCountElement = document.getElementById("jerry-cans-count");
const timeElement = document.getElementById("time");
const statusText = document.getElementById("status-text");
const statusPill = document.getElementById("status-pill");
const helperText = document.getElementById("helper-text");
const modal = document.getElementById("modal");
const pauseButton = document.getElementById("pause-btn");
const muteButton = document.getElementById("mute-btn");
const soundIcon = document.getElementById("sound-icon");
const holdButton = document.getElementById("hold-btn");
const holdContent = document.getElementById("hold-content");
const discardButton = document.getElementById("discard-btn");
const valveButton = document.getElementById("valve-btn");
const startButton = document.getElementById("start-btn");
const difficultyButtons = document.querySelectorAll(".diff-btn");
const difficultyHint = document.getElementById("difficulty-hint");
const milestoneToast = document.getElementById("milestone-toast");
const milestoneBadge = document.getElementById("milestone-badge");
const milestoneTitle = document.getElementById("milestone-title");
const milestoneCopy = document.getElementById("milestone-copy");
const milestoneCloseBtn = document.getElementById("milestone-close-btn");
const bdMilestoneWrap = document.getElementById("bd-milestone-wrap");
const bdMilestone = document.getElementById("bd-milestone");

// Milestone Tracking State
let reachedMilestones = new Set();
let highestMilestoneAchieved = null;
let milestoneToastTimer = null;

// Difficulty State
let currentDifficulty = localStorage.getItem("cw_game_difficulty") || "normal";

// Game State
let grid;
let queue;
let score = 0;
let highScore = parseInt(localStorage.getItem("cw_water_pipes_high_score") || "0", 10);
let timeLeft = countdownSeconds;
let gameState = "ready";
let timerId;
let flowTimer;
let leakTimer;
let flowPosition;
let flowVisited;
let currentFlowDirection = "e";
let level;
let levelNumber = 1;
let source;
let destination;
let availablePieces;

// Persistent DOM board cells array to prevent DOM rebuilding on click/hover
let boardCells = [];

// Feature State
let heldPiece = null;
let hasHeldThisTurn = false;
let obstacleSet = new Set();
let jerryCanSet = new Set();
let jerryCansCollected = 0;
let hoveredCell = null;
let pendingLeakTarget = null;

// Score Breakdown
let routeScore = 0;
let jerryCanScore = 0;
let specialScore = 0;
let timeBonusScore = 0;

/**
 * Initializes and updates audio mute button UI.
 */
function updateMuteButton(isMuted) {
  soundIcon.textContent = isMuted ? "🔇" : "🔊";
  muteButton.setAttribute(
    "aria-label",
    isMuted ? "Unmute sound" : "Mute sound",
  );
  muteButton.setAttribute("title", isMuted ? "Unmute sound" : "Mute sound");
}

/**
 * Updates pause button appearance and accessibility labels.
 */
function updatePauseButton(isPaused) {
  pauseButton.classList.toggle("is-paused", isPaused);
  pauseButton.setAttribute(
    "aria-label",
    isPaused ? "Resume game" : "Pause game",
  );
  pauseButton.setAttribute("title", isPaused ? "Resume game" : "Pause game");
}

/**
 * Pulses the valve button to guide the player when they attempt to act before opening the valve.
 */
function highlightValveButton() {
  valveButton.classList.remove("pulse-highlight");
  void valveButton.offsetWidth; // trigger reflow to restart animation
  valveButton.classList.add("pulse-highlight");
}

/**
 * Fetches the next piece from the generated queue or creates a random piece.
 */
function nextPiece() {
  return availablePieces.shift() || createRandomPiece();
}

/**
 * Updates the difficulty selection UI, hint text, and stores the selection.
 */
function updateDifficultyUI(mode) {
  currentDifficulty = mode;
  localStorage.setItem("cw_game_difficulty", mode);

  difficultyButtons.forEach((btn) => {
    const isSelected = btn.dataset.mode === mode;
    btn.classList.toggle("is-active", isSelected);
    btn.setAttribute("aria-checked", isSelected ? "true" : "false");
  });

  const modeConfig = DIFFICULTY_CONFIG[mode] || DIFFICULTY_CONFIG.normal;
  if (difficultyHint) {
    difficultyHint.textContent = modeConfig.description;
  }

  if (discardButton) {
    discardButton.title = `Discard current piece (-${modeConfig.discardPenalty} pts)`;
    discardButton.innerHTML = `<span class="discard-icon">✕</span> Discard (-${modeConfig.discardPenalty})`;
  }
}

/**
 * Displays an animated milestone toast notification in the DOM.
 */
function displayMilestoneToast(milestone) {
  if (!milestoneToast) return;
  if (milestoneBadge) milestoneBadge.textContent = milestone.badge;
  if (milestoneTitle) milestoneTitle.textContent = milestone.title;
  if (milestoneCopy) milestoneCopy.textContent = milestone.message;
  milestoneToast.hidden = false;

  soundManager.playBonus();

  clearTimeout(milestoneToastTimer);
  milestoneToastTimer = setTimeout(() => {
    milestoneToast.hidden = true;
  }, 4200);
}

/**
 * Evaluates current score against the MILESTONES array using conditionals.
 */
function checkScoreMilestones() {
  for (const milestone of MILESTONES) {
    if (score >= milestone.score && !reachedMilestones.has(milestone.score)) {
      reachedMilestones.add(milestone.score);
      highestMilestoneAchieved = milestone;
      displayMilestoneToast(milestone);
    }
  }
}

/**
 * Generates a valid level with fallback retry attempts.
 */
function generatePlayableLevel() {
  const baseSeed = Date.now() + levelNumber * 1000;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const candidate = createLevel(baseSeed + attempt, levelNumber, currentDifficulty);
      if (validateLevel(candidate)) return candidate;
    } catch (error) {
      console.warn("Level generation attempt failed", error);
    }
  }
  return null;
}

/**
 * Displays error state if level generation fails.
 */
function showLevelGenerationError() {
  gameState = "generation-error";
  valveButton.disabled = true;
  if (startButton) startButton.disabled = true;
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

/**
 * Builds the board DOM button elements once.
 * Event listeners are attached permanently so clicks are never lost.
 */
function setupBoardDOM(rows, cols) {
  board.innerHTML = "";
  boardCells = [];
  board.style.setProperty("--board-columns", cols);
  board.style.setProperty("--board-rows", rows);

  for (let r = 0; r < rows; r += 1) {
    boardCells[r] = [];
    for (let c = 0; c < cols; c += 1) {
      const cell = document.createElement("button");
      cell.className = "board-cell";
      cell.type = "button";
      cell.setAttribute("role", "gridcell");

      const row = r;
      const col = c;
      cell.addEventListener("click", () => handleCellClick(row, col));
      cell.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        rotatePlacedPipe(row, col);
      });
      cell.addEventListener("mouseenter", () => handleCellMouseEnter(row, col));
      cell.addEventListener("mouseleave", () => handleCellMouseLeave(row, col));

      board.appendChild(cell);
      boardCells[r][c] = cell;
    }
  }
}

/**
 * Updates a single cell's view in-place without rebuilding the DOM.
 */
function renderCell(row, col) {
  const cell = boardCells[row]?.[col];
  if (!cell) return;

  const cellKey = `${row},${col}`;
  const piece = grid[row][col];
  const isObstacle = obstacleSet.has(cellKey);
  const hasJerryCan = jerryCanSet.has(cellKey);
  const isCurrentlyFlowing = flowVisited && flowVisited.has(cellKey);
  const isLeakTarget = pendingLeakTarget && pendingLeakTarget.row === row && pendingLeakTarget.col === col;

  cell.className = "board-cell";
  cell.disabled = false;

  if (isLeakTarget) {
    cell.classList.add("leak-alert");
  }

  // Treatment plant source cell
  if (row === source.row && col === source.col) {
    cell.classList.add("source-cell");
    cell.setAttribute("aria-label", "Treatment plant output, pointing right");
    cell.innerHTML =
      '<span class="cell-icon">●</span><span class="tile-label">PLANT <b class="tile-port">OUT -></b></span>';
  }
  // Community water tank destination cell
  else if (row === destination.row && col === destination.col) {
    cell.classList.add("destination-cell");
    cell.setAttribute("aria-label", "Community tank input, pointing left");
    cell.innerHTML =
      '<span class="cell-icon">○</span><span class="tile-label">TANK <b class="tile-port">IN <-</b></span>';
  }
  // Unbuildable obstacle rock
  else if (isObstacle) {
    cell.classList.add("obstacle-cell");
    cell.setAttribute("aria-label", "Bedrock boulder. Cannot place pipes here.");
    cell.disabled = true;
    cell.innerHTML = renderObstacleSvg();
  }
  // Cell with placed pipe
  else if (piece) {
    cell.classList.add("pipe-cell");
    cell.setAttribute(
      "aria-label",
      `Placed ${pipeTypes[piece.type].label.toLowerCase()} pipe. ${isCurrentlyFlowing ? "Water running through." : "Click to replace or right-click to rotate."}`,
    );

    cell.innerHTML = renderPipeSvg(
      piece.type,
      piece.rotation,
      isCurrentlyFlowing,
      false,
    );

    if (isCurrentlyFlowing) {
      cell.classList.add("flowing");
    }

    if (hasJerryCan) {
      const bonus = level?.modeConfig?.jerryCanBonus || 50;
      cell.insertAdjacentHTML("beforeend", renderJerryCanBadge(bonus));
    }
  }
  // Empty buildable cell
  else {
    cell.classList.add("empty-cell");
    cell.setAttribute("aria-label", "Empty tile. Click to place the next pipe.");

    // Ghost preview is active during building OR while water is flowing
    const isGhostActive =
      hoveredCell &&
      hoveredCell.row === row &&
      hoveredCell.col === col &&
      queue.length &&
      (gameState === "building" || gameState === "flowing") &&
      (!flowVisited || !flowVisited.has(cellKey));

    if (isGhostActive) {
      cell.classList.add("has-ghost");
      cell.innerHTML = renderPipeSvg(
        queue[0].type,
        queue[0].rotation,
        false,
        true,
      );
    } else {
      cell.innerHTML = '<span class="empty-mark">+</span>';
    }

    if (hasJerryCan) {
      const bonus = level?.modeConfig?.jerryCanBonus || 50;
      cell.insertAdjacentHTML("beforeend", renderJerryCanBadge(bonus));
    }
  }

  // If this cell is actively in the leak warning countdown, show red border filling outside-in
  if (isLeakTarget) {
    cell.insertAdjacentHTML(
      "beforeend",
      `
        <div class="leak-fill-overlay" aria-hidden="true"></div>
        <span class="leak-warning-tag">LEAK!</span>
      `
    );
  }
}

/**
 * Updates all cells on the board.
 */
function renderBoard() {
  if (!level) return;
  for (let r = 0; r < level.rows; r += 1) {
    for (let c = 0; c < level.cols; c += 1) {
      renderCell(r, c);
    }
  }
}

/**
 * Mouse enter on a board cell.
 */
function handleCellMouseEnter(row, col) {
  const cellKey = `${row},${col}`;
  if (
    !obstacleSet.has(cellKey) &&
    !grid[row][col] &&
    (gameState === "building" || gameState === "flowing") &&
    (!flowVisited || !flowVisited.has(cellKey))
  ) {
    hoveredCell = { row, col };
    renderCell(row, col);
  }
}

/**
 * Mouse leave on a board cell.
 */
function handleCellMouseLeave(row, col) {
  if (hoveredCell && hoveredCell.row === row && hoveredCell.col === col) {
    hoveredCell = null;
    renderCell(row, col);
  }
}

/**
 * Resets the board, level, and player state for a fresh game or next level.
 */
function resetGame() {
  clearInterval(timerId);
  clearTimeout(flowTimer);
  clearTimeout(leakTimer);

  const nextLevel = generatePlayableLevel();
  if (!nextLevel) {
    showLevelGenerationError();
    return;
  }

  level = nextLevel;
  source = level.source;
  destination = level.destination;

  // Build sets for quick obstacle and jerry can lookups
  obstacleSet = new Set((level.obstacles || []).map((p) => `${p.row},${p.col}`));
  jerryCanSet = new Set((level.jerryCans || []).map((p) => `${p.row},${p.col}`));

  availablePieces = createQueue(level);
  queue = availablePieces.splice(0, queueSize);
  grid = Array.from({ length: level.rows }, () => Array(level.cols).fill(null));

  // Initialize or re-use persistent DOM button cells
  if (boardCells.length !== level.rows || boardCells[0]?.length !== level.cols) {
    setupBoardDOM(level.rows, level.cols);
  }

  score = 0;
  routeScore = 0;
  jerryCanScore = 0;
  specialScore = 0;
  timeBonusScore = 0;
  jerryCansCollected = 0;
  heldPiece = null;
  hasHeldThisTurn = false;
  hoveredCell = null;
  pendingLeakTarget = null;
  reachedMilestones = new Set();
  highestMilestoneAchieved = null;
  clearTimeout(milestoneToastTimer);
  if (milestoneToast) milestoneToast.hidden = true;

  timeLeft = level.timeLimit || countdownSeconds;
  gameState = "ready";
  flowPosition = null;
  flowVisited = new Set();
  modal.hidden = true;

  document.getElementById("level-label").textContent =
    `Community challenge ${String(levelNumber).padStart(2, "0")}`;

  // Configure valve button on top of the game board
  valveButton.disabled = false;
  valveButton.innerHTML = 'Turn on valve to start <span>-></span>';
  valveButton.setAttribute("title", "Turn on valve to start timer and begin placing pipes (Space)");

  if (startButton) {
    startButton.disabled = false;
    startButton.innerHTML = 'Turn on valve <span>-></span>';
  }

  updatePauseButton(false);
  updateMuteButton(soundManager.isMuted());

  statusPill.className = "status-pill";
  statusText.textContent = "Valve closed";
  helperText.textContent = "Turn on the valve to start the pressure and begin placing pipes.";

  updateStats();
  renderHoldSlot();
  renderBoard();
  renderQueue();
}

/**
 * Renders the Hold slot UI.
 */
function renderHoldSlot() {
  if (!heldPiece) {
    holdContent.innerHTML = '<span class="hold-empty-hint">Press <b>H</b> to hold</span>';
    holdButton.classList.remove("has-piece");
  } else {
    holdContent.innerHTML = `
      <div class="hold-pipe-wrap">
        ${renderPipeSvg(heldPiece.type, heldPiece.rotation, false, false)}
      </div>
      <span class="hold-label">${pipeTypes[heldPiece.type].label}</span>
    `;
    holdButton.classList.add("has-piece");
  }
}

/**
 * Handles holding or swapping the current piece.
 * Allowed during building AND while water is flowing!
 */
function holdCurrentPiece() {
  if (gameState === "ready") {
    helperText.textContent = "Turn on the valve first to start pressure and place pipes!";
    highlightValveButton();
    return;
  }

  if (
    (gameState !== "building" && gameState !== "flowing") ||
    hasHeldThisTurn ||
    !queue.length
  ) {
    return;
  }

  soundManager.init();

  if (!heldPiece) {
    heldPiece = queue.shift();
    queue.push(nextPiece());
  } else {
    const temp = heldPiece;
    heldPiece = queue[0];
    queue[0] = temp;
  }

  hasHeldThisTurn = true;
  soundManager.playRotate();
  helperText.textContent = "Piece held. Place or discard a pipe to unlock hold again.";

  renderHoldSlot();
  renderQueue();
  if (hoveredCell) renderCell(hoveredCell.row, hoveredCell.col);
}

/**
 * Discards the current piece according to the difficulty penalty.
 * Allowed during building AND while water is flowing!
 */
function discardCurrentPiece() {
  if (gameState === "ready") {
    helperText.textContent = "Turn on the valve first to start pressure and place pipes!";
    highlightValveButton();
    return;
  }

  if ((gameState !== "building" && gameState !== "flowing") || !queue.length) {
    return;
  }

  const modeConfig = level?.modeConfig || DIFFICULTY_CONFIG[currentDifficulty] || DIFFICULTY_CONFIG.normal;
  const penalty = modeConfig.discardPenalty ?? 5;

  soundManager.init();
  score = Math.max(0, score - penalty);
  queue.shift();
  queue.push(nextPiece());
  hasHeldThisTurn = false;

  soundManager.playDiscard();
  helperText.textContent = `Piece discarded (-${penalty} pts). Next pipe ready.`;

  updateStats();
  renderQueue();
  if (hoveredCell) renderCell(hoveredCell.row, hoveredCell.col);
}

/**
 * Renders the upcoming piece queue.
 */
function renderQueue() {
  queueElement.innerHTML = "";
  queue.forEach((piece, index) => {
    const item = document.createElement("div");
    item.className = `queue-piece ${index === 0 ? "current-piece" : ""}`;
    item.innerHTML = `
      <span class="queue-index">${index === 0 ? "NEXT" : `0${index + 1}`}</span>
      <div class="queue-pipe-wrap">
        ${renderPipeSvg(piece.type, piece.rotation, false, false)}
      </div>
      <span>${pipeTypes[piece.type].label}</span>
    `;
    queueElement.appendChild(item);
  });
}

/**
 * Handles placing the current queue pipe onto a board cell.
 * Players can place pipes during countdown AND while water is actively flowing!
 */
function handleCellClick(row, col) {
  // If the valve is not opened yet, guide the player to turn on the valve
  if (gameState === "ready") {
    soundManager.init();
    helperText.textContent = "Turn on the valve first to start pressure and begin placing pipes!";
    highlightValveButton();
    return;
  }

  // Allow placing during countdown building OR while water is flowing
  if (gameState !== "building" && gameState !== "flowing") {
    return;
  }

  const cellKey = `${row},${col}`;

  // Cannot place on source, destination, obstacles, or pipes water has ALREADY reached
  if (
    (row === source.row && col === source.col) ||
    (row === destination.row && col === destination.col) ||
    obstacleSet.has(cellKey) ||
    (flowVisited && flowVisited.has(cellKey)) ||
    !queue.length
  ) {
    return;
  }

  soundManager.init();

  const modeConfig = level?.modeConfig || DIFFICULTY_CONFIG[currentDifficulty] || DIFFICULTY_CONFIG.normal;
  if (grid[row][col]) {
    const penalty = modeConfig.replacePenalty ?? 2;
    score = Math.max(0, score - penalty);
    helperText.textContent = gameState === "flowing"
      ? `Pipe replaced (-${penalty} pts) ahead of the water flow! Keep moving.`
      : `Pipe replaced (-${penalty} pts). The route is still in your hands.`;
  } else {
    score += 5;
    helperText.textContent = gameState === "flowing"
      ? "Placed ahead of the water! Stay ahead."
      : "Nice placement. Keep the route connected.";
  }

  const placedPiece = { type: queue[0].type, rotation: queue[0].rotation };
  grid[row][col] = placedPiece;
  queue.shift();
  queue.push(nextPiece());
  hasHeldThisTurn = false;
  hoveredCell = null;

  soundManager.playPlace();
  updateStats();
  renderCell(row, col);
  renderQueue();

  // If water was about to leak into this cell:
  if (
    pendingLeakTarget &&
    pendingLeakTarget.row === row &&
    pendingLeakTarget.col === col
  ) {
    if (getOpenings(placedPiece).includes(opposite[currentFlowDirection])) {
      clearTimeout(leakTimer);
      pendingLeakTarget = null;
      renderCell(row, col);
      statusPill.className = "status-pill flowing-status";
      statusText.textContent = "Water flowing";
      helperText.textContent = "Clutch placement! Flow saved just in time.";
      soundManager.playFlow();
      advanceFlow(currentFlowDirection);
    } else {
      helperText.textContent = "Openings don't match flow! Rotate it before the red fills!";
    }
  }
}

/**
 * Rotates a pipe that has already been placed on the board.
 * Allowed for unvisited pipes even while water is flowing!
 */
function rotatePlacedPipe(row, col) {
  const cellKey = `${row},${col}`;
  if (
    !grid[row][col] ||
    (gameState !== "building" && gameState !== "flowing") ||
    (flowVisited && flowVisited.has(cellKey))
  ) {
    return;
  }

  soundManager.init();
  grid[row][col].rotation = (grid[row][col].rotation + 1) % 4;
  soundManager.playRotate();
  renderCell(row, col);
  helperText.textContent =
    "Pipe rotated. Check both connections before water reaches it.";

  // If water was about to leak into this cell and rotating completed the connection:
  if (
    pendingLeakTarget &&
    pendingLeakTarget.row === row &&
    pendingLeakTarget.col === col
  ) {
    if (getOpenings(grid[row][col]).includes(opposite[currentFlowDirection])) {
      clearTimeout(leakTimer);
      pendingLeakTarget = null;
      renderCell(row, col);
      statusPill.className = "status-pill flowing-status";
      statusText.textContent = "Water flowing";
      helperText.textContent = "Clutch rotation! Connection saved.";
      soundManager.playFlow();
      advanceFlow(currentFlowDirection);
    } else {
      helperText.textContent = "Keep rotating! Must connect to incoming water before red fills!";
    }
  }
}

/**
 * Rotates the next piece waiting in the queue.
 */
function rotateCurrentPiece() {
  if (gameState === "won" || gameState === "lost" || !queue.length) return;
  soundManager.init();
  queue[0].rotation = (queue[0].rotation + 1) % 4;
  soundManager.playRotate();
  renderQueue();

  // If hovering an empty cell, immediately update ghost preview
  if (hoveredCell && (gameState === "building" || gameState === "flowing")) {
    renderCell(hoveredCell.row, hoveredCell.col);
  }
}

/**
 * Turns on the valve, starts the pressure countdown timer, and unlocks pipe placement.
 */
function startGame() {
  if (gameState !== "ready" && gameState !== "paused") return;
  soundManager.init();
  gameState = "building";

  // Update valve button on top of the game board
  valveButton.disabled = false;
  valveButton.innerHTML = 'Release water early <span>-></span>';
  valveButton.setAttribute("title", "Release water early for bonus points (Space)");

  if (startButton) {
    startButton.disabled = true;
    startButton.innerHTML = 'Pressure building...';
  }

  updatePauseButton(false);
  statusPill.className = "status-pill active";
  statusText.textContent = "Pressure building";
  helperText.textContent = `Valve open! Pressure countdown running (${timeLeft}s). Place pipes to connect the tank.`;

  timerId = setInterval(() => {
    timeLeft -= 1;
    updateStats();

    if (timeLeft <= 5 && timeLeft > 0) {
      soundManager.playTick();
    }

    helperText.textContent =
      timeLeft > 0
        ? `Valve open! Water arrives in ${timeLeft} seconds. Finish your route.`
        : "Pressure released. Water is moving.";

    if (timeLeft <= 0) beginFlow();
  }, 1000);

  // Activate hover previews
  if (hoveredCell) renderCell(hoveredCell.row, hoveredCell.col);
}

/**
 * Begins water flow from the treatment plant.
 * Players continue placing pipes ahead of the flow!
 */
function beginFlow() {
  if (gameState === "flowing") return;
  soundManager.init();

  timeBonusScore = Math.max(0, timeLeft) * 2;
  score += timeBonusScore;
  timeLeft = 0;
  clearInterval(timerId);

  gameState = "flowing";

  // Update valve button state on top of board
  valveButton.disabled = true;
  valveButton.innerHTML = 'Water flowing... <span>💧</span>';
  valveButton.setAttribute("title", "Water is moving through the pipes! Keep placing ahead of it.");

  statusPill.className = "status-pill flowing-status";
  statusText.textContent = "Water flowing";
  helperText.textContent =
    "Water is flowing! Keep placing and rotating pipes ahead of the blue flow.";

  flowPosition = { ...source };
  flowVisited = new Set([`${source.row},${source.col}`]);
  currentFlowDirection = source.direction;

  updateStats();
  renderBoard();

  const modeConfig = level?.modeConfig || DIFFICULTY_CONFIG[currentDifficulty] || DIFFICULTY_CONFIG.normal;
  flowTimer = setTimeout(() => advanceFlow(source.direction), modeConfig.flowDelay || FLOW_PACE_MS);
}

/**
 * Shows an animated floating score label on the board cell.
 */
function triggerFloatingScore(row, col, pointsText) {
  const targetCell = boardCells[row]?.[col];
  if (!targetCell) return;

  const floatTag = document.createElement("span");
  floatTag.className = "floating-score";
  floatTag.textContent = pointsText;
  targetCell.appendChild(floatTag);

  setTimeout(() => floatTag.remove(), 900);
}

/**
 * Advances the water flow one step in the specified direction.
 * If the next cell is empty or unconnected, grants a clutch grace window so the player can place it!
 */
function advanceFlow(direction) {
  if (gameState !== "flowing") return;
  currentFlowDirection = direction;

  const next = {
    row: flowPosition.row + directions[direction].row,
    col: flowPosition.col + directions[direction].col,
  };

  // Reached the community tank destination successfully!
  if (next.row === destination.row && next.col === destination.col) {
    finishGame(true);
    return;
  }

  const nextKey = `${next.row},${next.col}`;

  // Loop back / already visited
  if (flowVisited.has(nextKey)) {
    finishGame(false);
    return;
  }

  // Out of bounds or obstacle
  if (
    next.row < 0 ||
    next.row >= level.rows ||
    next.col < 0 ||
    next.col >= level.cols ||
    obstacleSet.has(nextKey)
  ) {
    finishGame(false);
    return;
  }

  const piece = grid[next.row][next.col];

  // No pipe or opening does not match flow direction: give clutch leak warning window!
  if (!piece || !getOpenings(piece).includes(opposite[direction])) {
    statusPill.className = "status-pill lost-status";
    statusText.textContent = "Leak warning!";
    helperText.textContent = "Water is about to leak! Place a connecting pipe quickly!";
    soundManager.playTick();

    pendingLeakTarget = { ...next };
    renderCell(next.row, next.col);

    leakTimer = setTimeout(() => {
      const rescuePiece = grid[next.row]?.[next.col];
      if (rescuePiece && getOpenings(rescuePiece).includes(opposite[direction])) {
        // Saved in time!
        pendingLeakTarget = null;
        renderCell(next.row, next.col);
        statusPill.className = "status-pill flowing-status";
        statusText.textContent = "Water flowing";
        helperText.textContent = "Saved in time! Keep building ahead of the water.";
        soundManager.playFlow();
        advanceFlow(direction);
      } else {
        pendingLeakTarget = null;
        renderCell(next.row, next.col);
        finishGame(false);
      }
    }, SPILL_WARNING_MS);

    return;
  }

  // Clear any pending leak target
  pendingLeakTarget = null;

  flowPosition = next;
  flowVisited.add(nextKey);
  soundManager.playFlow();

  // Route pipe points
  const points = piece.type === "cross" ? 25 : 10;
  routeScore += points;
  score += points;

  const modeConfig = level?.modeConfig || DIFFICULTY_CONFIG[currentDifficulty] || DIFFICULTY_CONFIG.normal;
  let delay = modeConfig.flowDelay || FLOW_PACE_MS;

  // Check if water reached a Jerry Can collectible!
  if (jerryCanSet.has(nextKey)) {
    jerryCanSet.delete(nextKey);
    jerryCansCollected += 1;
    const bonus = modeConfig.jerryCanBonus || 50;
    jerryCanScore += bonus;
    score += bonus;
    soundManager.playBonus();
    triggerFloatingScore(next.row, next.col, `+${bonus}`);
    helperText.textContent = `Clean water delivered to community Jerry Can! +${bonus} bonus pts.`;

    // Pop animation on DOM badge before removal
    const targetCell = boardCells[next.row]?.[next.col];
    const badge = targetCell?.querySelector(".jerry-can-badge");
    if (badge) {
      badge.classList.add("can-collected");
    }
  }

  // Check special pipe types: Filter and Reservoir
  if (piece.type === "filter") {
    specialScore += 30;
    score += 30;
    soundManager.playBonus();
    triggerFloatingScore(next.row, next.col, "+30 Filter");
    helperText.textContent = "Water Filter active! Sediment cleared for +30 bonus pts.";
  } else if (piece.type === "reservoir") {
    specialScore += 15;
    score += 15;
    delay = 3000; // 3.0-second buffer to stabilize pressure
    soundManager.playReservoir();
    triggerFloatingScore(next.row, next.col, "+15 Cistern");
    helperText.textContent = "Reservoir filling... pressure stabilized (3s pause). Keep placing!";
  }

  updateStats();
  renderCell(next.row, next.col);

  const nextDirection = getNextDirection(piece, direction);
  if (!nextDirection) {
    finishGame(false);
  } else {
    flowTimer = setTimeout(() => advanceFlow(nextDirection), delay);
  }
}

/**
 * Concludes the game, displaying the result modal and breakdown.
 */
function finishGame(won) {
  gameState = won ? "won" : "lost";
  clearInterval(timerId);
  clearTimeout(flowTimer);
  clearTimeout(leakTimer);
  pendingLeakTarget = null;

  statusPill.className = `status-pill ${won ? "won-status" : "lost-status"}`;
  statusText.textContent = won ? "Community supplied" : "Route disconnected";

  valveButton.disabled = false;
  valveButton.innerHTML = 'Turn on valve to start <span>-></span>';

  document.getElementById("result-mark").textContent = won ? "✓" : "!";
  document.getElementById("result-kicker").textContent = won
    ? "Route complete"
    : "Supply interrupted";
  document.getElementById("result-title").textContent = won
    ? "Community supplied!"
    : "Contamination risk";
  document.getElementById("result-copy").textContent = won
    ? "Safe, clean water made it to the community tank."
    : "The water spilled before it reached the tank. Try a different route.";

  // Update breakdown
  document.getElementById("bd-route").textContent = `+${routeScore}`;
  document.getElementById("bd-cans").textContent = `+${jerryCanScore}`;
  document.getElementById("bd-special").textContent = `+${specialScore}`;
  document.getElementById("bd-time").textContent = `+${timeBonusScore}`;

  if (highestMilestoneAchieved && bdMilestoneWrap && bdMilestone) {
    bdMilestoneWrap.hidden = false;
    bdMilestone.textContent = `${highestMilestoneAchieved.title} (${highestMilestoneAchieved.badge})`;
  } else if (bdMilestoneWrap) {
    bdMilestoneWrap.hidden = true;
  }

  const isNewBest = score > highScore;
  if (isNewBest) {
    highScore = score;
    localStorage.setItem("cw_water_pipes_high_score", String(highScore));
  }

  document.getElementById("final-score").textContent = String(score).padStart(3, "0");
  document.getElementById("new-best-badge").hidden = !isNewBest || score === 0;
  document.getElementById("next-btn").hidden = !won;

  if (won) {
    soundManager.playWin();
  } else {
    soundManager.playLose();
  }

  updateStats();
  renderBoard();
  modal.hidden = false;
}

/**
 * Updates stats counters in the mission panel.
 */
function updateStats() {
  scoreElement.textContent = String(score).padStart(3, "0");
  bestScoreElement.textContent = String(highScore).padStart(3, "0");
  jerryCansCountElement.textContent = String(jerryCansCollected);
  timeElement.textContent = String(Math.max(0, timeLeft)).padStart(2, "0");
  checkScoreMilestones();
}

// Event Listeners
valveButton.addEventListener("click", () => {
  if (gameState === "building") {
    beginFlow();
  } else if (gameState === "ready" || gameState === "paused") {
    startGame();
  }
});

if (startButton) {
  startButton.addEventListener("click", () => {
    if (gameState === "ready" || gameState === "paused") startGame();
  });
}

document.getElementById("rotate-btn").addEventListener("click", rotateCurrentPiece);
document.getElementById("discard-btn").addEventListener("click", discardCurrentPiece);
holdButton.addEventListener("click", holdCurrentPiece);

document.getElementById("restart-btn").addEventListener("click", resetGame);
document.getElementById("retry-btn").addEventListener("click", resetGame);

document.getElementById("next-btn").addEventListener("click", () => {
  levelNumber += 1;
  resetGame();
});

document.getElementById("close-modal-btn").addEventListener("click", () => {
  modal.hidden = true;
});

muteButton.addEventListener("click", () => {
  const isMuted = soundManager.toggleMute();
  updateMuteButton(isMuted);
});

pauseButton.addEventListener("click", () => {
  if (gameState === "building") {
    gameState = "paused";
    clearInterval(timerId);
    updatePauseButton(true);
    statusText.textContent = "Paused";
    helperText.textContent = "Paused. Press the resume button to continue.";
  } else if (gameState === "paused") {
    startGame();
  }
});

// Keyboard controls
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (key === "r") {
    rotateCurrentPiece();
  } else if (key === "h") {
    holdCurrentPiece();
  } else if (key === "d") {
    discardCurrentPiece();
  } else if (event.code === "Space") {
    event.preventDefault();
    valveButton.click();
  }
});

if (milestoneCloseBtn) {
  milestoneCloseBtn.addEventListener("click", () => {
    milestoneToast.hidden = true;
    clearTimeout(milestoneToastTimer);
  });
}

// Difficulty selector controls
difficultyButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode;
    if (mode && mode !== currentDifficulty) {
      updateDifficultyUI(mode);
      levelNumber = 1;
      resetGame();
    }
  });
});

// Initialize game
updateDifficultyUI(currentDifficulty);
resetGame();
