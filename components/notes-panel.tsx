'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  MessageSquare, Plus, Edit, Trash2, Star, AlertTriangle, 
  Lock, Tag, Clock, User, CheckCircle2, XCircle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { notesAPI } from '@/lib/api-client'
import { formatDistanceToNow } from 'date-fns'

interface Note {
  id: string
  resource_type: string
  resource_id: string
  user_id: string
  user_name: string
  user_role: string
  content: string
  is_important: boolean
  is_urgent: boolean
  is_private: boolean
  tags?: string[]
  metadata?: any
  created_at: string
  updated_at: string
  deleted_at?: string
  created_by?: string
}

interface NotesPanelProps {
  resourceType: string // 'patient', 'consultation', 'prescription', etc.
  resourceId: string // UUID of the resource
  title?: string
  showAddButton?: boolean
}

export function NotesPanel({ 
  resourceType, 
  resourceId, 
  title = "Notes",
  showAddButton = true 
}: NotesPanelProps) {
  const { toast } = useToast()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  
  const [newNote, setNewNote] = useState({
    content: '',
    is_important: false,
    is_urgent: false,
    is_private: false,
    tags: [] as string[],
  })
  
  const [editNote, setEditNote] = useState({
    content: '',
    is_important: false,
    is_urgent: false,
    is_private: false,
    tags: [] as string[],
  })

  const [tagInput, setTagInput] = useState('')

  // Load notes
  useEffect(() => {
    loadNotes()
  }, [resourceType, resourceId])

  const loadNotes = async () => {
    try {
      setLoading(true)
      const notesData = await notesAPI.getNotes(resourceType, resourceId)
      setNotes(notesData || [])
    } catch (error: any) {
      console.error('Failed to load notes:', error)
      toast({
        variant: 'error',
        title: 'Failed to Load Notes',
        description: error?.message || 'Unable to load notes. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddNote = async () => {
    if (!newNote.content.trim()) {
      toast({
        variant: 'error',
        title: 'Note Required',
        description: 'Please enter note content',
      })
      return
    }

    try {
      const response = await notesAPI.create({
        resource_type: resourceType,
        resource_id: resourceId,
        content: newNote.content,
        is_important: newNote.is_important,
        is_urgent: newNote.is_urgent,
        is_private: newNote.is_private,
        tags: newNote.tags.length > 0 ? newNote.tags : undefined,
      })

      if (response.success) {
        toast({
          title: 'Note Added',
          description: 'Note has been added successfully',
        })
        setNewNote({
          content: '',
          is_important: false,
          is_urgent: false,
          is_private: false,
          tags: [],
        })
        setShowAddForm(false)
        loadNotes()
      } else {
        throw new Error(response.error || 'Failed to add note')
      }
    } catch (error: any) {
      console.error('Failed to add note:', error)
      toast({
        variant: 'error',
        title: 'Failed to Add Note',
        description: error?.message || 'Unable to add note. Please try again.',
      })
    }
  }

  const handleUpdateNote = async (noteId: string) => {
    if (!editNote.content.trim()) {
      toast({
        variant: 'error',
        title: 'Note Required',
        description: 'Please enter note content',
      })
      return
    }

    try {
      const response = await notesAPI.update(noteId, {
        content: editNote.content,
        is_important: editNote.is_important,
        is_urgent: editNote.is_urgent,
        is_private: editNote.is_private,
        tags: editNote.tags.length > 0 ? editNote.tags : undefined,
      })

      if (response.success) {
        toast({
          title: 'Note Updated',
          description: 'Note has been updated successfully',
        })
        setEditingNoteId(null)
        loadNotes()
      } else {
        throw new Error(response.error || 'Failed to update note')
      }
    } catch (error: any) {
      console.error('Failed to update note:', error)
      toast({
        variant: 'error',
        title: 'Failed to Update Note',
        description: error?.message || 'Unable to update note. Please try again.',
      })
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return
    }

    try {
      const response = await notesAPI.delete(noteId)
      if (response.success) {
        toast({
          title: 'Note Deleted',
          description: 'Note has been deleted successfully',
        })
        loadNotes()
      } else {
        throw new Error(response.error || 'Failed to delete note')
      }
    } catch (error: any) {
      console.error('Failed to delete note:', error)
      toast({
        variant: 'error',
        title: 'Failed to Delete Note',
        description: error?.message || 'Unable to delete note. Please try again.',
      })
    }
  }

  const startEdit = (note: Note) => {
    setEditingNoteId(note.id)
    setEditNote({
      content: note.content,
      is_important: note.is_important,
      is_urgent: note.is_urgent,
      is_private: note.is_private,
      tags: note.tags || [],
    })
  }

  const cancelEdit = () => {
    setEditingNoteId(null)
    setEditNote({
      content: '',
      is_important: false,
      is_urgent: false,
      is_private: false,
      tags: [],
    })
  }

  const addTag = (tagList: string[], newTag: string) => {
    const trimmedTag = newTag.trim()
    if (trimmedTag && !tagList.includes(trimmedTag)) {
      return [...tagList, trimmedTag]
    }
    return tagList
  }

  const removeTag = (tagList: string[], tagToRemove: string) => {
    return tagList.filter(tag => tag !== tagToRemove)
  }

  // Sort notes: urgent first, then important, then by date
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.is_urgent && !b.is_urgent) return -1
    if (!a.is_urgent && b.is_urgent) return 1
    if (a.is_important && !b.is_important) return -1
    if (!a.is_important && b.is_important) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>
              Collaborative notes for this {resourceType}
            </CardDescription>
          </div>
          {showAddButton && !showAddForm && (
            <Button
              size="sm"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Note Form */}
        {showAddForm && (
          <Card className="border-primary">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Note Content *</Label>
                <Textarea
                  placeholder="Enter your note here..."
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newNote.is_important}
                    onChange={(e) => setNewNote({ ...newNote, is_important: e.target.checked })}
                    className="rounded"
                  />
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">Important</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newNote.is_urgent}
                    onChange={(e) => setNewNote({ ...newNote, is_urgent: e.target.checked })}
                    className="rounded"
                  />
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Urgent</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newNote.is_private}
                    onChange={(e) => setNewNote({ ...newNote, is_private: e.target.checked })}
                    className="rounded"
                  />
                  <Lock className="h-4 w-4" />
                  <span className="text-sm">Private</span>
                </label>
              </div>

              <div className="space-y-2">
                <Label>Tags (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        setNewNote({ ...newNote, tags: addTag(newNote.tags, tagInput) })
                        setTagInput('')
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setNewNote({ ...newNote, tags: addTag(newNote.tags, tagInput) })
                      setTagInput('')
                    }}
                  >
                    <Tag className="h-4 w-4" />
                  </Button>
                </div>
                {newNote.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newNote.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <button
                          onClick={() => setNewNote({ ...newNote, tags: removeTag(newNote.tags, tag) })}
                          className="ml-1 hover:text-destructive"
                        >
                          <XCircle className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddNote}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save Note
                </Button>
                <Button variant="outline" onClick={() => {
                  setShowAddForm(false)
                  setNewNote({
                    content: '',
                    is_important: false,
                    is_urgent: false,
                    is_private: false,
                    tags: [],
                  })
                }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes List */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading notes...</div>
        ) : sortedNotes.length === 0 ? (
          <Alert>
            <MessageSquare className="h-4 w-4" />
            <AlertDescription>
              No notes yet. {showAddButton && 'Click "Add Note" to add the first note.'}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {sortedNotes.map((note) => (
              <Card 
                key={note.id} 
                className={note.is_urgent ? "border-red-500 border-2" : note.is_important ? "border-yellow-500" : ""}
              >
                <CardContent className="pt-6">
                  {editingNoteId === note.id ? (
                    // Edit Form
                    <div className="space-y-4">
                      <Textarea
                        value={editNote.content}
                        onChange={(e) => setEditNote({ ...editNote, content: e.target.value })}
                        rows={4}
                      />
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editNote.is_important}
                            onChange={(e) => setEditNote({ ...editNote, is_important: e.target.checked })}
                            className="rounded"
                          />
                          <Star className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm">Important</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editNote.is_urgent}
                            onChange={(e) => setEditNote({ ...editNote, is_urgent: e.target.checked })}
                            className="rounded"
                          />
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          <span className="text-sm">Urgent</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editNote.is_private}
                            onChange={(e) => setEditNote({ ...editNote, is_private: e.target.checked })}
                            className="rounded"
                          />
                          <Lock className="h-4 w-4" />
                          <span className="text-sm">Private</span>
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleUpdateNote(note.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Note Display
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{note.user_name}</span>
                            <Badge variant="outline" className="text-xs">
                              {note.user_role}
                            </Badge>
                            {note.is_private && (
                              <Badge variant="secondary" className="text-xs">
                                <Lock className="h-3 w-3 mr-1" />
                                Private
                              </Badge>
                            )}
                            {note.is_urgent && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Urgent
                              </Badge>
                            )}
                            {note.is_important && (
                              <Badge variant="default" className="text-xs bg-yellow-500">
                                <Star className="h-3 w-3 mr-1" />
                                Important
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                          {note.tags && note.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {note.tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  <Tag className="h-3 w-3 mr-1" />
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</span>
                            {note.updated_at !== note.created_at && (
                              <span>(edited)</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(note)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteNote(note.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

