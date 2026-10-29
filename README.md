# Water Pipes

A Pipe Mania-style puzzle game inspired by charity: water. Build a route from a generated treatment plant position to the community tank before pressure is released.

## Play

1. Select **Turn on valve to start** (or press `Space`) on top of the game board to open the valve, start the pressure timer, and unlock pipe placement.
2. Hover over empty tiles to see a translucent **Ghost Preview** of your upcoming piece.
3. Click an empty tile to place the next pipe. You can keep placing and rotating pipes even while water is actively flowing!
4. **Controls**:
   - `Space` or **Turn on valve**: Open the valve to start the round; press while building to release water flow early for a bonus.
   - `R` or **Rotate piece** (or right-click a placed pipe): Rotate pipe.
   - `H` or **Hold slot**: Stash a piece or swap with a held piece (once per placement).
   - `D` or **Discard**: Cycle past an unwanted piece (-5 points).
5. **Bonus Objectives & Special Fixtures**:
   - **Jerry Cans**: Route water through yellow Jerry Cans on the map for **+50 bonus points**.
   - **Water Filter Pipe**: Clears sediment as water flows through for **+30 bonus points**.
   - **Reservoir / Cistern Pipe**: Absorbs surge pressure, pausing water flow for **3 seconds** to give you extra time.
   - **Bedrock Obstacles**: Natural granite boulders that pipes must route around.
6. Connect the plant's `OUT ->` port to the tank's `IN <-` port before water spills.

Replacing a placed pipe costs 2 points. Flowing through pieces earns points, with bonuses for early flow, cross pipes, filters, and Jerry Cans.

## Difficulty Modes

Select your preferred challenge at any time using the mode selector in the mission panel:

- **Easy**: Relaxed 20s pressure countdown, slower flow rate (1.5s per pipe), fewer obstacles (0–1), reduced discard penalty (-2 pts), and replacement cost (-1 pt).
- **Normal**: Standard 14s pressure countdown, balanced flow (1.1s per pipe), standard obstacles (2–3), discard penalty (-5 pts), and replacement cost (-2 pts).
- **Hard**: Intense 8s pressure countdown, rapid water flow (0.75s per pipe), high obstacle density (3–5), strict penalties (-10 pts discard, -4 pts replace), and higher Jerry Can reward (+75 pts).

Your chosen mode automatically persists in `localStorage` across rounds and sessions.

## charity: water Branding & Mission

- **Typography**: Adheres to charity: water brand guidelines by prioritizing `Proxima Nova`, `Avenir`, and `Manrope`, accompanied by `DM Mono` for figures and counters.
- **Campaign Links**: Branded campaign footer with direct links to [charity: water's official website](https://www.charitywater.org) and [donation portal](https://www.charitywater.org/donate).
- **Interactive DOM Feedback**: Live DOM interaction including Jerry Can collectible removal with pop animation, dynamic pipe placement & rotation in the SVG grid, queue shifts, and floating score feedback popups.

- `index.html`: Semantic game shell, stats panel, hold card, and result breakdown modal.
- `styles.css`: Responsive charity: water visual system with SVG pipe styling, animated water glow, red filling leak countdown border, and board-top controls.
- `game-engine.js`: Pure framework-free game rules: level generation, solvable routes, pipe definitions, rotations, obstacles, Jerry Can placement, and flow directions.
- `pipe-renderer.js`: Crisp SVG generator for pipes, special filter/reservoir chambers, boulders, and badges.
- `audio.js`: Zero-dependency browser Web Audio procedural synthesizer (place, rotate, tick, flow, bonus, reservoir, win, lose, and mute toggle).
- `script.js`: DOM controller: persistent board DOM, active in-flow placement, 1.0s filling leak warning timer, 3.0s reservoir buffer, hold & discard logic, audio hooks, `localStorage` high score persistence, and modal breakdown.

The project uses native ES modules and has no build step or dependency install requirement.

## Run Locally

Serve the project directory with any static server:

```bash
python -m http.server 4173
```

Then open `http://localhost:4173` in your browser.

## Run Tests

- **In the browser**: Open `http://localhost:4173/tests/test-runner.html` to run the visual assertion test suite.
- **With Node.js** (if installed):
  ```bash
  node --test
  ```
