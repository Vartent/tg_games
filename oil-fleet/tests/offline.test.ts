import { describe, it, expect } from 'vitest';
import { applyOffline, storageCap, rigRate, loadTanker, dispatchTanker } from '../src/engine';
import { stateWithRigs, fixedRng } from './helpers';
import * as C from '../src/constants';

describe('оффлайн-прогресс', () => {
  it('вышки качают за время отсутствия', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1 }], { lastTickAt: 0 });
    const s1 = applyOffline(s0, 3600_000, fixedRng());
    expect(s1.rigs[0]!.storage).toBeCloseTo(rigRate(1, 1) * 3600);
  });

  it('добыча упирается в кап склада', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1 }], { lastTickAt: 0 });
    const s1 = applyOffline(s0, 10 * 3600_000, fixedRng());
    expect(s1.rigs[0]!.storage).toBeCloseTo(storageCap(1));
  });

  it('оффлайн дольше OFFLINE_CAP_MS не даёт больше, чем OFFLINE_CAP_MS', () => {
    // T12 не успевает заполнить склад за 12 часов -> разница между 12ч и 48ч видна
    const s0 = stateWithRigs([{ cell: 0, tier: 12 }], { lastTickAt: 0 });
    const s12h = applyOffline(s0, C.OFFLINE_CAP_MS, fixedRng());
    const s48h = applyOffline(s0, 4 * C.OFFLINE_CAP_MS, fixedRng());
    expect(s48h.rigs[0]!.storage).toBeCloseTo(s12h.rigs[0]!.storage);
  });

  it('за оффлайн появляется не больше MAX_OFFLINE_SPILLS пятен (порядок — по индексу ячейки)', () => {
    const cap = storageCap(1);
    const s0 = stateWithRigs(
      [
        { cell: 2, tier: 1, storage: cap, fullSince: 0 },
        { cell: 7, tier: 1, storage: cap, fullSince: 0 },
        { cell: 9, tier: 1, storage: cap, fullSince: 0 },
      ],
      { lastTickAt: 0 },
    );
    const s1 = applyOffline(s0, 2 * C.SPILL_GRACE_MS, fixedRng());
    expect(s1.spills).toHaveLength(C.MAX_OFFLINE_SPILLS);
    expect(s1.spills.map((sp) => sp.cell)).toEqual([2, 7]);
  });

  it('танкер возвращается оффлайн, выручка зачислена', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1, storage: 200 }], { lastTickAt: 0 });
    const tid = s0.tankers[0]!.id;
    const s1 = dispatchTanker(loadTanker(s0, tid, 0), tid, 0);
    const s2 = applyOffline(s1, 3600_000, fixedRng());
    expect(s2.coins).toBeCloseTo(s0.coins + 200 * C.OIL_PRICE);
    expect(s2.tankers[0]!.status).toBe('docked');
  });

  it('вертолёт прилетает оффлайн', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1 }], { lastTickAt: 0, nextHeliAt: 3600_000 });
    const s1 = applyOffline(s0, 4 * 3600_000, fixedRng());
    expect(s1.workerPool).toBeGreaterThanOrEqual(C.HELI_WORKERS_PER_TRIP);
  });
});
