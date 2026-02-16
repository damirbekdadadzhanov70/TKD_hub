import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import ru from './ru';
import en from './en';

type Lang = 'ru' | 'en';

const dictionaries: Record<Lang, Record<string, unknown>> = { ru, en };

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  tArray: (key: string) => readonly string[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveRaw(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function resolve(obj: unknown, path: string): string {
  const val = resolveRaw(obj, path);
  return typeof val === 'string' ? val : path;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem('app_language');
    return stored === 'en' ? 'en' : 'ru';
  });

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem('app_language', newLang);
  }, []);

  const t = useCallback(
    (key: string) => resolve(dictionaries[lang], key),
    [lang],
  );

  const tArray = useCallback(
    (key: string): readonly string[] => {
      const val = resolveRaw(dictionaries[lang], key);
      return Array.isArray(val) ? val : [];
    },
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t, tArray }}>
      {children}
    </I18nContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
