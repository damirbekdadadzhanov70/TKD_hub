import WebApp from '@twa-dev/sdk';

export function useTelegram() {
  const isTelegram = !!WebApp.initData;

  const initData = WebApp.initData || '';
  const colorScheme = WebApp.colorScheme || 'light';
  const user = WebApp.initDataUnsafe?.user;

  const ready = () => {
    if (isTelegram) {
      WebApp.ready();
    }
  };

  const expand = () => {
    if (isTelegram) {
      WebApp.expand();
    }
  };

  const hapticFeedback = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (isTelegram && WebApp.HapticFeedback) {
      WebApp.HapticFeedback.impactOccurred(type);
    }
  };

  return {
    isTelegram,
    initData,
    colorScheme,
    user,
    ready,
    expand,
    hapticFeedback,
  };
}
