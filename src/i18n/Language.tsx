import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ptBR } from './ptBR.ts';

type Language = 'en' | 'pt-BR';
const LanguageContext = createContext<{ language: Language; setLanguage(language: Language): void }>({ language: 'en', setLanguage: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try { return localStorage.getItem('chordbench-language') === 'pt-BR' ? 'pt-BR' : 'en'; } catch { return 'en'; }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem('chordbench-language', language); } catch { /* Language still works for this session. */ }
  }, [language]);
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useT() {
  const { language } = useContext(LanguageContext);
  return (text: string) => language === 'pt-BR' ? ptBR[text] ?? text : text;
}

export function T({ text }: { text: string }) { return <>{useT()(text)}</>; }

export function LanguageToggle() {
  const { language, setLanguage } = useContext(LanguageContext);
  return <select className="language-toggle" aria-label="Language / Idioma" value={language} onChange={event => setLanguage(event.target.value as Language)}>
    <option value="en">EN</option><option value="pt-BR">PT-BR</option>
  </select>;
}
