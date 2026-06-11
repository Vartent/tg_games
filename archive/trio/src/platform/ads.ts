/**
 * Рекламный адаптер. Боевой провайдер — Adsgram (блок-id через VITE_ADSGRAM_BLOCK_ID);
 * без него — dev-стаб, который «показывает» рекламу мгновенно.
 * Правила показов — SPEC §6: interstitial не чаще 1 раза в 2 раунда бесконечного режима,
 * никогда после дейли (это считает вызывающая сторона, адаптер только показывает).
 */

interface AdsgramController {
  show(): Promise<{ done: boolean }>;
}

declare global {
  interface Window {
    Adsgram?: { init(opts: { blockId: string }): AdsgramController };
  }
}

const BLOCK_ID: string | undefined = import.meta.env.VITE_ADSGRAM_BLOCK_ID;

let rewardedController: AdsgramController | null = null;

function getController(): AdsgramController | null {
  if (rewardedController) return rewardedController;
  if (window.Adsgram && BLOCK_ID) {
    rewardedController = window.Adsgram.init({ blockId: BLOCK_ID });
  }
  return rewardedController;
}

/** Показ rewarded. true — награда заслужена (досмотрел). */
export async function showRewarded(): Promise<boolean> {
  const controller = getController();
  if (!controller) return true; // dev-стаб
  try {
    const result = await controller.show();
    return result.done;
  } catch {
    return false;
  }
}

/** Interstitial между раундами. Ошибки показа глотаются — игра важнее рекламы. */
export async function showInterstitial(): Promise<void> {
  const controller = getController();
  if (!controller) return; // dev-стаб
  try {
    await controller.show();
  } catch {
    /* пропуск показа не должен ломать переход между раундами */
  }
}
