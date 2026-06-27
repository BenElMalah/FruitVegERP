import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <button
      className="btn btn-sm btn-outline-light ms-2"
      onClick={() => i18n.changeLanguage(isAr ? 'en' : 'ar')}
      title={isAr ? 'English' : 'العربية'}
    >
      {isAr ? 'EN' : 'AR'}
    </button>
  );
}
