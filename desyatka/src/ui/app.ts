/** UI: сразу в игру; рамка с суммой цели; поле истощается; уровни со звёздами + доска дня. */
import * as G from '../game';
import * as C from '../constants';
import type { CellPos, Rect, Round } from '../types';
import { type Profile, loadProfile, saveProfile } from '../platform/storage';
import { initTelegram, haptic, share, tg } from '../platform/telegram';
import { showRewarded, showInterstitial } from '../platform/ads';
import { burst } from './confetti';

const BOT_URL = import.meta.env.VITE_BOT_URL ?? 'https://t.me';
/** Фича-флаг: гемы за rewarded-рекламу. Выключено, пока показ — dev-стаб (иначе бесконечный фарм). */
const REWARDED_GEMS_ENABLED = import.meta.env.VITE_REWARDED_GEMS === '1';
const POP_MS = 170;
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

// ===== Дата доски дня (UTC — поле общее для всех) =====

function dailyToday(): { seed: number; iso: string; label: string } {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return {
    seed: y * 10000 + m * 100 + day,
    iso: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    label: `${String(day).padStart(2, '0')}.${String(m).padStart(2, '0')}`,
  };
}

function isoYesterday(): string {
  const d = new Date(Date.now() - 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// ===== Запуск раундов =====

function startCurrentLevel(): void {
  stopTimer();
  round = G.startLevel(profile.level, Math.floor(Math.random() * 2 ** 31), Date.now());
  renderGame();
  timerId = window.setInterval(onTimerTick, 100);
}

function startDailyRound(): void {
  stopTimer();
  const today = dailyToday();
  // попытка фиксируется на старте — рестартами не абьюзится
  profile.daily.streak = profile.daily.playedOn === isoYesterday() ? profile.daily.streak + 1 : 1;
  profile.daily.playedOn = today.iso;
  saveProfile(profile);
  round = G.startDaily(today.seed, Date.now());
  renderGame();
  timerId = window.setInterval(onTimerTick, 100);
}

function renderGame(): void {
  if (!round) return;
  const stageTitle = round.daily
    ? `<span class="lvl">доска дня ${dailyToday().label}</span>`
    : `<span class="lvl">ур. ${round.level} <button class="daily-btn" id="daily-btn">📅</button></span>`;
  const goal = round.daily
    ? ''
    : `<span class="goal">/${round.goal * C.RECT_TARGET}</span>`;
  app.innerHTML = `
    <div class="game">
      <div class="hud">
        <div class="stage">
          ${stageTitle}
          <span class="score"><span id="score">${round.score * C.RECT_TARGET}</span>${goal}</span>
        </div>
        <div class="fire" id="fire">🔥</div>
        <div class="side">
          <span class="timer-num" id="timer-num"></span>
          <span class="gems" id="gems">💎 ${profile.gems}</span>
          <span class="clear-pct" id="clear-pct">0% поля</span>
        </div>
      </div>
      <div class="timerbar"><div id="timer-fill" style="width:100%"></div></div>
      <div class="board-wrap"><div class="board" id="board" style="--cols:${C.COLS};--rows:${C.ROWS};grid-template-columns: repeat(${C.COLS}, 1fr)"></div></div>
      <div class="drag-tip" id="drag-tip" hidden></div>
    </div>`;

  renderBoard();
  bindBoardPointer();
  document.getElementById('daily-btn')?.addEventListener('click', openDailyOverlay);
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

function updateScore(): void {
  if (!round) return;
  const el = document.getElementById('score');
  if (el) el.textContent = String(round.score * C.RECT_TARGET);
  const pct = document.getElementById('clear-pct');
  if (pct) pct.textContent = `${Math.round(G.clearedRatio(round) * 100)}% поля`;
}

/** Индикатор серии: потушен / горит с обратным отсчётом. */
function updateFire(): void {
  if (!round) return;
  const el = document.getElementById('fire');
  if (!el) return;
  const now = Date.now();
  if (G.isFireActive(round, now)) {
    const left = Math.ceil((round.fireUntil - now) / 1000);
    el.className = 'fire lit';
    el.textContent = `🔥 ×${C.FIRE_MULT} · ${left}с`;
  } else {
    el.className = 'fire';
    el.textContent = '🔥';
  }
}

// ===== Рамка указателем =====

let anchor: CellPos | null = null;
let lastCell: CellPos | null = null;

function boardStep(boardEl: HTMLElement): number {
  const first = boardEl.querySelector<HTMLElement>('.tile');
  if (!first) return 40;
  return first.getBoundingClientRect().height + (parseFloat(getComputedStyle(boardEl).gap) || 4);
}

/** Клетка под точкой; за границами — ближайшая клетка (рамку удобно тянуть с заходом за край). */
function cellFromPoint(boardEl: HTMLElement, x: number, y: number): CellPos | null {
  if (!round) return null;
  const first = boardEl.querySelector<HTMLElement>('.tile');
  if (!first) return null;
  const fr = first.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(boardEl).gap) || 4;
  const c = Math.floor((x - fr.left) / (fr.width + gap));
  const r = Math.floor((y - fr.top) / (fr.height + gap));
  return {
    r: Math.max(0, Math.min(round.board.length - 1, r)),
    c: Math.max(0, Math.min(round.board[0]!.length - 1, c)),
  };
}

function updateSelection(rect: Rect | null): void {
  document.querySelectorAll('.tile.sel').forEach((el) => el.classList.remove('sel'));
  if (!rect) return;
  for (let r = rect.r1; r <= rect.r2; r++) {
    for (let c = rect.c1; c <= rect.c2; c++) tileEl(r, c)?.classList.add('sel');
  }
}

/** Тултип с текущей суммой рамки: выше пальца, не выходя за экран. */
function moveTip(x: number, y: number, rect: Rect): void {
  if (!round) return;
  const tip = document.getElementById('drag-tip')!;
  tip.hidden = false;
  const sum = G.rectSum(round.board, rect);
  tip.textContent = String(sum);
  tip.className = `drag-tip${sum === C.RECT_TARGET ? ' is-target' : sum > C.RECT_TARGET ? ' is-over' : ''}`;
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

function bindBoardPointer(): void {
  const boardEl = document.getElementById('board')!;

  boardEl.addEventListener('pointerdown', (e) => {
    if (!round || animating || !G.isRoundActive(round, Date.now())) return;
    try {
      boardEl.setPointerCapture(e.pointerId);
    } catch {
      /* захват — best-effort */
    }
    anchor = cellFromPoint(boardEl, e.clientX, e.clientY);
    lastCell = anchor;
    if (!anchor) return;
    haptic('tap');
    const rect = G.normRect(anchor, anchor);
    updateSelection(rect);
    moveTip(e.clientX, e.clientY, rect);
  });

  boardEl.addEventListener('pointermove', (e) => {
    if (!round || !anchor) return;
    const cell = cellFromPoint(boardEl, e.clientX, e.clientY);
    if (!cell) return;
    if (lastCell && cell.r === lastCell.r && cell.c === lastCell.c) {
      moveTip(e.clientX, e.clientY, G.normRect(anchor, cell));
      return;
    }
    lastCell = cell;
    haptic('tap');
    const rect = G.normRect(anchor, cell);
    updateSelection(rect);
    moveTip(e.clientX, e.clientY, rect);
  });

  const finish = () => {
    hideTip();
    updateSelection(null);
    if (anchor && lastCell) attemptRect(anchor, lastCell);
    anchor = null;
    lastCell = null;
  };
  boardEl.addEventListener('pointerup', finish);
  boardEl.addEventListener('pointercancel', () => {
    hideTip();
    updateSelection(null);
    anchor = null;
    lastCell = null;
  });
}

// ===== Ход =====

function attemptRect(a: CellPos, b: CellPos): void {
  if (!round || animating) return;
  const now = Date.now();
  if (!G.isRoundActive(round, now)) return;

  const outcome = G.playRect(round, a, b, now);
  if (outcome.popped.length === 0) {
    haptic('error');
    return; // невалидная рамка — просто сброс, без штрафов
  }
  round = outcome.round;
  haptic('success');

  let cx = 0;
  let cy = 0;
  for (const p of outcome.popped) {
    const el = tileEl(p.r, p.c);
    el?.classList.add('pop');
    const rb = el?.getBoundingClientRect();
    if (rb) {
      cx += rb.left + rb.width / 2;
      cy += rb.top + rb.height / 2;
    }
  }
  burst(cx / outcome.popped.length, cy / outcome.popped.length, 8 + outcome.earnedCells * 4);
  updateScore();
  updateFire();

  animating = true;
  window.setTimeout(() => {
    renderBoard();
    animating = false;
    if (!round) return;
    if (outcome.over) endRound('no-moves');
  }, POP_MS);
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
  if (!G.isRoundActive(round, now)) endRound('time');
}

// ===== Финал раунда =====

function endRound(reason: 'time' | 'no-moves'): void {
  if (!round) return;
  stopTimer();
  hideTip();
  updateSelection(null);
  if (round.daily) finishDaily();
  else if (G.isWon(round)) finishWon();
  else showLose(reason);
}

const starsLine = (n: number) => '★★★'.slice(0, n).padEnd(3, '☆');

function finishWon(): void {
  if (!round) return;
  const finished = round;
  round = null;
  const stars = G.starsFor(finished);
  const perfect = finished.cleared === finished.totalCells;
  profile.roundsPlayed++;
  profile.bestLevel = Math.max(profile.bestLevel, finished.level);
  profile.stars[String(finished.level)] = Math.max(profile.stars[String(finished.level)] ?? 0, stars);
  if (perfect) profile.perfects++;
  profile.level = finished.level + 1;
  saveProfile(profile);
  burst(window.innerWidth / 2, window.innerHeight / 3, 70);

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="panel">
      <h2>Уровень ${finished.level} пройден! 🎉</h2>
      <div class="stars">${starsLine(stars)}</div>
      ${perfect ? '<div class="perfect">PERFECT — поле вычищено!</div>' : ''}
      <div class="big-score">${finished.score * C.RECT_TARGET}<span class="label"> очков</span></div>
      <div class="label">Очистка ${Math.round(G.clearedRatio(finished) * 100)}% · рекорд: уровень ${profile.bestLevel}</div>
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

/** Проигрыш уровня: выкуп продолжения (только по таймауту) или заново. */
function showLose(reason: 'time' | 'no-moves'): void {
  if (!round) return;
  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const render = () => {
    if (!round) return;
    const canContinue = reason === 'time' && !round.extended;
    const enough = profile.gems >= C.CONTINUE_COST_GEMS;
    overlay.innerHTML = `
      <div class="panel">
        <h2>${reason === 'time' ? 'Время вышло' : 'Ходов больше нет'}</h2>
        <div class="big-score">${round.score * C.RECT_TARGET}<span class="label">/${round.goal * C.RECT_TARGET} очков</span></div>
        <div class="label">Не хватило ${(round.goal - round.score) * C.RECT_TARGET} очков · у тебя 💎 ${profile.gems}</div>
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

// ===== Доска дня =====

function openDailyOverlay(): void {
  const today = dailyToday();
  const played = profile.daily.playedOn === today.iso;
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="panel">
      <h2>📅 Доска дня ${today.label}</h2>
      <div class="label">Одно поле на всех · одна попытка · 2 минуты</div>
      ${
        played
          ? `<div class="big-score">${profile.daily.lastScore}<span class="label"> очков сегодня</span></div>
             <div class="label">Стрик ${profile.daily.streak} 🔥 · рекорд ${profile.daily.best}</div>
             <div class="label">Новая доска — завтра</div>
             <button class="primary" id="d-share">Похвастаться</button>`
          : `<div class="label">Стрик ${profile.daily.streak} 🔥 · рекорд ${profile.daily.best}</div>
             <button class="primary" id="d-play">Играть</button>`
      }
      <button class="ghost" id="d-close">Закрыть</button>
    </div>`;
  app.appendChild(overlay);
  overlay.querySelector('#d-play')?.addEventListener('click', () => {
    overlay.remove();
    startDailyRound();
  });
  overlay.querySelector('#d-share')?.addEventListener('click', () => {
    share(G.shareDailyText(today.label, profile.daily.lastScore, profile.daily.streak), BOT_URL);
  });
  overlay.querySelector('#d-close')?.addEventListener('click', () => overlay.remove());
}

function finishDaily(): void {
  if (!round) return;
  const finished = round;
  round = null;
  const points = finished.score * C.RECT_TARGET;
  const today = dailyToday();
  profile.roundsPlayed++;
  profile.daily.lastScore = points;
  profile.daily.best = Math.max(profile.daily.best, points);
  saveProfile(profile);
  burst(window.innerWidth / 2, window.innerHeight / 3, 70);

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="panel">
      <h2>📅 Доска дня ${today.label}</h2>
      <div class="big-score">${points}<span class="label"> очков</span></div>
      <div class="label">Очистка ${Math.round(G.clearedRatio(finished) * 100)}% · стрик ${profile.daily.streak} 🔥 · рекорд ${profile.daily.best}</div>
      <button class="primary" id="d-share">Похвастаться</button>
      <button class="ghost" id="d-back">К уровням</button>
    </div>`;
  app.appendChild(overlay);
  overlay.querySelector('#d-share')!.addEventListener('click', () => {
    share(G.shareDailyText(today.label, points, profile.daily.streak), BOT_URL);
  });
  overlay.querySelector('#d-back')!.addEventListener('click', () => {
    overlay.remove();
    startCurrentLevel();
  });
}

function stopTimer(): void {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}
