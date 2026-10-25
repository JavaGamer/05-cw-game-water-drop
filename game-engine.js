export const GAME_CONFIG = Object.freeze({
  rows: 7,
  cols: 9,
  queueSize: 5,
  countdownSeconds: 12,
  guaranteedPieces: 7,
  source: Object.freeze({ row: 3, col: 0 }),
  destination: Object.freeze({ row: 3, col: 8 }),
});

export const DIRECTIONS = Object.freeze({
  n: Object.freeze({ row: -1, col: 0 }),
  e: Object.freeze({ row: 0, col: 1 }),
  s: Object.freeze({ row: 1, col: 0 }),
  w: Object.freeze({ row: 0, col: -1 }),
});

export const OPPOSITE = Object.freeze({ n: "s", e: "w", s: "n", w: "e" });

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

export function createRandomPiece(random = Math.random) {
  const types = Object.keys(PIPE_TYPES);
  return {
    type: types[Math.floor(random() * types.length)],
    rotation: Math.floor(random() * 4),
  };
}

export function createNextPiece(guaranteedPiecesRemaining, random = Math.random) {
  if (guaranteedPiecesRemaining > 0) {
    return {
      piece: { type: "straight", rotation: 0 },
      remaining: guaranteedPiecesRemaining - 1,
    };
  }
  return { piece: createRandomPiece(random), remaining: 0 };
}

export function getOpenings(piece) {
  if (!piece) return [];
  const order = ["n", "e", "s", "w"];
  return PIPE_TYPES[piece.type].openings.map(
    (opening) => order[(order.indexOf(opening) + (piece.rotation % 4)) % 4],
  );
}

export function getNextDirection(piece, entryDirection) {
  if (piece.type === "cross") return entryDirection;
  return getOpenings(piece).find(
    (opening) => opening !== OPPOSITE[entryDirection],
  );
}
