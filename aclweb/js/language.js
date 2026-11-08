window.languageState = {
  current: 'en'
};

window.englishText = (value, fallback = '') => {
  const cleaned = String(value || '')
    .replace(/[\u0900-\u097F]+/g, '')
    .replace(/\s*\/\s*\/\s*/g, ' / ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || fallback;
};

const originalTextNodes = new WeakMap();

function setLanguage(lang) {
  const nextLang = ['en', 'np'].includes(lang) ? lang : 'np';
  window.languageState.current = nextLang;
  localStorage.setItem('acl_agro_language', nextLang);
  document.documentElement.lang = nextLang;

  const t = window.translations?.[nextLang] || window.translations?.np;
  if (!t) return;

  const nepaliUi = window.translations?.np?.ui || {};
  const englishUi = Object.fromEntries(Object.entries(nepaliUi).map(([english, nepali]) => [nepali, english]));
  const uiDictionary = nextLang === 'np' ? nepaliUi : englishUi;

  const textWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let textNode;
  while ((textNode = textWalker.nextNode())) {
    if (!originalTextNodes.has(textNode)) {
      originalTextNodes.set(textNode, textNode.nodeValue);
    }
    const originalText = originalTextNodes.get(textNode);
    const trimmedText = originalText.trim();
    const translatedText = uiDictionary[trimmedText];
    if (translatedText) {
      textNode.nodeValue = originalText.replace(trimmedText, translatedText);
    } else if (nextLang === 'en') {
      textNode.nodeValue = originalText;
    }
  }

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    const value = key.split('.').reduce((obj, part) => obj?.[part], t);
    if (value) {
      element.textContent = value;
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    const value = key.split('.').reduce((obj, part) => obj?.[part], t);
    if (value) {
      element.setAttribute('placeholder', value);
    }
  });

  const languageButtons = document.querySelectorAll('[data-language-switch]');
  languageButtons.forEach((button) => {
    const buttonLang = button.dataset.languageSwitch;
    button.classList.toggle('active', buttonLang === nextLang);
    button.setAttribute('aria-pressed', String(buttonLang === nextLang));
    button.textContent = buttonLang === 'np' ? 'नेपाली' : 'English';
  });
}

function initLanguageSystem(initialLang = 'np') {
  const selectedLang = 'en';
  setLanguage(selectedLang);

  document.querySelectorAll('[data-language-switch]').forEach((button) => {
    if (button.dataset.languageBound === 'true') return;
    button.dataset.languageBound = 'true';
    button.addEventListener('click', () => setLanguage(button.dataset.languageSwitch));
  });
}

window.initLanguageSystem = initLanguageSystem;
window.setLanguage = setLanguage;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initLanguageSystem(window.languageState.current));
} else {
  initLanguageSystem(window.languageState.current);
}
