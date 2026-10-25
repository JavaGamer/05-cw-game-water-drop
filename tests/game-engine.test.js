import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIRECTIONS,
  GAME_CONFIG,
  OPPOSITE,
  addDifficultyPieces,
  createLevel,
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
