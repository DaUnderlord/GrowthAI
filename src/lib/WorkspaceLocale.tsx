import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { languageFromPref, t, type AppLanguage } from './i18n';
import { timezoneFromPref } from './liveApi';

type LocaleCtx = {
  language: AppLanguage;
  timeZone: string;
  t: (key: string) => string;
};

const Ctx = createContext<LocaleCtx>({
  language: 'en',
  timeZone: 'Africa/Lagos',
  t: (key) => t('en', key),
});

export function WorkspaceLocaleProvider({
  languagePref,
  timeZonePref,
  children,
}: {
  languagePref?: string;
  timeZonePref?: string;
  children: React.ReactNode;
}) {
  const language = languageFromPref(languagePref);
  const timeZone = timezoneFromPref(timeZonePref);
  const value = useMemo(
    () => ({ language, timeZone, t: (key: string) => t(language, key) }),
    [language, timeZone]
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspaceLocale() {
  return useContext(Ctx);
}
