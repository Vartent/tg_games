/** Тонкая обёртка над Telegram WebApp SDK. Вне Telegram всё деградирует в no-op/localStorage. */

interface TgCloudStorage {
  getItem(key: string, cb: (err: unknown, value: string | null) => void): void;
  setItem(key: string, value: string, cb?: (err: unknown, ok: boolean) => void): void;
}

interface SafeAreaInset {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface TgWebApp {
  ready(): void;
  expand(): void;
  isVersionAtLeast?(version: string): boolean;
  platform?: string;
  initDataUnsafe?: { user?: { id: number; first_name?: string } };
  CloudStorage?: TgCloudStorage;
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  };
  openTelegramLink(url: string): void;
  colorScheme?: 'light' | 'dark';
  /** Bot API 7.7+: запрет сворачивания мини-аппа свайпом вниз. */
  disableVerticalSwipes?(): void;
  /** Bot API 8.0+: полноэкранный режим. */
  requestFullscreen?(): void;
  isFullscreen?: boolean;
  /** Bot API 8.0+: залочить ориентацию мини-аппа (фиксирует текущую — портрет). */
  lockOrientation?(): void;
  safeAreaInset?: SafeAreaInset;
  contentSafeAreaInset?: SafeAreaInset;
  onEvent?(event: string, cb: () => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

export const tg: TgWebApp | undefined = window.Telegram?.WebApp;

/** Фича доступна с версии Bot API (вне Telegram SDK прикидывается v6.0). */
export function supports(version: string): boolean {
  return tg?.isVersionAtLeast?.(version) ?? false;
}

const isMobile = () => tg?.platform === 'android' || tg?.platform === 'ios';

/** Прокинуть отступы безопасной зоны Telegram в CSS-переменные. */
function syncSafeArea(): void {
  const top = (tg?.safeAreaInset?.top ?? 0) + (tg?.contentSafeAreaInset?.top ?? 0);
  const bottom = tg?.safeAreaInset?.bottom ?? 0;
  document.documentElement.style.setProperty('--safe-top', `${top}px`);
  document.documentElement.style.setProperty('--safe-bottom', `${bottom}px`);
}

export function initTelegram(): void {
  if (!tg) return;
  tg.ready();
  tg.expand();
  // свайп вниз по доске не должен сворачивать мини-апп
  if (supports('7.7')) tg.disableVerticalSwipes?.();
  // на мобильных — полный экран и фиксированный портрет
  if (supports('8.0') && isMobile()) {
    tg.requestFullscreen?.();
    tg.lockOrientation?.();
  }
  syncSafeArea();
  tg.onEvent?.('safeAreaChanged', syncSafeArea);
  tg.onEvent?.('contentSafeAreaChanged', syncSafeArea);
  tg.onEvent?.('fullscreenChanged', syncSafeArea);
}

export function haptic(kind: 'tap' | 'success' | 'error'): void {
  const h = tg?.HapticFeedback;
  if (!h || !supports('6.1')) return;
  if (kind === 'tap') h.impactOccurred('light');
  else h.notificationOccurred(kind);
}

/** Шер результата в чаты Telegram (вне Telegram — Web Share API / клипборд). */
export function share(text: string, url: string): void {
  if (tg) {
    tg.openTelegramLink(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    );
    return;
  }
  if (navigator.share) {
    void navigator.share({ text, url });
    return;
  }
  void navigator.clipboard?.writeText(`${text} ${url}`);
}
