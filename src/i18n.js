import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zh from './locales/zh.json'

function detectLang() {
  const savedLocale = localStorage.getItem('locale')
  if (savedLocale === 'en' || savedLocale === 'zh') {
    return savedLocale
  }

  const lang = chrome.i18n.getUILanguage()
  console.log(`Detected browser language: ${lang}`)
  return lang.startsWith('zh') ? 'zh' : 'en'
}

const i18n = createI18n({
  legacy: false, 
  locale: detectLang(),
  fallbackLocale: 'en',
  messages: {
    en,
    zh
  }
})

export default i18n
