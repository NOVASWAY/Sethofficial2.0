'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { appointmentAPI } from '@/lib/api-client'
import { dashboardCache, getCacheKey, withCache } from '@/lib/dashboard-cache'
import { useDebounce } from '@/hooks/use-debounce'
import { ListSkeleton } from "@/components/ui/loading"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calendar, Clock, User, Phone, FileText, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAppointments, type Appointment } from '@/contexts/appointment-context'

export function AppointmentBooking() {
  const { toast } = useToast()
  const { appointments: contextAppointments, addAppointment, updateAppointment, cancelAppointment } = useAppointments()
  
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const [isCancelOpen, setIsCancelOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [loading, setLoading] = useState(true)
  
  // Debounce selected date changes to reduce API calls when navigating dates
  const debouncedSelectedDate = useDebounce(selectedDate, 300)
  
  // Memoized cache key for appointments
  const appointmentsCacheKey = useMemo(
    () => getCacheKey('appointments', { date: debouncedSelectedDate }),
    [debouncedSelectedDate]
  )
  
  // Memoized transform function
  const transformAppointment = useCallback((apt: any): Appointment => ({
    id: apt.id || `APT-${apt.id?.slice(0, 8)}`,
    patientId: apt.patient_id || apt.patientId || '',
    patientName: apt.patient_name || `${apt.patient_first_name || ''} ${apt.patient_last_name || ''}`.trim() || 'Unknown Patient',
    patientPhone: apt.patient_phone || apt.patientPhone || '',
    appointmentDate: apt.date || apt.appointment_date || new Date().toISOString().split('T')[0],
    appointmentTime: apt.time || apt.appointment_time || '',
    appointmentType: (apt.type || apt.appointment_type || 'consultation') as Appointment['appointmentType'],
    clinicianId: apt.doctor_id || apt.clinician_id || apt.clinicianId || '',
    clinicianName: apt.doctor_name || apt.clinician_name || apt.clinicianName || 'Unknown Doctor',
    status: (apt.status === 'scheduled' ? 'scheduled' as const :
             apt.status === 'checked-in' ? 'checked-in' as const :
             apt.status === 'in-progress' ? 'in-progress' as const :
             apt.status === 'completed' ? 'completed' as const :
             apt.status === 'cancelled' ? 'cancelled' as const :
             apt.status === 'no-show' ? 'no-show' as const : 'scheduled' as const),
    notes: apt.notes || apt.notes || '',
    cancelledReason: apt.cancelled_reason || apt.cancelReason || undefined,
    createdAt: apt.created_at || new Date().toISOString(),
  }), [])

  // Fetch appointments from API with caching and lazy loading by date
  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        setLoading(true)
        
        // Use cached API call if available
        const cacheKey = appointmentsCacheKey
        const result = await withCache(
          cacheKey,
          () => {
            // If date is selected, fetch appointments for that date
            if (debouncedSelectedDate) {
              return appointmentAPI.getByDate(debouncedSelectedDate)
            }
            // Otherwise fetch all with pagination
            return appointmentAPI.getAll({ page: 1, per_page: 200 })
          },
          5 * 60 * 1000 // Cache for 5 minutes
        )
        
        if (result && Array.isArray(result.data)) {
          // Transform API response to match Appointment interface
          const transformed = result.data.map(transformAppointment)
          setAppointments(transformed)
        } else if (result && Array.isArray(result)) {
          // Handle case where API returns array directly
          const transformed = result.map(transformAppointment)
          setAppointments(transformed)
        } else {
          // Fallback to context appointments if API returns unexpected format
          setAppointments(contextAppointments)
        }
      } catch (error) {
        console.error("Error fetching appointments:", error)
        toast({
          title: "Warning",
          description: "Failed to load appointments from API. Using context data.",
          variant: "default"
        })
        // Fallback to context appointments on error
        setAppointments(contextAppointments)
      } finally {
        setLoading(false)
      }
    }

    fetchAppointments()
  }, [debouncedSelectedDate, appointmentsCacheKey, transformAppointment, contextAppointments, toast])
  
  const [bookingData, setBookingData] = useState({
    patientId: '',
    patientName: '',
    patientPhone: '',
    appointmentDate: new Date().toISOString().split('T')[0],
    appointmentTime: '',
    appointmentType: 'consultation' as const,
    clinicianId: '',
    clinicianName: '',
    notes: '',
  })

  const handleBookAppointment = async () => {
    if (!bookingData.patientName || !bookingData.patientPhone || !bookingData.appointmentDate || 
        !bookingData.appointmentTime || !bookingData.clinicianName) {
      toast({
        variant: 'error',
        title: 'Validation Error',
        description: 'Please fill in all required fields',
      })
      return
    }

    try {
      // Create appointment via API
      const appointmentData = {
        patient_id: bookingData.patientId || null,
        doctor_id: bookingData.clinicianId || null,
        date: bookingData.appointmentDate,
        time: bookingData.appointmentTime,
        type: bookingData.appointmentType || 'consultation',
        notes: bookingData.notes || null,
        status: 'scheduled',
      }

      const apiResponse = await appointmentAPI.create(appointmentData)
      
      // Invalidate appointment cache after creating new appointment
      dashboardCache.invalidatePattern('dashboard:appointments:.*')

      // Also add to context for immediate UI update
      const newAppointment: Appointment = {
        id: apiResponse?.id || `APT-${Date.now()}`,
        patientId: bookingData.patientId || `PAT-${Date.now()}`,
        patientName: bookingData.patientName,
        patientPhone: bookingData.patientPhone,
        appointmentDate: bookingData.appointmentDate,
        appointmentTime: bookingData.appointmentTime,
        appointmentType: bookingData.appointmentType,
        clinicianId: bookingData.clinicianId || `DOC-${Date.now()}`,
        clinicianName: bookingData.clinicianName,
        status: 'scheduled',
        notes: bookingData.notes,
        createdAt: new Date().toISOString(),
      }

      addAppointment(newAppointment)
      setAppointments([...appointments, newAppointment])

      toast({
        title: 'Appointment Booked',
        description: `Appointment scheduled for ${bookingData.patientName} on ${bookingData.appointmentDate} at ${bookingData.appointmentTime}`,
      })

      setIsBookingOpen(false)
      setBookingData({
        patientId: '',
        patientName: '',
        patientPhone: '',
        appointmentDate: new Date().toISOString().split('T')[0],
        appointmentTime: '',
        appointmentType: 'consultation',
        clinicianId: '',
        clinicianName: '',
        notes: '',
      })
    } catch (error) {
      console.error("Error creating appointment:", error)
      toast({
        variant: 'error',
        title: 'Booking Failed',
        description: 'Failed to book appointment. Please try again.',
      })
    }
  }

  const handleCancelAppointment = async () => {
    if (!selectedAppointment) return

    try {
      // Cancel appointment via API
      await appointmentAPI.update(selectedAppointment.id, {
        status: 'cancelled',
        notes: cancelReason ? `${selectedAppointment.notes || ''}\nCancellation reason: ${cancelReason}`.trim() : selectedAppointment.notes,
      })
      
      // Invalidate appointment cache after cancelling
      dashboardCache.invalidatePattern('dashboard:appointments:.*')

      // Also update context
      cancelAppointment(selectedAppointment.id, cancelReason)

      // Update local state
      setAppointments(appointments.map(apt => 
        apt.id === selectedAppointment.id 
          ? { ...apt, status: 'cancelled' as const, cancelledReason: cancelReason }
          : apt
      ))
      
      toast({
        title: 'Appointment Cancelled',
        description: `Appointment for ${selectedAppointment.patientName} has been cancelled`,
      })

      setIsCancelOpen(false)
      setSelectedAppointment(null)
      setCancelReason('')
    } catch (error) {
      console.error("Error cancelling appointment:", error)
      toast({
        variant: 'error',
        title: 'Cancellation Failed',
        description: 'Failed to cancel appointment. Please try again.',
      })
    }
  }

  const getStatusBadge = (status: Appointment['status']) => {
    const styles = {
      scheduled: 'bg-blue-100 text-blue-800',
      'checked-in': 'bg-green-100 text-green-800',
      'in-progress': 'bg-purple-100 text-purple-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      'no-show': 'bg-orange-100 text-orange-800',
    }
    return <Badge className={styles[status]}>{status}</Badge>
  }

  // Memoize filtered appointments for performance
  const todayAppointments = useMemo(
    () => appointments.filter(apt => apt.appointmentDate === selectedDate),
    [appointments, selectedDate]
  )
  
  const upcomingAppointments = useMemo(
    () => appointments.filter(apt => 
      new Date(apt.appointmentDate) > new Date(selectedDate) && apt.status === 'scheduled'
    ),
    [appointments, selectedDate]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Appointment Management</h2>
          <p className="text-muted-foreground">
            Book and manage patient appointments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={async () => {
              try {
                setLoading(true)
                // Invalidate cache before refreshing
                dashboardCache.invalidatePattern('dashboard:appointments:.*')
                
                const result = await appointmentAPI.getAll({ page: 1, per_page: 200 })
                if (result && Array.isArray(result.data)) {
                  const transformed = result.data.map(transformAppointment)
                  setAppointments(transformed)
                  toast({
                    title: "Refreshed",
                    description: "Appointment data has been refreshed.",
                  })
                }
              } catch (error) {
                toast({
                  title: "Error",
                  description: "Failed to refresh appointments.",
                  variant: "destructive"
                })
              } finally {
                setLoading(false)
              }
            }}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="lg" onClick={() => setIsBookingOpen(true)}>
            <Calendar className="mr-2 h-4 w-4" />
            Book Appointment
          </Button>
        </div>
      </div>

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="today">
            Today ({todayAppointments.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming ({upcomingAppointments.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All ({appointments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <ListSkeleton items={5} />
                </div>
              ) : todayAppointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No appointments scheduled for today</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayAppointments.map(apt => (
                    <div key={apt.id} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{apt.appointmentTime}</span>
                          {getStatusBadge(apt.status)}
                        </div>
                        <div className="space-y-1 ml-7">
                          <p className="font-medium flex items-center gap-2">
                            <User className="h-3 w-3" />
                            {apt.patientName}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            {apt.patientPhone}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Type:</span> {apt.appointmentType}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Clinician:</span> {apt.clinicianName}
                          </p>
                          {apt.notes && (
                            <p className="text-sm text-muted-foreground flex items-start gap-2">
                              <FileText className="h-3 w-3 mt-0.5" />
                              {apt.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {apt.status === 'scheduled' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedAppointment(apt)
                              setIsCancelOpen(true)
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingAppointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No upcoming appointments</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingAppointments.map(apt => (
                    <div key={apt.id} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">
                            {new Date(apt.appointmentDate).toLocaleDateString()} at {apt.appointmentTime}
                          </span>
                          {getStatusBadge(apt.status)}
                        </div>
                        <div className="space-y-1 ml-7">
                          <p className="font-medium">{apt.patientName}</p>
                          <p className="text-sm text-muted-foreground">{apt.patientPhone}</p>
                          <p className="text-sm text-muted-foreground">
                            {apt.appointmentType} with {apt.clinicianName}
                          </p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setSelectedAppointment(apt)
                          setIsCancelOpen(true)
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {appointments.map(apt => (
                  <div key={apt.id} className="flex items-start justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold">
                          {new Date(apt.appointmentDate).toLocaleDateString()} at {apt.appointmentTime}
                        </span>
                        {getStatusBadge(apt.status)}
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium">{apt.patientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {apt.appointmentType} with {apt.clinicianName}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Book Appointment Dialog */}
      <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Book New Appointment</DialogTitle>
            <DialogDescription>Schedule an appointment for a patient</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="patientName">Patient Name *</Label>
                <Input
                  id="patientName"
                  value={bookingData.patientName}
                  onChange={(e) => setBookingData({ ...bookingData, patientName: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patientPhone">Phone Number *</Label>
                <Input
                  id="patientPhone"
                  value={bookingData.patientPhone}
                  onChange={(e) => setBookingData({ ...bookingData, patientPhone: e.target.value })}
                  placeholder="+254712345678"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="appointmentDate">Date *</Label>
                <Input
                  id="appointmentDate"
                  type="date"
                  value={bookingData.appointmentDate}
                  onChange={(e) => setBookingData({ ...bookingData, appointmentDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appointmentTime">Time *</Label>
                <Input
                  id="appointmentTime"
                  type="time"
                  value={bookingData.appointmentTime}
                  onChange={(e) => setBookingData({ ...bookingData, appointmentTime: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="appointmentType">Appointment Type *</Label>
                <Select
                  value={bookingData.appointmentType}
                  onValueChange={(value: any) => setBookingData({ ...bookingData, appointmentType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultation">Consultation</SelectItem>
                    <SelectItem value="follow-up">Follow-up</SelectItem>
                    <SelectItem value="procedure">Procedure</SelectItem>
                    <SelectItem value="lab-test">Lab Test</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinicianName">Clinician *</Label>
                <Input
                  id="clinicianName"
                  value={bookingData.clinicianName}
                  onChange={(e) => setBookingData({ ...bookingData, clinicianName: e.target.value })}
                  placeholder="Dr. Sarah Johnson"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={bookingData.notes}
                onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
                placeholder="Additional notes or reason for visit..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsBookingOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBookAppointment}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Book Appointment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Appointment Dialog */}
      <Dialog open={isCancelOpen} onOpenChange={setIsCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this appointment?
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p><strong>Patient:</strong> {selectedAppointment.patientName}</p>
                <p><strong>Date:</strong> {new Date(selectedAppointment.appointmentDate).toLocaleDateString()}</p>
                <p><strong>Time:</strong> {selectedAppointment.appointmentTime}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cancelReason">Reason for Cancellation (Optional)</Label>
                <Textarea
                  id="cancelReason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter reason..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsCancelOpen(false)}>
                  Keep Appointment
                </Button>
                <Button variant="destructive" onClick={handleCancelAppointment}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Appointment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

