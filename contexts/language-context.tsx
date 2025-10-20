'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type Language = 'en' | 'sw'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const LANGUAGE_STORAGE_KEY = 'clinic_language'

// Translation data - in a real app, this would be loaded dynamically
const translations: Record<Language, Record<string, any>> = {
  en: {},
  sw: {}
}

// Load translations from JSON files
const loadTranslations = async (lang: Language) => {
  try {
    const response = await fetch(`/messages/${lang}.json`)
    const data = await response.json()
    translations[lang] = data
  } catch (error) {
    console.error(`Failed to load translations for ${lang}:`, error)
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')
  const [isLoaded, setIsLoaded] = useState(false)

  // Load translations on mount
  useEffect(() => {
    const loadAllTranslations = async () => {
      await Promise.all([
        loadTranslations('en'),
        loadTranslations('sw')
      ])
      setIsLoaded(true)
    }
    loadAllTranslations()
  }, [])

  // Load saved language preference
  useEffect(() => {
    try {
      const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language
      if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'sw')) {
        setLanguageState(savedLanguage)
      }
    } catch (error) {
      console.error('Error loading language preference:', error)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
    } catch (error) {
      console.error('Error saving language preference:', error)
    }
  }

  // Translation function
  const t = (key: string): string => {
    if (!isLoaded) return key

    const keys = key.split('.')
    let value: any = translations[language]

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        // Fallback to English if translation not found
        value = translations.en
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey]
          } else {
            return key // Return key if no translation found
          }
        }
        break
      }
    }

    return typeof value === 'string' ? value : key
  }

  const value: LanguageContextType = {
    language,
    setLanguage,
    t,
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

// Hook for easy translation
export function useTranslation() {
  const { t } = useLanguage()
  return { t }
}
