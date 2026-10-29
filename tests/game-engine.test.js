import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIRECTIONS,
  DIFFICULTY_CONFIG,
  GAME_CONFIG,
  OPPOSITE,
  PIPE_TYPES,
  addDifficultyPieces,
  createLevel,
  createQueue,
  createRandomPiece,
  getNextDirection,
  getOpenings,
  validateLevel,
} from "../game-engine.js";

function positionKey(position) {
  return `${position.row},${position.col}`;
}

function directionBetween(from, to) {
  return Object.entries(DIRECTIONS).find(([, vector]) =>
    vector.row === to.row - from.row && vector.col === to.col - from.col,
  )?.[0];
}

function move(position, direction) {
  return {
    row: position.row + DIRECTIONS[direction].row,
    col: position.col + DIRECTIONS[direction].col,
  };
}

function assertRouteInvariants(level) {
  const routeKeys = new Set();
  assert.ok(level.route.length >= 7);
  assert.equal(level.source.col, 0);
  assert.equal(level.destination.col, level.cols - 1);
  assert.ok(level.source.row >= 0 && level.source.row < level.rows);
  assert.ok(level.destination.row >= 0 && level.destination.row < level.rows);

  level.route.forEach((piece, index) => {
    const key = positionKey(piece);
    assert.equal(routeKeys.has(key), false, `duplicate route position: ${key}`);
    routeKeys.add(key);
    assert.ok(piece.row >= 0 && piece.row < level.rows);
    assert.ok(piece.col > 0 && piece.col < level.cols - 1);

    const previous = index === 0 ? level.source : level.route[index - 1];
    const next = index === level.route.length - 1 ? level.destination : level.route[index + 1];
    const previousDirection = directionBetween(piece, previous);
    const nextDirection = directionBetween(piece, next);
    assert.ok(previousDirection, `route gap before ${key}`);
    assert.ok(nextDirection, `route gap after ${key}`);
    assert.ok(getOpenings(piece).includes(previousDirection));
    assert.ok(getOpenings(piece).includes(nextDirection));
  });

  assert.deepEqual(move(level.source, level.source.direction), {
    row: level.route[0].row,
    col: level.route[0].col,
  });
  assert.deepEqual(
    move(level.destination, level.destination.direction),
    {
      row: level.route.at(-1).row,
      col: level.route.at(-1).col,
    },
  );
  assert.equal(OPPOSITE[level.destination.direction], "e");

  // Verify obstacles and jerry cans do not intersect the route
  const allRouteKeys = new Set(level.route.map((p) => `${p.row},${p.col}`));
  allRouteKeys.add(`${level.source.row},${level.source.col}`);
  allRouteKeys.add(`${level.destination.row},${level.destination.col}`);

  (level.obstacles || []).forEach((obs) => {
    assert.equal(allRouteKeys.has(`${obs.row},${obs.col}`), false, "obstacle overlaps route");
  });

  (level.jerryCans || []).forEach((can) => {
    assert.equal(allRouteKeys.has(`${can.row},${can.col}`), false, "jerry can overlaps route");
  });
}

test("generated levels validate across seeds and difficulties", () => {
  for (let difficulty = 1; difficulty <= 4; difficulty += 1) {
    for (let seed = 1; seed <= 100; seed += 1) {
      const level = createLevel(seed, difficulty);
      assert.equal(validateLevel(level), true, `invalid level ${difficulty}/${seed}`);
      assertRouteInvariants(level);
    }
  }
});

test("difficulty two and above include a compatible cross piece", () => {
  for (const difficulty of [2, 3, 10]) {
    for (let seed = 1; seed <= 50; seed += 1) {
      const level = createLevel(seed, difficulty);
      const cross = level.route.find((piece) => piece.type === "cross");
      assert.ok(cross, `missing cross at difficulty ${difficulty}, seed ${seed}`);
      assert.equal(validateLevel(level), true);
    }
  }
});

test("cross upgrade safely preserves routes without straight pieces", () => {
  const cornersOnly = [
    { row: 0, col: 1, type: "corner", rotation: 3 },
    { row: 1, col: 1, type: "corner", rotation: 1 },
    { row: 1, col: 2, type: "corner", rotation: 2 },
    { row: 2, col: 2, type: "corner", rotation: 0 },
  ];
  const upgraded = addDifficultyPieces(cornersOnly, 2);
  assert.deepEqual(upgraded, cornersOnly);
  assert.notEqual(upgraded, cornersOnly);
});

test("route dimensions match the configured board", () => {
  const level = createLevel(42, 1);
  assert.equal(level.rows, GAME_CONFIG.rows);
  assert.equal(level.cols, GAME_CONFIG.cols);
  assert.ok(level.route.every((piece) => piece.col > 0 && piece.col < GAME_CONFIG.cols - 1));
});

test("pipe rotations expose the expected openings", () => {
  assert.deepEqual(getOpenings({ type: "straight", rotation: 0 }), ["e", "w"]);
  assert.deepEqual(getOpenings({ type: "straight", rotation: 1 }), ["s", "n"]);
  assert.deepEqual(getOpenings({ type: "corner", rotation: 0 }), ["n", "e"]);
  assert.deepEqual(getOpenings({ type: "cross", rotation: 3 }), ["w", "n", "e", "s"]);
  assert.deepEqual(getOpenings({ type: "filter", rotation: 0 }), ["e", "w"]);
  assert.deepEqual(getOpenings({ type: "reservoir", rotation: 0 }), ["e", "w"]);
});

test("flow direction respects straight and cross rules", () => {
  assert.equal(getNextDirection({ type: "straight", rotation: 0 }, "e"), "e");
  assert.equal(getNextDirection({ type: "straight", rotation: 1 }, "s"), "s");
  assert.equal(getNextDirection({ type: "cross", rotation: 0 }, "w"), "w");
  assert.equal(getNextDirection({ type: "filter", rotation: 0 }, "e"), "e");
  assert.equal(getNextDirection({ type: "reservoir", rotation: 0 }, "e"), "e");
});

test("random pieces stay within the supported piece and rotation ranges", () => {
  const lowest = createRandomPiece(() => 0);
  const highest = createRandomPiece(() => 0.999999);
  assert.ok(Object.hasOwn(PIPE_TYPES, lowest.type));
  assert.ok(Object.hasOwn(PIPE_TYPES, highest.type));
  assert.equal(lowest.rotation, 0);
  assert.equal(highest.rotation, 3);
});

test("queue preserves every required route piece", () => {
  const level = createLevel(19, 2);
  const routeCounts = new Map();
  level.route.forEach((piece) => {
    const key = `${piece.type}:${piece.rotation}`;
    routeCounts.set(key, (routeCounts.get(key) ?? 0) + 1);
  });
  const queue = createQueue(level, () => 0.25);
  const queueCounts = new Map();
  queue.forEach((piece) => {
    const key = `${piece.type}:${piece.rotation}`;
    queueCounts.set(key, (queueCounts.get(key) ?? 0) + 1);
  });
  routeCounts.forEach((count, key) => {
    assert.ok((queueCounts.get(key) ?? 0) >= count, `missing route piece ${key}`);
  });
});

test("queue creation and difficulty upgrades do not mutate level data", () => {
  const level = createLevel(23, 2);
  const originalRoute = JSON.stringify(level.route);
  createQueue(level, () => 0.75);
  addDifficultyPieces(level.route, 3);
  assert.equal(JSON.stringify(level.route), originalRoute);
});

test("validation rejects a route with a rotated first piece", () => {
  const level = createLevel(31, 1);
  const brokenLevel = {
    ...level,
    route: level.route.map((piece, index) =>
      index === 0 ? { ...piece, rotation: piece.rotation + 1 } : { ...piece },
    ),
  };
  assert.equal(validateLevel(brokenLevel), false);
});

test("DIFFICULTY_CONFIG defines easy, normal, and hard profiles", () => {
  assert.ok(DIFFICULTY_CONFIG.easy);
  assert.ok(DIFFICULTY_CONFIG.normal);
  assert.ok(DIFFICULTY_CONFIG.hard);
  assert.ok(DIFFICULTY_CONFIG.easy.countdownSeconds > DIFFICULTY_CONFIG.hard.countdownSeconds);
  assert.ok(DIFFICULTY_CONFIG.easy.flowDelay > DIFFICULTY_CONFIG.hard.flowDelay);
  assert.ok(DIFFICULTY_CONFIG.hard.discardPenalty > DIFFICULTY_CONFIG.easy.discardPenalty);
});

test("createLevel supports difficulty modes and scales constraints properly", () => {
  const easyLevel = createLevel(77, 1, "easy");
  const hardLevel = createLevel(77, 1, "hard");
  assert.ok(validateLevel(easyLevel));
  assert.ok(validateLevel(hardLevel));
  assert.ok(easyLevel.timeLimit > hardLevel.timeLimit);
  assert.ok(easyLevel.obstacles.length <= hardLevel.obstacles.length);
  assert.equal(easyLevel.mode, "easy");
  assert.equal(hardLevel.mode, "hard");
});
