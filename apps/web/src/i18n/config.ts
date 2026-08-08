export type Language = 'en' | 'am' | 'om' | 'ti';

export const languages: Record<Language, string> = {
  en: 'English',
  am: 'አማርኛ',
  om: 'Afaan Oromo',
  ti: 'ትግርኛ',
};

export const defaultLanguage: Language = 'en';
