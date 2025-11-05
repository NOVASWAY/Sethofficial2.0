/**
 * Image utility functions for optimization
 */

/**
 * Check if WebP is supported
 */
export function isWebPSupported(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
}

/**
 * Convert image to WebP format (client-side)
 * Note: This is a simple utility - for production, use a backend service
 */
export function convertToWebP(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }
        ctx.drawImage(img, 0, 0)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Failed to convert to WebP'))
            }
          },
          'image/webp',
          0.8 // Quality: 0-1
        )
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Compress image file
 */
export function compressImage(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height

        // Calculate new dimensions
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = width * ratio
          height = height * ratio
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Failed to compress image'))
            }
          },
          file.type || 'image/jpeg',
          quality
        )
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Generate responsive image srcSet
 */
export function generateSrcSet(baseUrl: string, sizes: number[] = [320, 640, 768, 1024, 1280, 1920]): string {
  return sizes
    .map(size => `${baseUrl}?w=${size} ${size}w`)
    .join(', ')
}

/**
 * Generate image sizes attribute for responsive images
 */
export function generateSizes(breakpoints: { [key: string]: string }): string {
  return Object.entries(breakpoints)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([width, size]) => `(max-width: ${width}px) ${size}`)
    .join(', ')
}

/**
 * Get optimal image format based on browser support
 */
export function getOptimalImageFormat(originalSrc: string, preferWebP: boolean = true): string {
  if (!preferWebP || !isWebPSupported()) {
    return originalSrc
  }

  const extension = originalSrc.split('.').pop()?.toLowerCase()
  if (extension && ['jpg', 'jpeg', 'png'].includes(extension)) {
    return originalSrc.replace(`.${extension}`, '.webp')
  }

  return originalSrc
}

/**
 * Create a blur placeholder from an image
 */
export function createBlurPlaceholder(file: File, size: number = 10): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }
        ctx.drawImage(img, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', 0.1))
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

