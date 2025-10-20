'use client'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Globe, Check } from 'lucide-react'
import { useLanguage } from '@/contexts/language-context'

interface LanguageSwitcherProps {
  variant?: 'button' | 'select'
  className?: string
}

export function LanguageSwitcher({ variant = 'select', className = '' }: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useLanguage()

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'sw', name: 'Kiswahili', flag: '🇰🇪' },
  ]

  if (variant === 'button') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Globe className="h-4 w-4" />
        <div className="flex space-x-1">
          {languages.map((lang) => (
            <Button
              key={lang.code}
              variant={language === lang.code ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLanguage(lang.code as 'en' | 'sw')}
              className="flex items-center space-x-1"
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
              {language === lang.code && <Check className="h-3 w-3" />}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Globe className="h-4 w-4" />
      <Select value={language} onValueChange={(value) => setLanguage(value as 'en' | 'sw')}>
        <SelectTrigger className="w-32">
          <SelectValue>
            <div className="flex items-center space-x-2">
              <span>{languages.find(l => l.code === language)?.flag}</span>
              <span>{languages.find(l => l.code === language)?.name}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              <div className="flex items-center space-x-2">
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
                {language === lang.code && <Check className="h-3 w-3 ml-auto" />}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
