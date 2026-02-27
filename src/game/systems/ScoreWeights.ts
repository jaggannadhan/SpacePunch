// ── Weighted Scoring Constants ──
// Each gameplay event awards points toward the player's total score.

export const NEAR_MISS_WEIGHT   = 10;  // per combo point (×1=10, ×3=30, ×5=50)
export const METEOR_BLAST_SMALL = 40;  // destroying a small meteor (< 40px)
export const METEOR_BLAST_BIG   = 70;  // destroying a big meteor (>= 40px)
export const GOLD_PICKUP        = 15;
export const DIAMOND_PICKUP     = 50;
export const RUBY_PICKUP        = 80;
export const SHIELD_PICKUP      = 25;
