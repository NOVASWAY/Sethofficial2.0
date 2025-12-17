'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Users, UserPlus, ArrowRight, Clock, AlertCircle,
  CheckCircle2, XCircle, Phone, FileText, Edit, X
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAppointments, type QueueItem } from '@/contexts/appointment-context'
import { Textarea } from '@/components/ui/textarea'

export function QueueManagement() {
  const { toast } = useToast()
  const { queue, addToQueue, callNextPatient, updateQueueStatus, updateQueueNotes, removeFromQueue, appointments } = useAppointments()
  
  const [isCheckInOpen, setIsCheckInOpen] = useState(false)
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [notesEditValue, setNotesEditValue] = useState('')
  const [checkInData, setCheckInData] = useState({
    patientName: '',
    patientNumber: '',
    patientPhone: '',
    priority: 'normal' as 'normal' | 'urgent' | 'emergency',
    visitType: 'walk-in' as 'appointment' | 'walk-in',
    appointmentId: '',
    notes: '',
  })

  const handleCheckIn = () => {
    if (!checkInData.patientName || !checkInData.patientNumber) {
      toast({
        variant: 'error',
        title: 'Validation Error',
        description: 'Patient name and OP number are required',
      })
      return
    }

    addToQueue({
      patientId: checkInData.patientNumber,
      patientName: checkInData.patientName,
      patientNumber: checkInData.patientNumber,
      priority: checkInData.priority,
      visitType: checkInData.visitType,
      appointmentId: checkInData.appointmentId || undefined,
      notes: checkInData.notes,
    })

    toast({
      title: 'Patient Checked In',
      description: `${checkInData.patientName} added to queue`,
    })

    setIsCheckInOpen(false)
    setCheckInData({
      patientName: '',
      patientNumber: '',
      patientPhone: '',
      priority: 'normal',
      visitType: 'walk-in',
      appointmentId: '',
      notes: '',
    })
  }

  const handleCallNext = () => {
    const nextPatient = callNextPatient('current-clinician')
    
    if (nextPatient) {
      toast({
        title: 'Patient Called',
        description: `${nextPatient.patientName} (Queue #${nextPatient.queueNumber}) has been called`,
      })
    } else {
      toast({
        title: 'No Patients Waiting',
        description: 'The queue is empty',
        variant: 'info',
      })
    }
  }

  const handleStartConsultation = (queueId: string) => {
    updateQueueStatus(queueId, 'in-consultation')
    const patient = queue.find(q => q.id === queueId)
    
    toast({
      title: 'Consultation Started',
      description: `Started consultation with ${patient?.patientName}`,
    })
  }

  const handleCompleteConsultation = (queueId: string) => {
    const patient = queue.find(q => q.id === queueId)
    updateQueueStatus(queueId, 'completed')
    
    // Remove from queue after a short delay
    setTimeout(() => removeFromQueue(queueId), 2000)
    
    toast({
      title: 'Consultation Completed',
      description: `Completed consultation with ${patient?.patientName}`,
    })
  }

  const handleEditNotes = (queueId: string) => {
    const queueItem = queue.find(q => q.id === queueId)
    setNotesEditValue(queueItem?.notes || '')
    setEditingNotesId(queueId)
  }

  const handleSaveNotes = (queueId: string) => {
    // Update queue item with new notes
    updateQueueNotes(queueId, notesEditValue)
    
    toast({
      title: 'Notes Updated',
      description: 'Queue notes have been updated',
    })
    
    setEditingNotesId(null)
    setNotesEditValue('')
  }

  const handleCancelEditNotes = () => {
    setEditingNotesId(null)
    setNotesEditValue('')
  }

  const getPriorityBadge = (priority: QueueItem['priority']) => {
    const styles = {
      emergency: 'bg-red-100 text-red-800 border-red-300',
      urgent: 'bg-orange-100 text-orange-800 border-orange-300',
      normal: 'bg-blue-100 text-blue-800 border-blue-300',
    }
    return <Badge className={styles[priority]}>{priority.toUpperCase()}</Badge>
  }

  const getStatusBadge = (status: QueueItem['status']) => {
    const styles = {
      waiting: 'bg-yellow-100 text-yellow-800',
      called: 'bg-green-100 text-green-800',
      'in-consultation': 'bg-purple-100 text-purple-800',
      completed: 'bg-gray-100 text-gray-800',
    }
    const icons = {
      waiting: Clock,
      called: ArrowRight,
      'in-consultation': Users,
      completed: CheckCircle2,
    }
    const Icon = icons[status]
    return (
      <Badge className={styles[status]}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    )
  }

  const waitingQueue = queue.filter(q => q.status === 'waiting')
  const calledQueue = queue.filter(q => q.status === 'called')
  const inConsultationQueue = queue.filter(q => q.status === 'in-consultation')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Patient Queue</h2>
          <p className="text-muted-foreground">
            Manage patient check-ins and consultation queue
          </p>
        </div>
        <div className="flex gap-3">
          <Button size="lg" variant="outline" onClick={handleCallNext}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Call Next Patient
          </Button>
          <Button size="lg" onClick={() => setIsCheckInOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Check In Patient
          </Button>
        </div>
      </div>

      {/* Queue Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total in Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{queue.filter(q => q.status !== 'completed').length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Waiting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{waitingQueue.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">In Consultation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{inConsultationQueue.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {queue.filter(q => q.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue List */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Waiting Queue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              Waiting Queue ({waitingQueue.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {waitingQueue.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No patients waiting</p>
              </div>
            ) : (
              <div className="space-y-3">
                {waitingQueue.map(patient => (
                  <div key={patient.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="text-2xl font-bold text-muted-foreground">
                          #{patient.queueNumber}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{patient.patientName}</p>
                          <p className="text-sm text-muted-foreground">{patient.patientNumber}</p>
                        </div>
                      </div>
                      {getPriorityBadge(patient.priority)}
                    </div>
                    
                    {/* Notes Section */}
                    {editingNotesId === patient.id ? (
                      <div className="mt-3 space-y-2">
                        <Label htmlFor={`notes-${patient.id}`} className="text-xs font-medium">
                          Queue Notes
                        </Label>
                        <Textarea
                          id={`notes-${patient.id}`}
                          value={notesEditValue}
                          onChange={(e) => setNotesEditValue(e.target.value)}
                          placeholder="Add detailed notes about this patient..."
                          className="min-h-20 text-sm"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={handleCancelEditNotes}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => handleSaveNotes(patient.id)}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3">
                        {patient.notes ? (
                          <div className="bg-muted/50 rounded-md p-2 text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-1 mb-1">
                                  <FileText className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs font-medium text-muted-foreground">Notes:</span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap">{patient.notes}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => handleEditNotes(patient.id)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => handleEditNotes(patient.id)}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Add Notes
                          </Button>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mt-3 pt-2 border-t">
                      <div className="text-xs text-muted-foreground">
                        {patient.visitType === 'appointment' ? 'Appointment' : 'Walk-in'} • 
                        Checked in: {new Date(patient.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* In Consultation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              In Consultation ({inConsultationQueue.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {inConsultationQueue.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No active consultations</p>
              </div>
            ) : (
              <div className="space-y-3">
                {inConsultationQueue.map(patient => (
                  <div key={patient.id} className="p-4 border rounded-lg bg-purple-50">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="text-2xl font-bold text-purple-600">
                          #{patient.queueNumber}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{patient.patientName}</p>
                          <p className="text-sm text-muted-foreground">{patient.patientNumber}</p>
                        </div>
                      </div>
                      {getStatusBadge(patient.status)}
                    </div>
                    
                    {/* Notes Section */}
                    {editingNotesId === patient.id ? (
                      <div className="mt-3 space-y-2">
                        <Label htmlFor={`notes-${patient.id}`} className="text-xs font-medium">
                          Queue Notes
                        </Label>
                        <Textarea
                          id={`notes-${patient.id}`}
                          value={notesEditValue}
                          onChange={(e) => setNotesEditValue(e.target.value)}
                          placeholder="Add detailed notes about this patient..."
                          className="min-h-20 text-sm"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={handleCancelEditNotes}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => handleSaveNotes(patient.id)}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3">
                        {patient.notes ? (
                          <div className="bg-white/80 rounded-md p-2 text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-1 mb-1">
                                  <FileText className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs font-medium text-muted-foreground">Notes:</span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap">{patient.notes}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => handleEditNotes(patient.id)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => handleEditNotes(patient.id)}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Add Notes
                          </Button>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-purple-200">
                      <div className="text-xs text-muted-foreground">
                        {patient.clinicianAssigned || 'Unassigned'}
                      </div>
                      <Button size="sm" onClick={() => handleCompleteConsultation(patient.id)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Complete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Called/Next */}
      {calledQueue.length > 0 && (
        <Card className="border-green-300 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-900">
              <ArrowRight className="h-5 w-5" />
              Next Patient
            </CardTitle>
          </CardHeader>
          <CardContent>
            {calledQueue.map(patient => (
              <div key={patient.id} className="p-4 border border-green-300 rounded-lg bg-white">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-3xl font-bold text-green-600">
                      #{patient.queueNumber}
                    </div>
                    <div className="flex-1">
                      <p className="text-lg font-semibold">{patient.patientName}</p>
                      <p className="text-sm text-muted-foreground">{patient.patientNumber}</p>
                    </div>
                  </div>
                  {getPriorityBadge(patient.priority)}
                </div>
                
                {/* Notes Section */}
                {editingNotesId === patient.id ? (
                  <div className="mt-3 space-y-2">
                    <Label htmlFor={`notes-${patient.id}`} className="text-xs font-medium">
                      Queue Notes
                    </Label>
                    <Textarea
                      id={`notes-${patient.id}`}
                      value={notesEditValue}
                      onChange={(e) => setNotesEditValue(e.target.value)}
                      placeholder="Add detailed notes about this patient..."
                      className="min-h-20 text-sm"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleCancelEditNotes}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => handleSaveNotes(patient.id)}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    {patient.notes ? (
                      <div className="bg-green-50 rounded-md p-2 text-sm border border-green-200">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-1 mb-1">
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs font-medium text-muted-foreground">Notes:</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{patient.notes}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => handleEditNotes(patient.id)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => handleEditNotes(patient.id)}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Add Notes
                      </Button>
                    )}
                  </div>
                )}
                
                <div className="flex justify-end mt-3">
                  <Button onClick={() => handleStartConsultation(patient.id)}>
                    <Users className="h-4 w-4 mr-2" />
                    Start Consultation
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Check In Dialog */}
      <Dialog open={isCheckInOpen} onOpenChange={setIsCheckInOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check In Patient</DialogTitle>
            <DialogDescription>Add a patient to the consultation queue</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="patientName">Patient Name *</Label>
              <Input
                id="patientName"
                value={checkInData.patientName}
                onChange={(e) => setCheckInData({ ...checkInData, patientName: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patientNumber">OP Number *</Label>
              <Input
                id="patientNumber"
                value={checkInData.patientNumber}
                onChange={(e) => setCheckInData({ ...checkInData, patientNumber: e.target.value })}
                placeholder="OP-2025-0001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="visitType">Visit Type</Label>
              <Select
                value={checkInData.visitType}
                onValueChange={(value: any) => setCheckInData({ ...checkInData, visitType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">Walk-in</SelectItem>
                  <SelectItem value="appointment">Appointment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={checkInData.priority}
                onValueChange={(value: any) => setCheckInData({ ...checkInData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Queue Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={checkInData.notes}
                onChange={(e) => setCheckInData({ ...checkInData, notes: e.target.value })}
                placeholder="Add detailed notes about this patient visit, symptoms, special instructions, etc..."
                className="min-h-24"
              />
              <p className="text-xs text-muted-foreground">
                These notes will be visible to all staff members handling this patient
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsCheckInOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCheckIn}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Check In
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

