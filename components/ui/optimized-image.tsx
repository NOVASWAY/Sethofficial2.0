"use client"

import React, { useState, useEffect, useRef, ImgHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { ImageIcon, Loader2 } from 'lucide-react'

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> {
  src: string
  alt: string
  width?: number
  height?: number
  fallback?: string
  loading?: 'lazy' | 'eager'
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  className?: string
  onError?: () => void
  priority?: boolean
}

/**
 * Optimized Image component with lazy loading, WebP support, and error handling
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fallback,
  loading = 'lazy',
  placeholder = 'empty',
  blurDataURL,
  className,
  onError,
  priority = false,
  ...props
}: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = useState<string>(src)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const imgRef = useRef<HTMLImageElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || loading === 'eager' || isInView) {
      return
    }

    if (!imgRef.current) {
      return
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observerRef.current?.disconnect()
          }
        })
      },
      {
        rootMargin: '50px', // Start loading 50px before image enters viewport
      }
    )

    observerRef.current.observe(imgRef.current)

    return () => {
      observerRef.current?.disconnect()
    }
  }, [priority, loading, isInView])

  // Handle image load
  const handleLoad = () => {
    setIsLoading(false)
  }

  // Handle image error
  const handleError = () => {
    setIsLoading(false)
    setHasError(true)
    
    if (fallback && imgSrc !== fallback) {
      setImgSrc(fallback)
      setHasError(false)
      return
    }

    onError?.()
  }

  // Generate WebP srcSet if possible
  const getWebPSrc = (originalSrc: string): string => {
    // If the image is already from a CDN or has query params, don't modify
    if (originalSrc.includes('?') || originalSrc.includes('http')) {
      return originalSrc
    }

    // Try to use WebP version
    const extension = originalSrc.split('.').pop()?.toLowerCase()
    if (extension && ['jpg', 'jpeg', 'png'].includes(extension)) {
      return originalSrc.replace(`.${extension}`, '.webp')
    }

    return originalSrc
  }

  // Generate responsive srcSet
  const getSrcSet = (baseSrc: string): string => {
    const sizes = [320, 640, 768, 1024, 1280, 1920]
    return sizes
      .filter(size => width ? size <= width : true)
      .map(size => {
        const webpSrc = getWebPSrc(baseSrc)
        return `${webpSrc}?w=${size} ${size}w`
      })
      .join(', ')
  }

  const shouldLoad = priority || loading === 'eager' || isInView

  // Show placeholder while loading
  if (!shouldLoad) {
    return (
      <div
        ref={imgRef}
        className={cn(
          "bg-muted animate-pulse flex items-center justify-center",
          className
        )}
        style={{ width, height }}
        aria-label={alt}
      >
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
      </div>
    )
  }

  // Show error state
  if (hasError && !fallback) {
    return (
      <div
        className={cn(
          "bg-muted flex items-center justify-center",
          className
        )}
        style={{ width, height }}
        aria-label={alt}
      >
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
      </div>
    )
  }

  // Show loading state
  if (isLoading && placeholder === 'blur' && blurDataURL) {
    return (
      <div className={cn("relative", className)} style={{ width, height }}>
        <img
          src={blurDataURL}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover blur-sm"
          aria-hidden="true"
        />
        <img
          ref={imgRef}
          src={imgSrc}
          alt={alt}
          srcSet={getSrcSet(imgSrc)}
          width={width}
          height={height}
          loading={priority ? 'eager' : loading}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "transition-opacity duration-300",
            isLoading ? "opacity-0" : "opacity-100",
            className
          )}
          {...props}
        />
      </div>
    )
  }

  return (
    <div className={cn("relative", className)} style={{ width, height }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        ref={imgRef}
        src={imgSrc}
        alt={alt}
        srcSet={shouldLoad ? getSrcSet(imgSrc) : undefined}
        width={width}
        height={height}
        loading={priority ? 'eager' : loading}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          className
        )}
        {...props}
      />
    </div>
  )
}

/**
 * Simple lazy-loaded image wrapper
 */
export function LazyImage({
  src,
  alt,
  className,
  ...props
}: {
  src: string
  alt: string
  className?: string
} & React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      {...props}
    />
  )
}

