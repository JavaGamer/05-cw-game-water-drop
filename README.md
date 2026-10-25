# Water Pipes

A Pipe Mania-style puzzle game inspired by charity: water. Build a route from a generated treatment plant position to the community tank before pressure is released.

## Play

1. Select **Start pressure**.
2. Click an empty tile to place the next pipe.
3. Use **Rotate piece**, the `R` key, or right-click a placed pipe to rotate it.
4. Connect the plant's `OUT ->` port to the tank's `IN <-` port.
5. Press **Turn on valve** to start the flow early, or let the countdown expire.

Replacing a placed pipe costs 2 points. Flowing through pieces earns points, with bonuses for early flow and cross pipes.

## Architecture

- `index.html` contains the semantic game shell and result modal.
- `styles.css` contains the responsive charity: water-inspired visual system.
- `game-engine.js` contains framework-free game rules: board configuration, generated level routes, pipe definitions, rotations, solution-aware queues, and flow direction decisions.
- `script.js` is the browser controller: DOM rendering, input handling, timers, scoring display, and modal state.

The project uses native ES modules and has no build step or dependency install requirement.

Each new level uses an 8x8 board and generates a validated route with multiple turns. The queue contains every required route piece plus distractors, so the level remains solvable while no longer being a fixed straight line.

## Run locally

Serve the project directory with any static server, for example:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.
