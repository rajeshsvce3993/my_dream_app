import { createContext, useContext, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client';

type Locale = 'en' | 'ta';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  tName: (value?: { en: string; ta?: string }) => string;
  supportedLanguages: Locale[];
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(
    (localStorage.getItem('locale') as Locale) || 'en',
  );

  const publicConfig = useQuery({
    queryKey: ['public-config'],
    queryFn: () => apiRequest<Record<string, unknown>>('/configuration/public'),
  });

  const supportedLanguages = useMemo(() => {
    const langs = publicConfig.data?.['supported.languages'];
    if (Array.isArray(langs) && langs.every((l) => l === 'en' || l === 'ta')) {
      return langs as Locale[];
    }
    return ['en', 'ta'] as Locale[];
  }, [publicConfig.data]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: (next) => {
        setLocale(next);
        localStorage.setItem('locale', next);
      },
      tName: (value) => {
        if (!value) return '';
        if (locale === 'ta' && value.ta) return value.ta;
        return value.en;
      },
      supportedLanguages,
    }),
    [locale, supportedLanguages],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('LocaleProvider required');
  return ctx;
}
