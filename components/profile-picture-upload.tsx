'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Camera, Upload, X, User } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ProfilePictureUploadProps {
  currentAvatar?: string
  userName: string
  onAvatarChange: (avatarDataUrl: string | null) => void
  className?: string
}

export function ProfilePictureUpload({ 
  currentAvatar, 
  userName, 
  onAvatarChange, 
  className = '' 
}: ProfilePictureUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentAvatar || null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please select an image file (PNG, JPG, JPEG, GIF)",
        variant: "error",
      })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB",
        variant: "error",
      })
      return
    }

    setIsUploading(true)

    // Convert to base64 for localStorage storage
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setPreview(dataUrl)
      onAvatarChange(dataUrl)
      setIsUploading(false)
      
      toast({
        title: "Profile Picture Updated",
        description: "Your profile picture has been saved successfully.",
      })
    }
    reader.onerror = () => {
      toast({
        title: "Upload Failed",
        description: "Failed to process the image. Please try again.",
        variant: "error",
      })
      setIsUploading(false)
    }
    reader.readAsDataURL(file)
  }

  const handleRemove = () => {
    setPreview(null)
    onAvatarChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    
    toast({
      title: "Profile Picture Removed",
      description: "Your profile picture has been removed.",
    })
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex flex-col items-center space-y-4">
          {/* Avatar Display */}
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={preview || undefined} alt={userName} />
              <AvatarFallback className="text-lg font-semibold">
                {preview ? <User className="h-8 w-8" /> : getInitials(userName)}
              </AvatarFallback>
            </Avatar>
            
            {/* Upload Overlay */}
            {!preview && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 hover:opacity-100 transition-opacity">
                <Camera className="h-6 w-6 text-white" />
              </div>
            )}
          </div>

          {/* User Name */}
          <div className="text-center">
            <p className="font-medium">{userName}</p>
            <p className="text-sm text-muted-foreground">Profile Picture</p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUploadClick}
              disabled={isUploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
            
            {preview && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemove}
                disabled={isUploading}
              >
                <X className="h-4 w-4 mr-2" />
                Remove
              </Button>
            )}
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Help Text */}
          <div className="text-center text-xs text-muted-foreground max-w-xs">
            <p>Upload a profile picture (PNG, JPG, JPEG, GIF)</p>
            <p>Maximum file size: 5MB</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Utility functions for localStorage management
export const PROFILE_PICTURES_STORAGE_KEY = 'clinic_profile_pictures'

export const saveProfilePicture = (userId: string, avatarDataUrl: string) => {
  try {
    const existingPictures = getProfilePictures()
    existingPictures[userId] = avatarDataUrl
    localStorage.setItem(PROFILE_PICTURES_STORAGE_KEY, JSON.stringify(existingPictures))
  } catch (error) {
    console.error('Error saving profile picture:', error)
  }
}

export const getProfilePicture = (userId: string): string | null => {
  try {
    const pictures = getProfilePictures()
    return pictures[userId] || null
  } catch (error) {
    console.error('Error getting profile picture:', error)
    return null
  }
}

export const removeProfilePicture = (userId: string) => {
  try {
    const existingPictures = getProfilePictures()
    delete existingPictures[userId]
    localStorage.setItem(PROFILE_PICTURES_STORAGE_KEY, JSON.stringify(existingPictures))
  } catch (error) {
    console.error('Error removing profile picture:', error)
  }
}

const getProfilePictures = (): Record<string, string> => {
  try {
    const stored = localStorage.getItem(PROFILE_PICTURES_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    console.error('Error parsing profile pictures:', error)
    return {}
  }
}
