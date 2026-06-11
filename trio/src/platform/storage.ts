/** Сохранение профиля: Telegram CloudStorage с фолбэком на localStorage. */
import { tg, supports } from './telegram';
import { GEMS_START } from '../constants';

export interface Profile {
  /** Текущий уровень (следующий к игре). */
  level: number;
  /** Рекорд: максимальный пройденный уровень. */
  bestLevel: number;
  /** Сыграно раундов (для частоты interstitial). */
  roundsPlayed: number;
  /** Гемы — внутренняя валюта (продолжение после таймаута; покупка за Stars позже). */
  gems: number;
}

export const FRESH_PROFILE: Profile = {
  level: 1,
  bestLevel: 0,
  roundsPlayed: 0,
  gems: GEMS_START,
};

const KEY = 'trio_profile_v1';

function cloudGet(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    const cs = tg?.CloudStorage;
    if (!cs || !supports('6.9')) return resolve(null);
    try {
      cs.getItem(key, (_err, value) => resolve(value ?? null));
    } catch {
      resolve(null);
    }
  });
}

function cloudSet(key: string, value: string): void {
  if (!supports('6.9')) return;
  try {
    tg?.CloudStorage?.setItem(key, value);
  } catch {
    /* CloudStorage недоступен — остаётся localStorage */
  }
}

export async function loadProfile(): Promise<Profile> {
  const raw = (await cloudGet(KEY)) ?? localStorage.getItem(KEY);
  if (!raw) return { ...FRESH_PROFILE };
  try {
    const parsed = JSON.parse(raw) as Profile;
    if (typeof parsed.level !== 'number' || parsed.level < 1) throw new Error('bad save');
    return { ...FRESH_PROFILE, ...parsed };
  } catch {
    return { ...FRESH_PROFILE };
  }
}

export function saveProfile(profile: Profile): void {
  const raw = JSON.stringify(profile);
  localStorage.setItem(KEY, raw);
  cloudSet(KEY, raw);
}
