"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// Fade in animation
interface FadeInProps {
  children: React.ReactNode
  delay?: number
  duration?: number
  className?: string
}

export function FadeIn({ children, delay = 0, duration = 500, className }: FadeInProps) {
  const [isVisible, setIsVisible] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay])

  return (
    <div
      className={cn(
        "transition-opacity duration-500 ease-out",
        isVisible ? "opacity-100" : "opacity-0",
        className
      )}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  )
}

// Slide in animation
interface SlideInProps {
  children: React.ReactNode
  direction?: "up" | "down" | "left" | "right"
  delay?: number
  duration?: number
  className?: string
}

export function SlideIn({ 
  children, 
  direction = "up", 
  delay = 0, 
  duration = 500, 
  className 
}: SlideInProps) {
  const [isVisible, setIsVisible] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay])

  const getTransform = () => {
    switch (direction) {
      case "up":
        return isVisible ? "translateY(0)" : "translateY(20px)"
      case "down":
        return isVisible ? "translateY(0)" : "translateY(-20px)"
      case "left":
        return isVisible ? "translateX(0)" : "translateX(20px)"
      case "right":
        return isVisible ? "translateX(0)" : "translateX(-20px)"
      default:
        return isVisible ? "translateY(0)" : "translateY(20px)"
    }
  }

  return (
    <div
      className={cn(
        "transition-all duration-500 ease-out",
        isVisible ? "opacity-100" : "opacity-0",
        className
      )}
      style={{ 
        transform: getTransform(),
        transitionDuration: `${duration}ms` 
      }}
    >
      {children}
    </div>
  )
}

// Stagger animation for lists
interface StaggerProps {
  children: React.ReactNode
  delay?: number
  staggerDelay?: number
  className?: string
}

export function Stagger({ children, delay = 0, staggerDelay = 100, className }: StaggerProps) {
  const childrenArray = React.Children.toArray(children)
  
  return (
    <div className={className}>
      {childrenArray.map((child, index) => (
        <FadeIn
          key={index}
          delay={delay + (index * staggerDelay)}
          className="w-full"
        >
          {child}
        </FadeIn>
      ))}
    </div>
  )
}

// Scale animation
interface ScaleProps {
  children: React.ReactNode
  delay?: number
  duration?: number
  className?: string
}

export function Scale({ children, delay = 0, duration = 300, className }: ScaleProps) {
  const [isVisible, setIsVisible] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay])

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-out",
        isVisible 
          ? "opacity-100 scale-100" 
          : "opacity-0 scale-95",
        className
      )}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  )
}

// Pulse animation
interface PulseProps {
  children: React.ReactNode
  className?: string
}

export function Pulse({ children, className }: PulseProps) {
  return (
    <div className={cn("animate-pulse", className)}>
      {children}
    </div>
  )
}

// Bounce animation
interface BounceProps {
  children: React.ReactNode
  className?: string
}

export function Bounce({ children, className }: BounceProps) {
  return (
    <div className={cn("animate-bounce", className)}>
      {children}
    </div>
  )
}

// Shake animation
interface ShakeProps {
  children: React.ReactNode
  className?: string
}

export function Shake({ children, className }: ShakeProps) {
  return (
    <div className={cn("animate-shake", className)}>
      {children}
    </div>
  )
}

// Loading spinner with animation
interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8"
  }

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-muted border-t-primary",
        sizeClasses[size],
        className
      )}
    />
  )
}

// Progress bar with animation
interface ProgressBarProps {
  value: number
  max?: number
  className?: string
  showPercentage?: boolean
}

export function ProgressBar({ 
  value, 
  max = 100, 
  className, 
  showPercentage = true 
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100)

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Progress</span>
        {showPercentage && (
          <span className="text-sm text-muted-foreground">
            {Math.round(percentage)}%
          </span>
        )}
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

// Hover animations
interface HoverProps {
  children: React.ReactNode
  className?: string
  hoverClassName?: string
}

export function Hover({ children, className, hoverClassName }: HoverProps) {
  return (
    <div
      className={cn(
        "transition-all duration-200 ease-in-out hover:scale-105",
        hoverClassName,
        className
      )}
    >
      {children}
    </div>
  )
}

// Page transition wrapper
interface PageTransitionProps {
  children: React.ReactNode
  className?: string
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <FadeIn
      delay={100}
      duration={300}
      className={cn("w-full", className)}
    >
      <SlideIn direction="up" delay={200} duration={400}>
        {children}
      </SlideIn>
    </FadeIn>
  )
}

// Card hover effect
interface CardHoverProps {
  children: React.ReactNode
  className?: string
}

export function CardHover({ children, className }: CardHoverProps) {
  return (
    <div
      className={cn(
        "transition-all duration-200 ease-in-out",
        "hover:shadow-lg hover:shadow-primary/10",
        "hover:-translate-y-1",
        className
      )}
    >
      {children}
    </div>
  )
}

// Button press animation
interface ButtonPressProps {
  children: React.ReactNode
  className?: string
}

export function ButtonPress({ children, className }: ButtonPressProps) {
  return (
    <div
      className={cn(
        "transition-all duration-150 ease-in-out",
        "active:scale-95 active:shadow-inner",
        className
      )}
    >
      {children}
    </div>
  )
}
