/** UI «Трио»: сразу в игру, свап свайпом, каскады, огонёк, уровни, темы. */
import * as G from '../game';
import * as C from '../constants';
import type { CellPos, Round, Swap, SwapOutcome, Wave } from '../types';
import { type Profile, loadProfile, saveProfile } from '../platform/storage';
import { initTelegram, haptic, share, tg } from '../platform/telegram';
import { showRewarded, showInterstitial } from '../platform/ads';
import { burst } from './confetti';

const BOT_URL = import.meta.env.VITE_BOT_URL ?? 'https://t.me';
/** Фича-флаг: гемы за rewarded-рекламу. Выключено, пока показ — dev-стаб (иначе бесконечный фарм). */
const REWARDED_GEMS_ENABLED = import.meta.env.VITE_REWARDED_GEMS === '1';
const SWAP_MS = 150;
const POP_MS = 180;
const FALL_MS = 280;
/** Доля клетки, которую надо протащить палец, чтобы свап сработал. */
const SWIPE_FRACTION = 0.35;

let profile: Profile;
let round: Round | null = null;
let timerId: number | null = null;
let animating = false;

const app = document.getElementById('app')!;

export async function start(): Promise<void> {
  document.title = C.GAME_NAME;
  initTelegram();
  applyTheme();
  profile = await loadProfile();
  startCurrentLevel();
}

function applyTheme(): void {
  const scheme =
    tg?.colorScheme ??
    (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.dataset.theme = scheme;
}

// ===== Запуск уровня =====

function startCurrentLevel(): void {
  stopTimer();
  const now = Date.now();
  round = G.startLevel(profile.level, Math.floor(Math.random() * 2 ** 31), now);
  renderGame();
  timerId = window.setInterval(onTimerTick, 100);
}

function renderGame(): void {
  if (!round) return;
  app.innerHTML = `
    <div class="game">
      <div class="hud">
        <div class="stage">
          <span class="lvl">ур. ${round.level}</span>
          <span class="score"><span id="score">${round.score * C.GROUP_TARGET}</span><span class="goal">/${round.goal * C.GROUP_TARGET}</span></span>
        </div>
        <div class="fire" id="fire">🔥</div>
        <div class="side">
          <span class="timer-num" id="timer-num"></span>
          <span class="gems" id="gems">💎 ${profile.gems}</span>
        </div>
      </div>
      <div class="timerbar"><div id="timer-fill" style="width:100%"></div></div>
      <div class="board" id="board" style="grid-template-columns: repeat(${round.board[0]!.length}, 1fr)"></div>
      <div class="drag-tip" id="drag-tip" hidden></div>
    </div>`;

  renderBoard();
  fitBoard();
  bindBoardPointer();
  updateFire();
}

/** Ограничить ширину доски так, чтобы все ряды влезали по высоте (плитки квадратные). */
function fitBoard(): void {
  if (!round) return;
  const boardEl = document.getElementById('board');
  if (!boardEl) return;
  const r = round.board.length;
  const c = round.board[0]!.length;
  const gap = parseFloat(getComputedStyle(boardEl).gap) || 4;
  boardEl.style.maxWidth = '';
  const tile = Math.min(
    (boardEl.clientWidth - gap * (c - 1)) / c,
    (boardEl.clientHeight - gap * (r - 1)) / r,
  );
  boardEl.style.maxWidth = `${Math.floor(tile * c + gap * (c - 1))}px`;
  boardEl.style.margin = '0 auto';
  boardEl.style.width = '100%';
}

window.addEventListener('resize', fitBoard);

function renderBoard(board = round?.board): void {
  if (!board) return;
  document.getElementById('board')!.innerHTML = board
    .map((row, r) =>
      row
        .map((tile, c) =>
          tile === null
            ? `<div class="tile empty" data-r="${r}" data-c="${c}"></div>`
            : `<div class="tile d${tile}" data-r="${r}" data-c="${c}">${tile}</div>`,
        )
        .join(''),
    )
    .join('');
}

function tileEl(r: number, c: number): HTMLElement | null {
  return document.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
}

function updateGems(): void {
  const el = document.getElementById('gems');
  if (el) el.textContent = `💎 ${profile.gems}`;
}

function updateScore(): void {
  if (!round) return;
  const el = document.getElementById('score');
  if (el) el.textContent = String(round.score * C.GROUP_TARGET);
}

/** Индикатор огонька: потушен / горит ×N с обратным отсчётом. */
function updateFire(): void {
  if (!round) return;
  const el = document.getElementById('fire');
  if (!el) return;
  const now = Date.now();
  if (G.isFireActive(round, now)) {
    const left = Math.ceil((round.fireUntil - now) / 1000);
    el.className = 'fire lit';
    el.textContent = `🔥 ×${round.fireMult} · ${left}с`;
  } else {
    el.className = 'fire';
    el.textContent = '🔥';
  }
}

// ===== Свайп-ввод =====

let dragFrom: CellPos | null = null;
let dragX = 0;
let dragY = 0;

function boardStep(boardEl: HTMLElement): number {
  const first = boardEl.querySelector<HTMLElement>('.tile');
  if (!first) return 40;
  return first.getBoundingClientRect().height + (parseFloat(getComputedStyle(boardEl).gap) || 4);
}

function cellFromPoint(boardEl: HTMLElement, x: number, y: number): CellPos | null {
  if (!round) return null;
  const first = boardEl.querySelector<HTMLElement>('.tile');
  if (!first) return null;
  const fr = first.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(boardEl).gap) || 4;
  const c = Math.floor((x - fr.left) / (fr.width + gap));
  const r = Math.floor((y - fr.top) / (fr.height + gap));
  if (r < 0 || c < 0 || r >= round.board.length || c >= round.board[0]!.length) return null;
  return { r, c };
}

function clearPicked(): void {
  document.querySelectorAll('.tile.sel').forEach((el) => el.classList.remove('sel'));
}

function bindBoardPointer(): void {
  const boardEl = document.getElementById('board')!;

  boardEl.addEventListener('pointerdown', (e) => {
    if (!round || animating || !G.isRoundActive(round, Date.now())) return;
    try {
      boardEl.setPointerCapture(e.pointerId);
    } catch {
      /* захват — best-effort: указатель мог уже потеряться */
    }
    const cell = cellFromPoint(boardEl, e.clientX, e.clientY);
    if (!cell || round.board[cell.r]![cell.c] === null) return;
    dragFrom = cell;
    dragX = e.clientX;
    dragY = e.clientY;
    haptic('tap');
    tileEl(cell.r, cell.c)?.classList.add('sel');
  });

  boardEl.addEventListener('pointermove', (e) => {
    if (!round || !dragFrom) return;
    const dx = e.clientX - dragX;
    const dy = e.clientY - dragY;
    const threshold = boardStep(boardEl) * SWIPE_FRACTION;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
    const dir: CellPos =
      Math.abs(dx) > Math.abs(dy) ? { r: 0, c: Math.sign(dx) } : { r: Math.sign(dy), c: 0 };
    const target = { r: dragFrom.r + dir.r, c: dragFrom.c + dir.c };
    const swap: Swap = { a: dragFrom, b: target };
    dragFrom = null;
    clearPicked();
    attemptSwap(swap);
  });

  const reset = () => {
    dragFrom = null;
    clearPicked();
  };
  boardEl.addEventListener('pointerup', reset);
  boardEl.addEventListener('pointercancel', reset);
}

// ===== Ход и анимация =====

/** Сообщение «перемешали» по центру доски. */
function showReshuffle(): void {
  const tip = document.getElementById('drag-tip');
  const boardEl = document.getElementById('board');
  if (!tip || !boardEl) return;
  const b = boardEl.getBoundingClientRect();
  tip.hidden = false;
  tip.textContent = 'Нет ходов — перемешали';
  tip.className = 'drag-tip is-target';
  tip.style.left = `${b.left + b.width / 2}px`;
  tip.style.top = `${b.top + b.height / 2}px`;
  window.setTimeout(() => {
    tip.hidden = true;
  }, 1200);
}

function attemptSwap(swap: Swap): void {
  if (!round || animating) return;
  const now = Date.now();
  if (!G.isRoundActive(round, now)) return;

  const outcome = G.playSwap(round, swap, now, Math.random);
  round = outcome.round;

  if (!outcome.waves) {
    haptic('error');
    nudgeTiles(swap);
    return;
  }

  haptic('success');
  animating = true;
  void animateMove(swap, outcome).then(() => {
    animating = false;
    updateScore();
    updateFire();
    if (round && G.isWon(round)) finishWon();
  });
}

/** Невалидный свап: обе плитки дёргаются. */
function nudgeTiles(swap: Swap): void {
  for (const p of [swap.a, swap.b]) {
    const el = tileEl(p.r, p.c);
    if (!el) continue;
    el.classList.add('nudge');
    window.setTimeout(() => el.classList.remove('nudge'), 350);
  }
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** Анимация хода: свап навстречу -> волны (лопанье + падение) -> перемешка, если была. */
async function animateMove(swap: Swap, outcome: SwapOutcome): Promise<void> {
  const swapped = outcome.swapped!;
  const waves = outcome.waves!;

  // 1. свап: плитки едут навстречу
  await animateSwapTiles(swap);
  renderBoard(swapped);

  // 2. волны каскада
  for (const w of waves) {
    popWave(w);
    await sleep(POP_MS);
    renderBoard(w.board);
    animateGravity(w);
    await sleep(FALL_MS);
  }

  // 3. перемешка, если после хода не осталось свапов
  renderBoard();
  if (outcome.reshuffled) showReshuffle();
}

async function animateSwapTiles(swap: Swap): Promise<void> {
  const ea = tileEl(swap.a.r, swap.a.c);
  const eb = tileEl(swap.b.r, swap.b.c);
  if (!ea || !eb) return;
  const ra = ea.getBoundingClientRect();
  const rb = eb.getBoundingClientRect();
  ea.style.transition = `transform ${SWAP_MS}ms ease`;
  eb.style.transition = `transform ${SWAP_MS}ms ease`;
  ea.style.transform = `translate(${rb.left - ra.left}px, ${rb.top - ra.top}px)`;
  eb.style.transform = `translate(${ra.left - rb.left}px, ${ra.top - rb.top}px)`;
  ea.style.zIndex = '2';
  await sleep(SWAP_MS + 20);
}

/** Лопанье волны: pop-анимация и конфетти от центра лопнувших. */
function popWave(w: Wave): void {
  let cx = 0;
  let cy = 0;
  let n = 0;
  for (const p of w.popped) {
    const el = tileEl(p.r, p.c);
    if (!el) continue;
    el.classList.add('pop');
    const b = el.getBoundingClientRect();
    cx += b.left + b.width / 2;
    cy += b.top + b.height / 2;
    n++;
  }
  if (n > 0) burst(cx / n, cy / n, 8 + w.groups * 10);
  haptic('tap');
}

/** FLIP-анимация: упавшие плитки стартуют со старых позиций, новые — из-за верхнего края. */
function animateGravity(w: Wave): void {
  const boardEl = document.getElementById('board')!;
  const step = boardStep(boardEl);

  const prepared: HTMLElement[] = [];
  for (const m of w.moves) {
    const el = tileEl(m.to.r, m.to.c);
    if (el) {
      el.style.transform = `translateY(${(m.from.r - m.to.r) * step}px)`;
      prepared.push(el);
    }
  }
  for (const s of w.spawns) {
    const el = tileEl(s.r, s.c);
    if (el) {
      el.style.transform = `translateY(${-(s.r + 1) * step}px)`;
      prepared.push(el);
    }
  }
  void boardEl.offsetHeight;
  for (const el of prepared) {
    el.classList.add('fall');
    el.style.transform = '';
  }
  window.setTimeout(() => {
    for (const el of prepared) el.classList.remove('fall');
  }, FALL_MS + 30);
}

// ===== Таймер =====

function onTimerTick(): void {
  if (!round || animating) return;
  const now = Date.now();
  const remaining = Math.max(0, round.endsAt - now);
  const total = round.endsAt - round.startedAt;
  const fill = document.getElementById('timer-fill');
  const num = document.getElementById('timer-num');
  if (fill && num) {
    const low = remaining < 15_000;
    fill.style.width = `${(remaining / total) * 100}%`;
    fill.className = low ? 'low' : '';
    const sec = Math.ceil(remaining / 1000);
    num.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    num.className = `timer-num${low ? ' low' : ''}`;
  }
  updateFire();
  if (!G.isRoundActive(round, now)) {
    if (G.isWon(round)) finishWon();
    else onTimeout();
  }
}

// ===== Финал раунда =====

function finishWon(): void {
  if (!round) return;
  stopTimer();
  const finished = round;
  round = null;
  profile.roundsPlayed++;
  profile.bestLevel = Math.max(profile.bestLevel, finished.level);
  profile.level = finished.level + 1;
  saveProfile(profile);
  burst(window.innerWidth / 2, window.innerHeight / 3, 70);

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="panel">
      <h2>Уровень ${finished.level} пройден! 🎉</h2>
      <div class="big-score">${finished.score * C.GROUP_TARGET}<span class="label"> очков</span></div>
      <div class="label">Рекорд: уровень ${profile.bestLevel}</div>
      <button class="primary" id="res-next">Дальше — уровень ${finished.level + 1}</button>
      <button class="ghost" id="res-share">Поделиться</button>
    </div>`;
  app.appendChild(overlay);
  overlay.querySelector('#res-next')!.addEventListener('click', () => {
    overlay.remove();
    startCurrentLevel();
  });
  overlay.querySelector('#res-share')!.addEventListener('click', () => {
    share(G.shareText(profile.bestLevel), BOT_URL);
  });
}

/** Таймаут: предлагаем выкупить продолжение за гемы. Раунд жив до выбора игрока. */
function onTimeout(): void {
  if (!round) return;
  stopTimer();
  dragFrom = null;
  clearPicked();
  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const render = () => {
    if (!round) return;
    const canContinue = !round.extended;
    const enough = profile.gems >= C.CONTINUE_COST_GEMS;
    overlay.innerHTML = `
      <div class="panel">
        <h2>Время вышло</h2>
        <div class="big-score">${round.score * C.GROUP_TARGET}<span class="label">/${round.goal * C.GROUP_TARGET} очков</span></div>
        <div class="label">Не хватило ${(round.goal - round.score) * C.GROUP_TARGET} очков · у тебя 💎 ${profile.gems}</div>
        ${canContinue && enough ? `<button class="primary" id="to-continue">Продолжить +30 сек · 💎 ${C.CONTINUE_COST_GEMS}</button>` : ''}
        ${
          canContinue && !enough && REWARDED_GEMS_ENABLED
            ? `<button class="primary" id="to-earn">💎 +${C.GEMS_PER_REWARDED} за рекламу 📺</button>`
            : ''
        }
        <button class="ghost" id="to-retry">Заново · уровень ${round.level}</button>
      </div>`;

    overlay.querySelector('#to-continue')?.addEventListener('click', () => {
      if (!round) return;
      profile.gems -= C.CONTINUE_COST_GEMS;
      saveProfile(profile);
      round = G.continueRound(round, Date.now());
      overlay.remove();
      updateGems();
      timerId = window.setInterval(onTimerTick, 100);
    });
    overlay.querySelector('#to-earn')?.addEventListener('click', async () => {
      const ok = await showRewarded();
      if (ok) {
        profile.gems += C.GEMS_PER_REWARDED;
        saveProfile(profile);
        updateGems();
        render();
      }
    });
    overlay.querySelector('#to-retry')?.addEventListener('click', () => {
      round = null;
      profile.roundsPlayed++;
      saveProfile(profile);
      const due = profile.roundsPlayed % 2 === 0;
      const show = due ? showInterstitial() : Promise.resolve();
      void show.finally(() => {
        overlay.remove();
        startCurrentLevel();
      });
    });
  };

  render();
  app.appendChild(overlay);
}

function stopTimer(): void {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}
