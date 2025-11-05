import { useState, useEffect } from 'react'

interface UseImageLoaderOptions {
  src: string
  fallback?: string
  onLoad?: () => void
  onError?: () => void
}

/**
 * Hook for preloading and managing image loading state
 */
export function useImageLoader({ src, fallback, onLoad, onError }: UseImageLoaderOptions) {
  const [imageSrc, setImageSrc] = useState<string>(src)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsLoading(true)
    setHasError(false)
    setIsLoaded(false)
    setImageSrc(src)

    const img = new Image()
    
    img.onload = () => {
      setIsLoading(false)
      setIsLoaded(true)
      onLoad?.()
    }

    img.onerror = () => {
      setIsLoading(false)
      setHasError(true)

      if (fallback && imageSrc !== fallback) {
        setImageSrc(fallback)
        setHasError(false)
        setIsLoading(true)
        return
      }

      onError?.()
    }

    img.src = imageSrc

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [src, fallback, imageSrc, onLoad, onError])

  return {
    imageSrc,
    isLoading,
    hasError,
    isLoaded,
  }
}

/**
 * Hook for preloading multiple images
 */
export function useImagePreloader(imageUrls: string[]) {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (imageUrls.length === 0) {
      setIsLoading(false)
      return
    }

    const loaded = new Set<string>()
    const failed = new Set<string>()

    const loadImage = (url: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          loaded.add(url)
          resolve()
        }
        img.onerror = () => {
          failed.add(url)
          reject()
        }
        img.src = url
      })
    }

    Promise.allSettled(imageUrls.map(loadImage)).then(() => {
      setLoadedImages(loaded)
      setFailedImages(failed)
      setIsLoading(false)
    })
  }, [imageUrls])

  return {
    loadedImages: Array.from(loadedImages),
    failedImages: Array.from(failedImages),
    isLoading,
    isComplete: loadedImages.size + failedImages.size === imageUrls.length,
  }
}

