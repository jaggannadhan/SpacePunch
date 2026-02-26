/**
 * Spawn confetti pieces around a DOM element.
 * Uses CSS animations and auto-removes after completion.
 */
export function spawnConfetti(
  anchorEl: HTMLElement,
  count = 12,
  durationMs = 900,
): void {
  const rect = anchorEl.getBoundingClientRect();
  const colors = ['#ff4444', '#ffcc00', '#44ff44', '#4488ff', '#ff44ff', '#00ffff'];

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';

    // Random color
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

    // Start position: centered on the element with small random offset
    const startX = rect.left + rect.width / 2 + (Math.random() - 0.5) * rect.width;
    const startY = rect.top + rect.height / 2;
    piece.style.left = `${startX}px`;
    piece.style.top = `${startY}px`;

    // Random end offset
    const endX = (Math.random() - 0.5) * 80;
    const endY = -(Math.random() * 50 + 20);
    const rotation = (Math.random() - 0.5) * 720;
    piece.style.setProperty('--confetti-dx', `${endX}px`);
    piece.style.setProperty('--confetti-dy', `${endY}px`);
    piece.style.setProperty('--confetti-rot', `${rotation}deg`);
    piece.style.animationDuration = `${durationMs}ms`;

    // Random size (small rectangles)
    const w = 4 + Math.random() * 4;
    const h = 2 + Math.random() * 3;
    piece.style.width = `${w}px`;
    piece.style.height = `${h}px`;

    document.body.appendChild(piece);

    // Auto-remove after animation
    setTimeout(() => piece.remove(), durationMs + 50);
  }
}
