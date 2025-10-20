'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { UserPlus, Search, FileText, Calendar, Phone, Mail, MapPin, Heart, AlertCircle, CheckCircle2, Eye, Edit, Users, Activity } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { PatientImport } from './patient-import'
import { usePatientEnhanced, type Patient } from '@/contexts/patient-context-enhanced'
import { DateRangeFilter, type DateRange, isDateInRange } from '@/components/date-range-filter'

// Mock patients are now loaded from context - no longer needed here
// Context will load from localStorage or start empty

export function RegistrationModule() {
  const { toast } = useToast()
  const { patients, addPatient, updatePatient, searchPatients, getTotalPatients, getActivePatients } = usePatientEnhanced()
  const [activeTab, setActiveTab] = useState('records')
  const [loading, setLoading] = useState(false)
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([])
  const [searchResults, setSearchResults] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined })
  
  // Sync context patients to local state with filtering
  useEffect(() => {
    const patientsArray = Array.isArray(patients) ? patients : []
    let filtered = patientsArray

    // Apply search filter
    if (searchFilter) {
      filtered = filtered.filter(patient => 
        patient.first_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        patient.last_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        patient.phone.includes(searchFilter) ||
        patient.patient_number.toLowerCase().includes(searchFilter.toLowerCase())
      )
    }

    // Apply date range filter
    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter(patient => 
        isDateInRange(patient.created_at, dateRange)
      )
    }

    setFilteredPatients(filtered)
  }, [patients, searchFilter, dateRange])
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    phone: '',
    address: '',
    emergency_contact: '',
    emergency_phone: '',
  })

  const [searchTerm, setSearchTerm] = useState('')

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const generatePatientNumber = () => {
    const date = new Date()
    const year = date.getFullYear()
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `PAT-${year}-${random}`
  }

  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validate required fields
      if (!formData.first_name || !formData.last_name || !formData.date_of_birth || 
          !formData.gender || !formData.phone || !formData.address || 
          !formData.emergency_contact || !formData.emergency_phone) {
        toast({
          variant: 'error',
          title: 'Validation Error',
          description: 'Please fill in all required fields',
        })
        setLoading(false)
        return
      }

      // 🎯 ACTUALLY SAVE TO CONTEXT - NOW WORKS!
      const patientData = {
        ...formData,
        patient_number: generatePatientNumber(),
        status: 'active' as const,
      }

      const newPatient = await addPatient(patientData)

      // TODO: Also send to backend API when available
      // await fetch('/api/patients', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(newPatient),
      // })

      toast({
        title: 'Patient Registered Successfully',
        description: `Patient Number: ${newPatient.patient_number}. Patient is now searchable and saved.`,
      })

      // Reset form
      setFormData({
        first_name: '',
        last_name: '',
        date_of_birth: '',
        gender: '',
        phone: '',
        address: '',
        emergency_contact: '',
        emergency_phone: '',
      })

      setActiveTab('search')
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Registration Failed',
        description: 'Unable to register patient. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSearchPatient = async () => {
    if (!searchTerm.trim()) {
      toast({
        variant: 'error',
        title: 'Search Error',
        description: 'Please enter a search term',
      })
      return
    }

    setLoading(true)
    try {
      // 🎯 USE CONTEXT SEARCH - NOW SEARCHES ALL PATIENTS INCLUDING IMPORTED!
      const results = await searchPatients(searchTerm)
      
      // TODO: Also search via backend API when available
      // const response = await fetch(`/api/patients/search?q=${searchTerm}`)
      // const data = await response.json()

      setSearchResults(results)
      
      if (results.length === 0) {
        toast({
          title: 'No Results',
          description: 'No patients found matching your search',
        })
      } else {
        toast({
          title: 'Search Complete',
          description: `Found ${results.length} patient(s)`,
        })
      }
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Search Failed',
        description: 'Unable to search patients. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleViewPatient = (patient: Patient) => {
    setSelectedPatient(patient)
    setIsViewDialogOpen(true)
  }

  const handleEditPatient = (patient: Patient) => {
    setSelectedPatient(patient)
    setFormData({
      first_name: patient.first_name,
      last_name: patient.last_name,
      date_of_birth: patient.date_of_birth,
      gender: patient.gender,
      phone: patient.phone,
        address: patient.address || '',
      emergency_contact: patient.emergency_contact || '',
      emergency_phone: patient.emergency_phone || '',
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdatePatient = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!selectedPatient) {
        throw new Error('No patient selected')
      }

      // 🎯 ACTUALLY UPDATE IN CONTEXT - NOW WORKS!
      await updatePatient(selectedPatient.id, formData)
      
      // TODO: Also send to backend API when available
      // await fetch(`/api/patients/${selectedPatient.id}`, { 
      //   method: 'PUT', 
      //   body: JSON.stringify(formData) 
      // })

      toast({
        title: 'Patient Updated Successfully',
        description: `${formData.first_name} ${formData.last_name}'s information has been updated and saved.`,
      })

      setIsEditDialogOpen(false)
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Update Failed',
        description: 'Unable to update patient. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (value: string) => {
    setSearchFilter(value)
    if (!value.trim()) {
      setFilteredPatients(Array.isArray(patients) ? patients : [])
      return
    }

    const patientsArray = Array.isArray(patients) ? patients : []
    const filtered = patientsArray.filter(patient =>
      patient.first_name.toLowerCase().includes(value.toLowerCase()) ||
      patient.last_name.toLowerCase().includes(value.toLowerCase()) ||
      patient.patient_number.toLowerCase().includes(value.toLowerCase()) ||
      patient.phone.includes(value) ||
      (patient.insurance_type && patient.insurance_type.toLowerCase().includes(value.toLowerCase()))
    )
    setFilteredPatients(filtered)
  }

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date()
    const birthDate = new Date(dateOfBirth)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Patient Management</h2>
          <p className="text-muted-foreground">
            Manage patient records, register new patients, and search existing records
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PatientImport />
          <Badge variant="outline" className="text-lg px-4 py-2">
            <Users className="h-4 w-4 mr-2" />
            {getTotalPatients()} Patients ({getActivePatients()} Active)
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="records" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Patient Records
          </TabsTrigger>
          <TabsTrigger value="register" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Register New Patient
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Advanced Search
          </TabsTrigger>
        </TabsList>

        {/* Patient Records Tab */}
        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Patients</CardTitle>
              <CardDescription>
                View and manage all registered patients
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filter Controls */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search by name, patient number, phone, or insurance..."
                      className="pl-10"
                      value={searchFilter}
                      onChange={(e) => handleFilterChange(e.target.value)}
                    />
                  </div>
                  <Badge variant="secondary" className="px-4 py-2">
                    {filteredPatients.length} results
                  </Badge>
                </div>
                
                {/* Date Range Filter */}
                <div className="flex items-center gap-4">
                  <DateRangeFilter
                    onDateRangeChange={setDateRange}
                    placeholder="Filter by registration date"
                    className="w-full sm:w-auto"
                  />
                  <div className="text-sm text-muted-foreground">
                    {dateRange.from || dateRange.to ? 
                      `Showing patients registered ${dateRange.from ? `from ${dateRange.from.toLocaleDateString()}` : ''} ${dateRange.to ? `to ${dateRange.to.toLocaleDateString()}` : ''}` : 
                      'Showing all patients'
                    }
                  </div>
                </div>
              </div>

              {/* Patients Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Age/Gender</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Insurance</TableHead>
                      <TableHead>Blood Type</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPatients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No patients found</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPatients.map((patient) => (
                        <TableRow key={patient.id}>
                          <TableCell className="font-mono text-sm">
                            {patient.patient_number}
                          </TableCell>
                          <TableCell className="font-medium">
                            {patient.first_name} {patient.last_name}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{calculateAge(patient.date_of_birth)} years</div>
                              <div className="text-muted-foreground capitalize">{patient.gender}</div>
                            </div>
                          </TableCell>
                          <TableCell>{patient.phone}</TableCell>
                          <TableCell>{patient.address}</TableCell>
                          <TableCell>
                            {patient.insurance_type ? (
                              <Badge variant="outline">{patient.insurance_type}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">None</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {patient.blood_type ? (
                              <Badge variant="secondary">{patient.blood_type}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewPatient(patient)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditPatient(patient)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="register" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>New Patient Registration</CardTitle>
              <CardDescription>
                Enter patient details to create a new record
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegisterPatient} className="space-y-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name *</Label>
                      <Input
                        id="first_name"
                        name="first_name"
                        value={formData.first_name}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name *</Label>
                      <Input
                        id="last_name"
                        name="last_name"
                        value={formData.last_name}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date_of_birth">Date of Birth *</Label>
                      <Input
                        id="date_of_birth"
                        name="date_of_birth"
                        type="date"
                        value={formData.date_of_birth}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender *</Label>
                      <Select 
                        value={formData.gender} 
                        onValueChange={(value) => handleSelectChange('gender', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="+254712345678"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Residential Location *</Label>
                      <Input
                        id="location"
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        placeholder="e.g., Nairobi, Kiambu, Mombasa"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Emergency Contact
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="emergency_contact">Contact Name *</Label>
                      <Input
                        id="emergency_contact"
                        name="emergency_contact"
                        value={formData.emergency_contact}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emergency_phone">Contact Phone *</Label>
                      <Input
                        id="emergency_phone"
                        name="emergency_phone"
                        type="tel"
                        value={formData.emergency_phone}
                        onChange={handleInputChange}
                        placeholder="+254712345678"
                        required
                      />
                    </div>
                  </div>
                </div>


                <div className="flex justify-end gap-4">
                  <Button type="button" variant="outline" onClick={() =>                   setFormData({
                    first_name: '',
                    last_name: '',
                    date_of_birth: '',
                    gender: '',
                    phone: '',
                    address: '',
                    emergency_contact: '',
                    emergency_phone: '',
                  })}>
                    Clear Form
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Registering...' : 'Register Patient'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Patients</CardTitle>
              <CardDescription>
                Search by patient number, name, phone, or insurance number
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter search term..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchPatient()}
                />
                <Button onClick={handleSearchPatient} disabled={loading}>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((patient) => (
                    <Card key={patient.id} className="cursor-pointer hover:bg-accent" onClick={() => handleViewPatient(patient)}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{patient.first_name} {patient.last_name}</h4>
                              <Badge variant="outline">{patient.patient_number}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1 mt-2">
                              <p className="flex items-center gap-2">
                                <Phone className="h-3 w-3" />
                                {patient.phone}
                              </p>
                              <p className="flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                DOB: {new Date(patient.date_of_birth).toLocaleDateString()}
                              </p>
                              {patient.insurance_type && (
                                <p className="flex items-center gap-2">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Insurance: {patient.insurance_type}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button size="sm" variant="outline">
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedPatient && (
            <Card>
              <CardHeader>
                <CardTitle>Patient Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Patient Number</Label>
                    <p className="font-medium">{selectedPatient.patient_number}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Full Name</Label>
                    <p className="font-medium">{selectedPatient.first_name} {selectedPatient.last_name}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Date of Birth</Label>
                    <p className="font-medium">{new Date(selectedPatient.date_of_birth).toLocaleDateString()}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Gender</Label>
                    <p className="font-medium capitalize">{selectedPatient.gender}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{selectedPatient.phone}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Location</Label>
                    <p className="font-medium">{selectedPatient.address}</p>
                  </div>
                  {selectedPatient.blood_type && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Blood Type</Label>
                      <p className="font-medium">{selectedPatient.blood_type}</p>
                    </div>
                  )}
                  {selectedPatient.insurance_type && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Insurance Provider</Label>
                        <p className="font-medium">{selectedPatient.insurance_type}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Insurance Number</Label>
                        <p className="font-medium">{selectedPatient.insurance_number}</p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* View Patient Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Patient Details</DialogTitle>
            <DialogDescription>Complete patient information and medical history</DialogDescription>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Patient Number</Label>
                    <p className="font-mono text-lg font-semibold">{selectedPatient.patient_number}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Full Name</Label>
                    <p className="font-medium">{selectedPatient.first_name} {selectedPatient.last_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Date of Birth</Label>
                    <p className="font-medium">
                      {new Date(selectedPatient.date_of_birth).toLocaleDateString()} 
                      <span className="text-muted-foreground ml-2">({calculateAge(selectedPatient.date_of_birth)} years)</span>
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Gender</Label>
                    <p className="font-medium capitalize">{selectedPatient.gender}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{selectedPatient.phone}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Location</Label>
                    <p className="font-medium">{selectedPatient.address}</p>
                  </div>
                  {selectedPatient.blood_type && (
                    <div>
                      <Label className="text-muted-foreground">Blood Type</Label>
                      <Badge variant="secondary" className="text-base">{selectedPatient.blood_type}</Badge>
                    </div>
                  )}
                  {selectedPatient.allergies && (
                    <div>
                      <Label className="text-muted-foreground">Allergies</Label>
                      <Badge variant="destructive">{selectedPatient.allergies}</Badge>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h4 className="font-semibold">Emergency Contact</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Contact Name</Label>
                    <p className="font-medium">{selectedPatient.emergency_contact}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Contact Phone</Label>
                    <p className="font-medium">{selectedPatient.emergency_phone}</p>
                  </div>
                </div>
              </div>

              {selectedPatient.insurance_type && (
                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-semibold">Insurance Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Provider</Label>
                      <p className="font-medium">{selectedPatient.insurance_type}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Member Number</Label>
                      <p className="font-mono">{selectedPatient.insurance_number}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <Label className="text-muted-foreground">Registered</Label>
                <p className="text-sm">{new Date(selectedPatient.created_at).toLocaleString()}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Patient Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Patient Information</DialogTitle>
            <DialogDescription>Update patient details for {selectedPatient?.first_name} {selectedPatient?.last_name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdatePatient} className="space-y-6">
            {/* Same form fields as registration, but pre-filled */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Personal Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-first-name">First Name *</Label>
                  <Input
                    id="edit-first-name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-last-name">Last Name *</Label>
                  <Input
                    id="edit-last-name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-dob">Date of Birth *</Label>
                  <Input
                    id="edit-dob"
                    name="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-gender">Gender *</Label>
                  <Select value={formData.gender} onValueChange={(value) => handleSelectChange('gender', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone *</Label>
                  <Input
                    id="edit-phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-location">Location *</Label>
                  <Input
                    id="edit-location"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Emergency Contact</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-emergency-contact">Contact Name *</Label>
                  <Input
                    id="edit-emergency-contact"
                    name="emergency_contact"
                    value={formData.emergency_contact}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-emergency-phone">Contact Phone *</Label>
                  <Input
                    id="edit-emergency-phone"
                    name="emergency_phone"
                    value={formData.emergency_phone}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </div>


            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Updating...' : 'Update Patient'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

