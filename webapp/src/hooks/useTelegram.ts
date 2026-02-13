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

  const setHeaderColor = (color: string) => {
    if (isTelegram && WebApp.setHeaderColor) {
      WebApp.setHeaderColor(color as `#${string}`);
    }
  };

  const setBackgroundColor = (color: string) => {
    if (isTelegram && WebApp.setBackgroundColor) {
      WebApp.setBackgroundColor(color as `#${string}`);
    }
  };

  const showBackButton = (callback: () => void) => {
    if (isTelegram && WebApp.BackButton) {
      WebApp.BackButton.show();
      WebApp.BackButton.onClick(callback);
      return () => {
        WebApp.BackButton.offClick(callback);
        WebApp.BackButton.hide();
      };
    }
    return () => {};
  };

  const hapticFeedback = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (isTelegram && WebApp.HapticFeedback) {
      WebApp.HapticFeedback.impactOccurred(type);
    }
  };

  const hapticNotification = (type: 'error' | 'success' | 'warning' = 'success') => {
    if (isTelegram && WebApp.HapticFeedback) {
      WebApp.HapticFeedback.notificationOccurred(type);
    }
  };

  return {
    isTelegram,
    initData,
    colorScheme,
    user,
    ready,
    expand,
    setHeaderColor,
    setBackgroundColor,
    showBackButton,
    hapticFeedback,
    hapticNotification,
  };
}
