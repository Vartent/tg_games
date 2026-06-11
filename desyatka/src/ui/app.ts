/** UI: сразу в игру, уровни, змейка с кратной цели суммой, огонёк, гравитация, темы. */
import * as G from '../game';
import * as C from '../constants';
import type { CellPos, Path, PathResult, Round } from '../types';
import { type Profile, loadProfile, saveProfile } from '../platform/storage';
import { initTelegram, haptic, share, tg } from '../platform/telegram';
import { showRewarded, showInterstitial } from '../platform/ads';
import { burst } from './confetti';

const BOT_URL = import.meta.env.VITE_BOT_URL ?? 'https://t.me';
/** Фича-флаг: гемы за rewarded-рекламу. Выключено, пока показ — dev-стаб (иначе бесконечный фарм). */
const REWARDED_GEMS_ENABLED = import.meta.env.VITE_REWARDED_GEMS === '1';
const POP_MS = 170;
const FALL_MS = 280;
/** Отступ тултипа над пальцем — две клетки. */
const TIP_CELLS_UP = 2;

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
          <span class="score"><span id="score">${round.score * C.CHAIN_TARGET}</span><span class="goal">/${round.goal * C.CHAIN_TARGET}</span></span>
        </div>
        <div class="fire" id="fire">🔥</div>
        <div class="side">
          <span class="timer-num" id="timer-num"></span>
          <span class="gems" id="gems">💎 ${profile.gems}</span>
        </div>
      </div>
      <div class="timerbar"><div id="timer-fill" style="width:100%"></div></div>
      <div class="board-wrap"><div class="board" id="board" style="--cols:${round.board[0]!.length};--rows:${round.board.length};grid-template-columns: repeat(${round.board[0]!.length}, 1fr)"></div></div>
      <div class="drag-tip" id="drag-tip" hidden></div>
    </div>`;

  renderBoard();
  bindBoardPointer();
  updateFire();
}

function renderBoard(): void {
  if (!round) return;
  document.getElementById('board')!.innerHTML = round.board
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

// ===== Змейка + тултип у пальца =====

let path: Path = [];

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

const sameCell = (a: CellPos | undefined, b: CellPos) => !!a && a.r === b.r && a.c === b.c;
const inPath = (p: CellPos) => path.some((q) => sameCell(q, p));
const isNeighbor = (a: CellPos, b: CellPos) =>
  Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1; // только по стороне, без диагоналей

/** Тултип с текущей суммой: на TIP_CELLS_UP клеток выше пальца, не выходя за экран. */
function moveTip(x: number, y: number): void {
  if (!round) return;
  const tip = document.getElementById('drag-tip')!;
  tip.hidden = false;
  const sum = G.pathSum(round.board, path);
  const k = G.unitsIn(sum);
  const zero = path.some((p) => round!.board[p.r]?.[p.c] === 0);
  tip.textContent = k > 0 ? `${sum} = ${k}×${C.CHAIN_TARGET}${zero ? ' ×2' : ''}` : String(sum);
  tip.className = `drag-tip${k > 0 ? ' is-target' : sum > C.CHAIN_SUM_CAP ? ' is-over' : ''}`;
  const step = boardStep(document.getElementById('board')!);
  const half = tip.offsetWidth / 2 || 36;
  const tipX = Math.min(Math.max(x, half + 8), window.innerWidth - half - 8);
  let tipY = y - TIP_CELLS_UP * step;
  const minY = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) + 8 || 8;
  if (tipY < minY) tipY = Math.min(y + step, window.innerHeight - 40);
  tip.style.left = `${tipX}px`;
  tip.style.top = `${tipY}px`;
}

function hideTip(): void {
  const tip = document.getElementById('drag-tip');
  if (tip) tip.hidden = true;
}

/** Промах: тултип с застрявшей суммой и штрафом дёргается над последней клеткой ~полсекунды. */
function showPenalty(taken: Path, stuckSum: number, penaltyMs: number): void {
  const last = taken[taken.length - 1];
  if (!last || penaltyMs <= 0) return;
  const cell = tileEl(last.r, last.c)?.getBoundingClientRect();
  if (!cell) return;
  const tip = document.getElementById('drag-tip')!;
  tip.hidden = false;
  tip.textContent = `${stuckSum} · −${Math.round(penaltyMs / 1000)}с`;
  tip.className = 'drag-tip is-over shake';
  tip.style.left = `${cell.left + cell.width / 2}px`;
  tip.style.top = `${Math.max(cell.top - 40, 8)}px`;
  window.setTimeout(() => {
    tip.classList.remove('shake');
    hideTip();
  }, 650);
}

function bindBoardPointer(): void {
  const boardEl = document.getElementById('board')!;

  boardEl.addEventListener('pointerdown', (e) => {
    if (!round || animating || !G.isRoundActive(round, Date.now())) return;
    boardEl.setPointerCapture(e.pointerId);
    const cell = cellFromPoint(boardEl, e.clientX, e.clientY);
    if (!cell || round.board[cell.r]![cell.c] === null) return;
    path = [cell];
    haptic('tap');
    updateSelection();
    moveTip(e.clientX, e.clientY);
  });

  boardEl.addEventListener('pointermove', (e) => {
    if (!round || path.length === 0) return;
    moveTip(e.clientX, e.clientY);
    const cell = cellFromPoint(boardEl, e.clientX, e.clientY);
    if (!cell) return;
    const last = path[path.length - 1]!;
    if (sameCell(last, cell)) return;
    if (sameCell(path[path.length - 2], cell)) {
      path.pop(); // backtrack
      updateSelection();
      moveTip(e.clientX, e.clientY);
      return;
    }
    if (round.board[cell.r]![cell.c] === null || inPath(cell) || !isNeighbor(last, cell)) return;
    // жёсткая обрезка: при сумме >= 24 цепь дальше не растёт (последняя клетка — первая превысившая)
    if (G.pathSum(round.board, path) >= C.CHAIN_SUM_CAP) return;
    path.push(cell);
    haptic('tap');
    updateSelection();
    moveTip(e.clientX, e.clientY);
  });

  const finish = () => {
    hideTip();
    const taken = path;
    path = [];
    updateSelection();
    if (taken.length > 1) attemptPath(taken);
  };
  boardEl.addEventListener('pointerup', finish);
  boardEl.addEventListener('pointercancel', () => {
    hideTip();
    path = [];
    updateSelection();
  });
}

function updateSelection(): void {
  document.querySelectorAll('.tile.sel').forEach((el) => el.classList.remove('sel'));
  for (const p of path) tileEl(p.r, p.c)?.classList.add('sel');
}

// ===== Применение цепочки и анимация =====

function attemptPath(taken: Path): void {
  if (!round || animating) return;
  const now = Date.now();
  if (!G.isRoundActive(round, now)) return;

  const outcome = G.playPath(round, taken, now, Math.random);
  if (!outcome.result) {
    round = outcome.round;
    haptic('error');
    showPenalty(taken, G.pathSum(round.board, taken), outcome.penaltyMs);
    if (!G.isRoundActive(round, Date.now())) {
      if (G.isWon(round)) finishWon();
      else onTimeout();
    }
    return;
  }
  round = outcome.round;
  haptic('success');
  document.getElementById('score')!.textContent = String(round.score * C.CHAIN_TARGET);
  updateFire();

  let cx = 0;
  let cy = 0;
  for (const p of taken) {
    const b = tileEl(p.r, p.c)?.getBoundingClientRect();
    if (b) {
      cx += b.left + b.width / 2;
      cy += b.top + b.height / 2;
    }
  }
  // конфетти масштабируется начислением: мульти-дюжины и огонёк дают залп
  burst(cx / taken.length, cy / taken.length, 10 + outcome.earned * 10);

  animating = true;
  for (const p of taken) tileEl(p.r, p.c)?.classList.add('pop');

  const result: PathResult = outcome.result;
  window.setTimeout(() => {
    renderBoard();
    animateGravity(result);
    window.setTimeout(() => {
      animating = false;
      if (round && G.isWon(round)) finishWon();
    }, FALL_MS);
  }, POP_MS);
}

/** FLIP-анимация: упавшие плитки стартуют со старых позиций, новые — из-за верхнего края. */
function animateGravity(result: PathResult): void {
  const boardEl = document.getElementById('board')!;
  const step = boardStep(boardEl);

  const prepared: HTMLElement[] = [];
  for (const m of result.moves) {
    const el = tileEl(m.to.r, m.to.c);
    if (el) {
      el.style.transform = `translateY(${(m.from.r - m.to.r) * step}px)`;
      prepared.push(el);
    }
  }
  for (const s of result.spawns) {
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
      <div class="big-score">${finished.score * C.CHAIN_TARGET}<span class="label"> очков</span></div>
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
  hideTip();
  path = [];
  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const render = () => {
    if (!round) return;
    const canContinue = !round.extended;
    const enough = profile.gems >= C.CONTINUE_COST_GEMS;
    overlay.innerHTML = `
      <div class="panel">
        <h2>Время вышло</h2>
        <div class="big-score">${round.score * C.CHAIN_TARGET}<span class="label">/${round.goal * C.CHAIN_TARGET} очков</span></div>
        <div class="label">Не хватило ${(round.goal - round.score) * C.CHAIN_TARGET} очков · у тебя 💎 ${profile.gems}</div>
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
