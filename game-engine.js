export const GAME_CONFIG = Object.freeze({
  rows: 8,
  cols: 8,
  queueSize: 5,
  countdownSeconds: 12,
});

export const DIRECTIONS = Object.freeze({
  n: Object.freeze({ row: -1, col: 0 }),
  e: Object.freeze({ row: 0, col: 1 }),
  s: Object.freeze({ row: 1, col: 0 }),
  w: Object.freeze({ row: 0, col: -1 }),
});

export const OPPOSITE = Object.freeze({ n: "s", e: "w", s: "n", w: "e" });
const DIRECTION_ORDER = ["n", "e", "s", "w"];

export const PIPE_TYPES = Object.freeze({
  straight: Object.freeze({
    label: "Straight",
    openings: Object.freeze(["e", "w"]),
    symbol: "━",
  }),
  corner: Object.freeze({
    label: "Corner",
    openings: Object.freeze(["n", "e"]),
    symbol: "└",
  }),
  tee: Object.freeze({
    label: "Tee",
    openings: Object.freeze(["n", "e", "w"]),
    symbol: "┴",
  }),
  cross: Object.freeze({
    label: "Cross",
    openings: Object.freeze(["n", "e", "s", "w"]),
    symbol: "+",
  }),
});

function createSeededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function getRandomItem(items, random) {
  return items[Math.floor(random() * items.length)];
}

function shuffle(items, random) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function getPositionKey(position) {
  return `${position.row},${position.col}`;
}

function getDirectionBetween(from, to) {
  const rowDelta = to.row - from.row;
  const colDelta = to.col - from.col;
  return Object.entries(DIRECTIONS).find(
    ([, vector]) => vector.row === rowDelta && vector.col === colDelta,
  )?.[0];
}

function isInsideRouteArea(position, rows, cols) {
  return (
    position.row >= 0 &&
    position.row < rows &&
    position.col >= 1 &&
    position.col < cols - 1
  );
}

function countTurns(route) {
  let turns = 0;
  for (let index = 1; index < route.length - 1; index += 1) {
    const previousDirection = getDirectionBetween(route[index - 1], route[index]);
    const nextDirection = getDirectionBetween(route[index], route[index + 1]);
    if (previousDirection !== nextDirection) turns += 1;
  }
  return turns;
}

function findRoute(
  source,
  destination,
  random,
  minimumTurns,
  requireStraight,
  rows,
  cols,
) {
  const start = { row: source.row, col: source.col + 1 };
  const goal = { row: destination.row, col: destination.col - 1 };
  let searchBudget = 1500;
  const route = [start];
  const visited = new Set([getPositionKey(start)]);

  function search(current) {
    searchBudget -= 1;
    if (searchBudget < 0) return null;
    if (current.row === goal.row && current.col === goal.col) {
      const hasStraight = route.some((_, index) => {
        if (index === 0 || index === route.length - 1) return false;
        return (
          getDirectionBetween(route[index - 1], route[index]) ===
          getDirectionBetween(route[index], route[index + 1])
        );
      });
      return route.length >= 7 && countTurns(route) >= minimumTurns && (!requireStraight || hasStraight)
        ? route.slice()
        : null;
    }

    const candidates = Object.values(DIRECTIONS)
      .map((vector) => ({ row: current.row + vector.row, col: current.col + vector.col }))
      .filter(
        (position) =>
          isInsideRouteArea(position, rows, cols) &&
          !visited.has(getPositionKey(position)),
      );

    shuffle(candidates, random);
    for (const candidate of candidates) {
      const key = getPositionKey(candidate);
      visited.add(key);
      route.push(candidate);
      const result = search(candidate);
      if (result) return result;
      route.pop();
      visited.delete(key);
    }
    return null;
  }

  return search(start);
}

function findPieceForOpenings(openings) {
  const normalizedOpenings = [...openings].sort().join(",");
  for (const [type, definition] of Object.entries(PIPE_TYPES)) {
    for (let rotation = 0; rotation < 4; rotation += 1) {
      const rotated = definition.openings.map(
        (opening) => DIRECTION_ORDER[(DIRECTION_ORDER.indexOf(opening) + rotation) % 4],
      );
      if ([...rotated].sort().join(",") === normalizedOpenings) {
        return { type, rotation };
      }
    }
  }
  throw new Error(`No pipe matches openings: ${normalizedOpenings}`);
}

function createRoutePieces(route, source, destination, difficulty) {
  const pieces = route.map((position, index) => {
    const previous = index === 0 ? source : route[index - 1];
    const next = index === route.length - 1 ? destination : route[index + 1];
    return {
      ...position,
      ...findPieceForOpenings([
        getDirectionBetween(position, previous),
        getDirectionBetween(position, next),
      ]),
    };
  });
  return addDifficultyPieces(pieces, difficulty);
}

export function addDifficultyPieces(pieces, difficulty) {
  const enhancedPieces = pieces.map((piece) => ({ ...piece }));
  if (difficulty >= 2) {
    const crossIndex = enhancedPieces.findIndex((piece) => piece.type === "straight");
    if (crossIndex >= 0) {
      enhancedPieces[crossIndex] = {
        ...enhancedPieces[crossIndex],
        type: "cross",
        rotation: 0,
      };
    }
  }
  return enhancedPieces;
}

export function createLevel(seed = Date.now(), difficulty = 1) {
  const random = createSeededRandom(seed);
  const minimumTurns = Math.min(1 + difficulty, 3);
  const source = { row: Math.floor(random() * GAME_CONFIG.rows), col: 0, direction: "e" };
  const destination = {
    row: Math.floor(random() * GAME_CONFIG.rows),
    col: GAME_CONFIG.cols - 1,
    direction: "w",
  };

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const route = findRoute(
      source,
      destination,
      random,
      minimumTurns,
      difficulty >= 2,
      GAME_CONFIG.rows,
      GAME_CONFIG.cols,
    );
    if (route) {
      return {
        seed,
        rows: GAME_CONFIG.rows,
        cols: GAME_CONFIG.cols,
        source,
        destination,
        difficulty,
        timeLimit: Math.max(8, GAME_CONFIG.countdownSeconds - difficulty + 1),
        route: createRoutePieces(route, source, destination, difficulty),
      };
    }
  }
  throw new Error("Unable to generate a solvable level");
}

export function createRandomPiece(random = Math.random) {
  const types = Object.keys(PIPE_TYPES);
  return {
    type: getRandomItem(types, random),
    rotation: Math.floor(random() * 4),
  };
}

export function createQueue(level, random = Math.random) {
  const routePieces = level.route.map(({ type, rotation }) => ({ type, rotation }));
  const distractors = routePieces.slice(0, Math.max(2, Math.floor(routePieces.length / 3))).map(() => createRandomPiece(random));
  const pieces = [...routePieces, ...distractors];
  return shuffle(pieces, random);
}

export function getOpenings(piece) {
  if (!piece) return [];
  return PIPE_TYPES[piece.type].openings.map(
    (opening) => DIRECTION_ORDER[(DIRECTION_ORDER.indexOf(opening) + (piece.rotation % 4)) % 4],
  );
}

export function getNextDirection(piece, entryDirection) {
  if (piece.type === "cross") return entryDirection;
  return getOpenings(piece).find((opening) => opening !== OPPOSITE[entryDirection]);
}

export function validateLevel(level) {
  let direction = level.source.direction;
  let position = { row: level.source.row, col: level.source.col };
  const pieces = new Map(level.route.map((piece) => [getPositionKey(piece), piece]));
  const visited = new Set();

  while (true) {
    const vector = DIRECTIONS[direction];
    position = { row: position.row + vector.row, col: position.col + vector.col };
    if (position.row === level.destination.row && position.col === level.destination.col) return true;
    const key = getPositionKey(position);
    if (visited.has(key)) return false;
    visited.add(key);
    const piece = pieces.get(key);
    if (!piece || !getOpenings(piece).includes(OPPOSITE[direction])) return false;
    direction = getNextDirection(piece, direction);
    if (!direction) return false;
  }
}
