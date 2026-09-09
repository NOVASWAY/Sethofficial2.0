"use client"

import { Moon, Sun, Stethoscope, Check } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "clinic", label: "Clinic", icon: Stethoscope },
] as const

export function ThemeToggleSimple() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="sm" className="w-9 h-9 min-h-[36px] min-w-[36px] p-0" aria-label="Theme">
        <Sun className="h-4 w-4" />
      </Button>
    )
  }

  const active = THEMES.find((t) => t.value === theme)
    || THEMES.find((t) => t.value === resolvedTheme)
    || THEMES[0]
  const ActiveIcon = active.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-9 h-9 min-h-[36px] min-w-[36px] p-0"
          aria-label={`Theme: ${active.label}. Change theme`}
          title={`Theme: ${active.label}`}
        >
          <ActiveIcon className="h-4 w-4 transition-transform duration-200" />
          <span className="sr-only">Change theme (current: {active.label})</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {THEMES.map((t) => {
          const Icon = t.icon
          const selected = theme === t.value
          return (
            <DropdownMenuItem
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={cn("gap-2", selected && "font-semibold")}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {selected && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
