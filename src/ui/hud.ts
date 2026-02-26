import { settingsStore } from '../game/systems/SettingsStore';
import type { GameScene, SkinEntry } from '../game/scenes/GameScene';
import skinsManifest from '../assets/skins/skins.json';
import lootManifest from '../assets/loot/loot.json';
export interface HUDState {
  timer: string;
  stage: number;
  comboLevel: number;
  damage: number;
  difficultyLabel: string;
  blinkTimer: boolean;
  shieldLevel: number;
  gold: number;
  diamond: number;
  ruby: number;
  ultimateActive: boolean;
  ultimateProgress: number;
}

/**
 * DOM-based HUD overlay with accordion settings panel.
 */
export class HUD {
  private scene: GameScene;

  // Top-left stats
  private timerEl: HTMLElement;
  private stageEl: HTMLElement;
  private lootLineEl: HTMLElement;
  private lootCounts: Record<string, HTMLElement> = {};

  // Ultimate progress bar (replaces timer during ultimate)
  private ultimateBarContainer: HTMLElement;
  private ultimateBarFill: HTMLElement;

  // Right-side bars
  private damageFill: HTMLElement;
  private damageLabel: HTMLElement;
  private comboFill: HTMLElement;
  private comboLabel: HTMLElement;
  private comboBarEl: HTMLElement;

  // Bottom-left
  private diffLabel: HTMLElement;
  private settingsPanel: HTMLElement;
  private shieldEl: HTMLElement;
  private shieldTicks: HTMLElement[] = [];

  // Game over overlay
  private gameOverEl: HTMLElement;
  private goPoints: HTMLElement;
  private goStage: HTMLElement;
  private retryBtn: HTMLButtonElement;

  private panelOpen = false;

  // Accordion tracking for outside-click collapse
  private accordions: { wrapper: HTMLElement; body: HTMLElement; arrow: HTMLElement }[] = [];

  // Skin grid items for highlight tracking
  private skinItems: Map<string, HTMLElement> = new Map();

  constructor(scene: GameScene) {
    this.scene = scene;

    let container = document.getElementById('hud');
    if (!container) {
      container = document.createElement('div');
      container.id = 'hud';
      document.body.appendChild(container);
    }
    container.innerHTML = '';

    // ── Top-left stats ──
    const stats = this.el('div', 'hud-stats', container);
    this.timerEl = this.el('div', 'hud-timer', stats);

    // Ultimate progress bar (hidden by default, replaces timer text)
    this.ultimateBarContainer = this.el('div', 'ultimate-bar', stats);
    this.ultimateBarContainer.style.display = 'none';
    this.ultimateBarFill = this.el('div', 'ultimate-bar-fill', this.ultimateBarContainer);

    this.stageEl = this.el('div', 'hud-stage', stats);
    this.lootLineEl = this.el('div', 'hud-loot', stats);

    // Build loot icons from manifest (same PNGs as falling loot)
    for (const entry of lootManifest as { id: string; file: string }[]) {
      const img = document.createElement('img');
      img.src = `assets/loot/${entry.file}`;
      img.className = 'hud-loot-icon';
      img.alt = entry.id;
      this.lootLineEl.appendChild(img);

      const countSpan = document.createElement('span');
      countSpan.className = 'hud-loot-count';
      countSpan.textContent = '0';
      this.lootLineEl.appendChild(countSpan);

      this.lootCounts[entry.id] = countSpan;
    }

    // Shield status + bar
    this.shieldEl = this.el('div', 'hud-shield', stats);
    const shieldBar = this.el('div', 'shield-bar', stats);
    this.shieldTicks = [];
    for (let i = 1; i <= 10; i++) {
      // Insert separator before tick 4 and tick 8
      if (i === 4 || i === 8) {
        this.el('div', 'shield-sep', shieldBar);
      }
      const tick = this.el('div', 'shield-tick', shieldBar);
      this.shieldTicks.push(tick);
    }

    // ── Right-side bars wrapper ──
    const barsWrapper = this.el('div', 'hud-bars-right', container);

    // Combo bar (left)
    this.comboBarEl = this.el('div', 'combo-bar', barsWrapper);
    this.comboFill = this.el('div', 'combo-fill', this.comboBarEl);
    this.comboLabel = this.el('div', 'combo-label', this.comboBarEl);
    const comboVtext = this.el('div', 'combo-vtext', this.comboBarEl);
    comboVtext.textContent = 'COMBO';

    // Damage bar (right)
    const damageBar = this.el('div', 'damage-bar', barsWrapper);
    this.damageFill = this.el('div', 'damage-fill', damageBar);
    this.damageLabel = this.el('div', 'damage-label', damageBar);
    const damageVtext = this.el('div', 'damage-vtext', damageBar);
    damageVtext.textContent = 'DAMAGE';

    // ── Bottom-left: difficulty label + settings ──
    const bottomLeft = this.el('div', 'hud-bottom-left', container);
    this.diffLabel = this.el('div', 'diff-label', bottomLeft);

    // Mute button (above settings)
    const muteBtn = this.el('button', 'mute-btn', bottomLeft);
    const muted = settingsStore.get().muted;
    muteBtn.textContent = muted ? '\u{1F507}' : '\u{1F50A}';
    muteBtn.addEventListener('click', () => {
      const nowMuted = !settingsStore.get().muted;
      settingsStore.set({ muted: nowMuted });
      muteBtn.textContent = nowMuted ? '\u{1F507}' : '\u{1F50A}';
      this.scene.sound.mute = nowMuted;
    });

    const settingsBtn = this.el('button', 'settings-btn', bottomLeft);
    settingsBtn.innerHTML = '&#9881;';
    settingsBtn.addEventListener('click', () => this.togglePanel());

    // ── Settings panel with accordions ──
    this.settingsPanel = this.el('div', 'settings-panel', container);
    this.settingsPanel.style.display = 'none';
    this.buildSettingsPanel();

    // Close panel + accordions when clicking outside
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const inPanel = this.settingsPanel.contains(target);
      const inBtn = settingsBtn.contains(target);
      if (!inPanel && !inBtn) {
        this.collapseAllAccordions();
        if (this.panelOpen) {
          this.panelOpen = false;
          this.settingsPanel.style.display = 'none';
        }
      }
    });

    // ── Game over overlay ──
    this.gameOverEl = this.el('div', 'game-over', container);
    this.gameOverEl.style.display = 'none';

    this.el('div', 'go-title', this.gameOverEl).textContent = 'GAME OVER';
    this.goPoints = this.el('div', 'go-points', this.gameOverEl);
    this.goStage = this.el('div', 'go-stage', this.gameOverEl);

    // Retry button
    this.retryBtn = document.createElement('button');
    this.retryBtn.className = 'go-retry-btn';
    this.retryBtn.textContent = 'Retry';
    this.retryBtn.addEventListener('click', () => this.handleRetry());
    this.gameOverEl.appendChild(this.retryBtn);

    const goHint = this.el('div', 'go-restart', this.gameOverEl);
    goHint.textContent = 'Press R to Retry';
  }

  update(state: HUDState): void {
    // Timer vs ultimate progress bar swap
    if (state.ultimateActive) {
      this.timerEl.style.display = 'none';
      this.ultimateBarContainer.style.display = 'block';
      this.ultimateBarFill.style.width = `${Math.min(state.ultimateProgress * 100, 100)}%`;
    } else {
      this.timerEl.style.display = '';
      this.ultimateBarContainer.style.display = 'none';
      this.timerEl.textContent = `Timer: ${state.timer}`;
    }

    this.stageEl.textContent = `Stage: ${state.stage}`;

    // Combo bar fill (0–100)
    const comboPct = Math.min(state.comboLevel, 100);
    this.comboFill.style.height = `${comboPct}%`;
    this.comboLabel.textContent = `${Math.round(comboPct)}`;

    // Update loot counts (DOM structure built once in constructor)
    if (this.lootCounts.gold) this.lootCounts.gold.textContent = String(state.gold);
    if (this.lootCounts.diamond) this.lootCounts.diamond.textContent = String(state.diamond);
    if (this.lootCounts.ruby) this.lootCounts.ruby.textContent = String(state.ruby);

    if (state.blinkTimer) {
      this.timerEl.classList.add('blink');
    } else {
      this.timerEl.classList.remove('blink');
    }

    const pct = Math.min(state.damage, 100);
    this.damageFill.style.height = `${pct}%`;
    this.damageLabel.textContent = `${Math.round(pct)}`;

    if (pct < 40) {
      this.damageFill.style.backgroundColor = '#44cc44';
    } else if (pct < 70) {
      this.damageFill.style.backgroundColor = '#cccc44';
    } else {
      this.damageFill.style.backgroundColor = '#cc4444';
    }

    this.diffLabel.textContent = state.difficultyLabel;

    // Shield status text
    const lvl = state.shieldLevel;
    const active = lvl > 0;
    this.shieldEl.textContent = active ? 'SHIELD ON' : 'SHIELD OFF';
    this.shieldEl.style.color = active ? '#fff' : '#666';

    // Shield segmented bar
    for (let i = 0; i < this.shieldTicks.length; i++) {
      const tick = this.shieldTicks[i];
      const tickNum = i + 1; // 1-based
      const filled = tickNum <= lvl;

      let color: string;
      if (tickNum <= 3) color = '#ff4444';
      else if (tickNum <= 7) color = '#ffaa22';
      else color = '#44cc44';

      tick.style.backgroundColor = filled ? color : 'rgba(255,255,255,0.1)';
    }
  }

  showGameOver(comboLevel: number, stage: number): void {
    this.gameOverEl.style.display = 'flex';
    this.goPoints.textContent = `Combo: ${comboLevel}`;
    this.goStage.textContent = `Stage: ${stage}`;
    this.retryBtn.disabled = false;
  }

  hideGameOver(): void {
    this.gameOverEl.style.display = 'none';
  }

  private handleRetry(): void {
    // Prevent double-click
    this.retryBtn.disabled = true;
    this.scene.restartGame();
  }

  // ── Panel ──

  private togglePanel(): void {
    this.panelOpen = !this.panelOpen;
    this.settingsPanel.style.display = this.panelOpen ? 'flex' : 'none';
  }

  private buildSettingsPanel(): void {
    const title = this.el('div', 'sp-title', this.settingsPanel);
    title.textContent = 'Settings';

    // Accordion: Difficulty
    this.buildAccordion('Difficulty', this.settingsPanel, (body) => {
      this.buildDifficultySection(body);
    });

    // Accordion: Skins
    this.buildAccordion('Skins', this.settingsPanel, (body) => {
      this.buildSkinsSection(body);
    });
  }

  private buildAccordion(
    label: string,
    parent: HTMLElement,
    buildContent: (body: HTMLElement) => void,
  ): void {
    const wrapper = this.el('div', 'accordion', parent);

    const header = this.el('button', 'accordion-header', wrapper);
    const arrow = this.el('span', 'accordion-arrow', header);
    arrow.textContent = '\u25B6'; // ▶
    const text = this.el('span', 'accordion-label', header);
    text.textContent = label;

    const body = this.el('div', 'accordion-body', wrapper);
    body.style.display = 'none';

    this.accordions.push({ wrapper, body, arrow });

    header.addEventListener('click', () => {
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      arrow.textContent = open ? '\u25B6' : '\u25BC'; // ▶ / ▼
    });

    buildContent(body);
  }

  private collapseAllAccordions(): void {
    for (const acc of this.accordions) {
      acc.body.style.display = 'none';
      acc.arrow.textContent = '\u25B6';
    }
  }

  // ── Difficulty section ──

  private buildDifficultySection(body: HTMLElement): void {
    const s = settingsStore.get();

    // Toggle: Use Stage Presets
    const toggleRow = this.el('div', 'sp-row', body);
    const toggleLabel = this.el('label', 'sp-label', toggleRow);
    toggleLabel.textContent = 'Use Stage Presets';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = s.useStagePresets;
    toggle.className = 'sp-toggle';
    toggle.addEventListener('change', () => {
      settingsStore.set({ useStagePresets: toggle.checked });
      intensitySlider.disabled = toggle.checked;
      speedSlider.disabled = toggle.checked;
      disabledHint.style.display = toggle.checked ? 'block' : 'none';
    });
    toggleRow.appendChild(toggle);

    const disabledHint = this.el('div', 'sp-hint', body);
    disabledHint.textContent = 'Turn off presets to customize';
    disabledHint.style.display = s.useStagePresets ? 'block' : 'none';

    // Meteor Intensity slider
    const iRow = this.el('div', 'sp-row', body);
    const iLabel = this.el('label', 'sp-label', iRow);
    iLabel.textContent = 'Meteor Intensity';
    const intensitySlider = document.createElement('input');
    intensitySlider.type = 'range';
    intensitySlider.min = '1';
    intensitySlider.max = '10';
    intensitySlider.value = String(s.meteorIntensity);
    intensitySlider.disabled = s.useStagePresets;
    intensitySlider.className = 'sp-slider';
    const iVal = this.el('span', 'sp-val', iRow);
    iVal.textContent = String(s.meteorIntensity);
    intensitySlider.addEventListener('input', () => {
      const v = parseInt(intensitySlider.value);
      iVal.textContent = String(v);
      settingsStore.set({ meteorIntensity: v });
    });
    iRow.appendChild(intensitySlider);
    iRow.appendChild(iVal);

    // Trail Speed slider
    const sRow = this.el('div', 'sp-row', body);
    const sLabel = this.el('label', 'sp-label', sRow);
    sLabel.textContent = 'Trail Speed';
    const speedSlider = document.createElement('input');
    speedSlider.type = 'range';
    speedSlider.min = '1';
    speedSlider.max = '10';
    speedSlider.value = String(s.trailSpeed);
    speedSlider.disabled = s.useStagePresets;
    speedSlider.className = 'sp-slider';
    const sVal = this.el('span', 'sp-val', sRow);
    sVal.textContent = String(s.trailSpeed);
    speedSlider.addEventListener('input', () => {
      const v = parseInt(speedSlider.value);
      sVal.textContent = String(v);
      settingsStore.set({ trailSpeed: v });
    });
    sRow.appendChild(speedSlider);
    sRow.appendChild(sVal);
  }

  // ── Skins section ──

  private buildSkinsSection(body: HTMLElement): void {
    const skins = skinsManifest as SkinEntry[];
    const currentSkinId = settingsStore.get().selectedSkinId;

    const grid = this.el('div', 'skins-grid', body);

    for (const skin of skins) {
      const item = this.el('div', 'skin-item', grid);
      if (skin.id === currentSkinId) item.classList.add('skin-selected');

      const thumb = document.createElement('img');
      thumb.src = `assets/skins/${skin.file}`;
      thumb.alt = skin.name;
      thumb.className = 'skin-thumb';
      thumb.onerror = () => {
        thumb.style.display = 'none';
        const fb = this.el('div', 'skin-thumb-fallback', item);
        fb.textContent = '?';
        item.insertBefore(fb, nameEl);
      };
      item.appendChild(thumb);

      const nameEl = this.el('div', 'skin-name', item);
      nameEl.textContent = skin.name;

      this.skinItems.set(skin.id, item);

      item.addEventListener('click', () => this.selectSkin(skin.id));
    }
  }

  private selectSkin(skinId: string): void {
    for (const [id, el] of this.skinItems) {
      el.classList.toggle('skin-selected', id === skinId);
    }

    settingsStore.set({ selectedSkinId: skinId });
    this.scene.car.setSkin(`skin_${skinId}`);
  }

  // ── Public accessors for VFX ──

  /** Timer DOM element, exposed for confetti anchoring. */
  get timerElement(): HTMLElement {
    return this.timerEl;
  }

  /** Flash a "+N" badge near the combo bar, then auto-remove. */
  flashComboDelta(n: number): void {
    const delta = document.createElement('span');
    delta.className = 'hud-combo-delta';
    delta.textContent = `+${n}`;
    this.comboBarEl.appendChild(delta);
    setTimeout(() => delta.remove(), 520);
  }

  // ── Helpers ──

  private el(tag: string, cls: string, parent: HTMLElement): HTMLElement {
    const e = document.createElement(tag);
    e.className = cls;
    parent.appendChild(e);
    return e;
  }
}
