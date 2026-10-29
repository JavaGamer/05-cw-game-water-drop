// pipe-renderer.js - SVG rendering for water pipes, special pieces, and terrain obstacles.
// Using clean scalable vector graphics ensures pipes connect seamlessly across all screen sizes.

/**
 * Returns SVG markup for a straight pipe (openings: East, West).
 * Can be rotated 90deg via CSS for North, South.
 */
function getStraightSvg(isFlowing) {
  return `
    <g class="pipe-shape pipe-straight">
      <!-- Outer pipe body -->
      <rect x="0" y="21" width="64" height="22" rx="2" fill="var(--pipe-outer, #d2cebe)" stroke="var(--pipe-stroke, #a8a496)" stroke-width="1.5" />
      <!-- Left flange collar -->
      <rect x="0" y="18" width="5" height="28" rx="1.5" fill="var(--pipe-collar, #8e8a7c)" />
      <!-- Right flange collar -->
      <rect x="59" y="18" width="5" height="28" rx="1.5" fill="var(--pipe-collar, #8e8a7c)" />
      <!-- Inner conduit (fills with water when flowing) -->
      <rect class="pipe-conduit ${isFlowing ? "conduit-flowing" : ""}" x="0" y="25" width="64" height="14" fill="${isFlowing ? "var(--blue, #2e9df7)" : "var(--pipe-inner, #f0eee6)"}" />
    </g>
  `;
}

/**
 * Returns SVG markup for a 90-degree corner pipe (openings: North, East).
 */
function getCornerSvg(isFlowing) {
  return `
    <g class="pipe-shape pipe-corner">
      <!-- Outer pipe bend -->
      <path d="M 21 0 L 21 21 L 0 21 L 0 43 L 43 43 L 43 0 Z" fill="none" />
      <path d="M 21 0 C 21 24 40 43 64 43 L 64 21 C 48 21 43 16 43 0 Z" fill="var(--pipe-outer, #d2cebe)" stroke="var(--pipe-stroke, #a8a496)" stroke-width="1.5" />
      <path d="M 21 0 L 43 0 L 43 21 L 64 21 L 64 43 L 21 43 Z" fill="var(--pipe-outer, #d2cebe)" stroke="var(--pipe-stroke, #a8a496)" stroke-width="1.5" />
      <!-- Flange collars -->
      <rect x="18" y="0" width="28" height="5" rx="1.5" fill="var(--pipe-collar, #8e8a7c)" />
      <rect x="59" y="18" width="5" height="28" rx="1.5" fill="var(--pipe-collar, #8e8a7c)" />
      <!-- Inner conduit -->
      <path class="pipe-conduit ${isFlowing ? "conduit-flowing" : ""}" d="M 25 0 L 39 0 L 39 25 L 64 25 L 64 39 L 25 39 Z" fill="${isFlowing ? "var(--blue, #2e9df7)" : "var(--pipe-inner, #f0eee6)"}" />
    </g>
  `;
}

/**
 * Returns SVG markup for a Tee pipe (openings: North, East, West).
 */
function getTeeSvg(isFlowing) {
  return `
    <g class="pipe-shape pipe-tee">
      <!-- Horizontal body -->
      <rect x="0" y="21" width="64" height="22" rx="2" fill="var(--pipe-outer, #d2cebe)" stroke="var(--pipe-stroke, #a8a496)" stroke-width="1.5" />
      <!-- Top branch -->
      <rect x="21" y="0" width="22" height="24" fill="var(--pipe-outer, #d2cebe)" stroke="var(--pipe-stroke, #a8a496)" stroke-width="1.5" />
      <!-- Collars -->
      <rect x="0" y="18" width="5" height="28" rx="1.5" fill="var(--pipe-collar, #8e8a7c)" />
      <rect x="59" y="18" width="5" height="28" rx="1.5" fill="var(--pipe-collar, #8e8a7c)" />
      <rect x="18" y="0" width="28" height="5" rx="1.5" fill="var(--pipe-collar, #8e8a7c)" />
      <!-- Inner conduit -->
      <rect class="pipe-conduit ${isFlowing ? "conduit-flowing" : ""}" x="0" y="25" width="64" height="14" fill="${isFlowing ? "var(--blue, #2e9df7)" : "var(--pipe-inner, #f0eee6)"}" />
      <rect class="pipe-conduit ${isFlowing ? "conduit-flowing" : ""}" x="25" y="0" width="14" height="28" fill="${isFlowing ? "var(--blue, #2e9df7)" : "var(--pipe-inner, #f0eee6)"}" />
    </g>
  `;
}

/**
 * Returns SVG markup for a 4-way cross pipe (openings: North, East, South, West).
 */
function getCrossSvg(isFlowing) {
  return `
    <g class="pipe-shape pipe-cross">
      <!-- Horizontal pipe -->
      <rect x="0" y="21" width="64" height="22" rx="2" fill="var(--pipe-outer, #d2cebe)" stroke="var(--pipe-stroke, #a8a496)" stroke-width="1.5" />
      <!-- Vertical pipe -->
      <rect x="21" y="0" width="22" height="64" rx="2" fill="var(--pipe-outer, #d2cebe)" stroke="var(--pipe-stroke, #a8a496)" stroke-width="1.5" />
      <!-- Collars on all 4 ends -->
      <rect x="0" y="18" width="5" height="28" rx="1.5" fill="var(--pipe-collar, #8e8a7c)" />
      <rect x="59" y="18" width="5" height="28" rx="1.5" fill="var(--pipe-collar, #8e8a7c)" />
      <rect x="18" y="0" width="28" height="5" rx="1.5" fill="var(--pipe-collar, #8e8a7c)" />
      <rect x="18" y="59" width="28" height="5" rx="1.5" fill="var(--pipe-collar, #8e8a7c)" />
      <!-- Inner conduit cross -->
      <rect class="pipe-conduit ${isFlowing ? "conduit-flowing" : ""}" x="0" y="25" width="64" height="14" fill="${isFlowing ? "var(--blue, #2e9df7)" : "var(--pipe-inner, #f0eee6)"}" />
      <rect class="pipe-conduit ${isFlowing ? "conduit-flowing" : ""}" x="25" y="0" width="14" height="64" fill="${isFlowing ? "var(--blue, #2e9df7)" : "var(--pipe-inner, #f0eee6)"}" />
    </g>
  `;
}

/**
 * Returns SVG markup for a Water Filter pipe (openings: East, West).
 * Purifies water for +30 bonus points.
 */
function getFilterSvg(isFlowing) {
  return `
    <g class="pipe-shape pipe-filter">
      <!-- Pipe stems -->
      <rect x="0" y="21" width="64" height="22" rx="2" fill="var(--pipe-outer, #d2cebe)" stroke="var(--pipe-stroke, #a8a496)" stroke-width="1.5" />
      <rect x="0" y="18" width="5" height="28" rx="1.5" fill="var(--pipe-collar, #8e8a7c)" />
      <rect x="59" y="18" width="5" height="28" rx="1.5" fill="var(--pipe-collar, #8e8a7c)" />
      <rect class="pipe-conduit ${isFlowing ? "conduit-flowing" : ""}" x="0" y="25" width="64" height="14" fill="${isFlowing ? "var(--blue, #2e9df7)" : "var(--pipe-inner, #f0eee6)"}" />
      <!-- Central Carbon Filter Chamber -->
      <circle cx="32" cy="32" r="16" fill="#202b38" stroke="#ffc907" stroke-width="2.5" />
      <circle cx="32" cy="32" r="12" fill="${isFlowing ? "#159a48" : "#2f4053"}" />
      <!-- Droplet filter icon in center -->
      <path d="M 32 24 C 32 24 27 30 27 33 C 27 36 29.2 38 32 38 C 34.8 38 37 36 37 33 C 37 30 32 24 32 24 Z" fill="#ffffff" />
    </g>
  `;
}

/**
 * Returns SVG markup for a Reservoir / Cistern pipe (openings: East, West).
 * Pauses water flow for 2 seconds to relieve pressure.
 */
function getReservoirSvg(isFlowing) {
  return `
    <g class="pipe-shape pipe-reservoir">
      <!-- Pipe stems -->
      <rect x="0" y="21" width="64" height="22" rx="2" fill="var(--pipe-outer, #d2cebe)" stroke="var(--pipe-stroke, #a8a496)" stroke-width="1.5" />
      <rect x="0" y="18" width="5" height="28" rx="1.5" fill="var(--pipe-collar, #8e8a7c)" />
      <rect x="59" y="18" width="5" height="28" rx="1.5" fill="var(--pipe-collar, #8e8a7c)" />
      <rect class="pipe-conduit ${isFlowing ? "conduit-flowing" : ""}" x="0" y="25" width="64" height="14" fill="${isFlowing ? "var(--blue, #2e9df7)" : "var(--pipe-inner, #f0eee6)"}" />
      <!-- Large Cistern Tank Body -->
      <rect x="17" y="13" width="30" height="38" rx="6" fill="#1e3448" stroke="#2e9df7" stroke-width="2" />
      <!-- Internal water gauge levels -->
      <line x1="21" y1="21" x2="43" y2="21" stroke="rgba(255,255,255,0.3)" stroke-dasharray="2 2" stroke-width="1.5" />
      <line x1="21" y1="32" x2="43" y2="32" stroke="rgba(255,255,255,0.3)" stroke-dasharray="2 2" stroke-width="1.5" />
      <line x1="21" y1="43" x2="43" y2="43" stroke="rgba(255,255,255,0.3)" stroke-dasharray="2 2" stroke-width="1.5" />
      <!-- Water fill animation inside reservoir -->
      <rect x="19" y="${isFlowing ? "17" : "34"}" width="26" height="${isFlowing ? "32" : "15"}" rx="3" fill="var(--blue, #2e9df7)" opacity="${isFlowing ? "0.95" : "0.45"}" />
    </g>
  `;
}

/**
 * Returns full SVG string for any pipe type and rotation.
 * @param {string} type - "straight", "corner", "tee", "cross", "filter", "reservoir"
 * @param {number} rotation - Rotation index 0..3 (multiplied by 90 degrees)
 * @param {boolean} isFlowing - Whether water is currently flowing through
 * @param {boolean} isGhost - Whether this is a placement preview ghost
 * @returns {string} SVG HTML string
 */
export function renderPipeSvg(type, rotation = 0, isFlowing = false, isGhost = false) {
  let content = "";
  if (type === "corner") content = getCornerSvg(isFlowing);
  else if (type === "tee") content = getTeeSvg(isFlowing);
  else if (type === "cross") content = getCrossSvg(isFlowing);
  else if (type === "filter") content = getFilterSvg(isFlowing);
  else if (type === "reservoir") content = getReservoirSvg(isFlowing);
  else content = getStraightSvg(isFlowing); // default to straight

  const ghostClass = isGhost ? "pipe-svg-ghost" : "";
  const flowingClass = isFlowing ? "pipe-svg-flowing" : "";
  const rotationDegrees = (rotation % 4) * 90;

  return `
    <svg class="pipe-svg ${ghostClass} ${flowingClass}" viewBox="0 0 64 64" width="100%" height="100%" style="transform: rotate(${rotationDegrees}deg)">
      ${content}
    </svg>
  `;
}

/**
 * Returns SVG markup for an unbuildable terrain obstacle (bedrock/boulder).
 * @returns {string} SVG HTML string
 */
export function renderObstacleSvg() {
  return `
    <svg class="obstacle-svg" viewBox="0 0 64 64" width="100%" height="100%">
      <!-- Dry ground patch -->
      <rect x="4" y="4" width="56" height="56" rx="4" fill="#dfdacf" opacity="0.6" />
      <path d="M 8 18 L 22 28 L 14 46" stroke="#c0baa8" stroke-width="1.5" fill="none" stroke-linecap="round" />
      <path d="M 54 20 L 42 30 L 48 50" stroke="#c0baa8" stroke-width="1.5" fill="none" stroke-linecap="round" />
      <!-- Granite boulder -->
      <polygon points="18,48 14,32 24,18 40,16 50,26 48,46 32,52" fill="#7d786d" stroke="#5a564d" stroke-width="2" />
      <!-- Rock highlight and shadow facets -->
      <polygon points="24,18 40,16 35,32 22,30" fill="#9e988b" />
      <polygon points="35,32 40,16 50,26 44,38" fill="#6d685e" />
      <polygon points="18,48 22,30 35,32 32,52" fill="#545047" />
    </svg>
  `;
}

/**
 * Returns HTML markup for a Jerry Can collectible badge.
 * @returns {string} HTML string
 */
export function renderJerryCanBadge(bonus = 50) {
  return `
    <div class="jerry-can-badge" title="Community Jerry Can: Route water here for +${bonus} bonus points!">
      <img src="img/water-can-transparent.png" alt="Jerry Can bonus" class="jerry-can-img" />
      <span class="jerry-can-tag">+${bonus}</span>
    </div>
  `;
}
