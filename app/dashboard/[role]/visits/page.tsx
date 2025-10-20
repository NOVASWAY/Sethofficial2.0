"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Stethoscope, User, Clock, FileText, Search, Plus, Activity } from "lucide-react"
import { useState } from "react"
import { useParams } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export default function VisitsPage() {
  const params = useParams()
  const role = params.role as string
  const [isNewVisitOpen, setIsNewVisitOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const handleNewVisit = () => {
    setIsNewVisitOpen(true)
  }

  const handleContinueVisit = (visitId: string) => {
    console.log("[v0] Continue visit:", visitId)
    // Navigate to visit details or start visit workflow
  }

  const handleViewNotes = (visitId: string) => {
    console.log("[v0] View notes for visit:", visitId)
    // Open notes dialog or navigate to notes page
  }

  const handleViewDetails = (visitId: string) => {
    console.log("[v0] View details for visit:", visitId)
    // Open visit details dialog
  }

  const mockVisits = [
    {
      id: "V001",
      patientName: "John Doe",
      patientId: "P001",
      visitDate: "2024-01-15",
      visitTime: "09:30",
      chiefComplaint: "Chest pain and shortness of breath",
      diagnosis: "Hypertension",
      clinician: "Dr. Smith",
      status: "in-progress",
      vitals: {
        bp: "140/90",
        pulse: "88",
        temp: "37.2°C",
        weight: "75kg",
      },
    },
    {
      id: "V002",
      patientName: "Jane Smith",
      patientId: "P002",
      visitDate: "2024-01-15",
      visitTime: "11:00",
      chiefComplaint: "Follow-up for diabetes management",
      diagnosis: "Type 2 Diabetes Mellitus",
      clinician: "Dr. Johnson",
      status: "completed",
      vitals: {
        bp: "130/85",
        pulse: "72",
        temp: "36.8°C",
        weight: "68kg",
      },
    },
    {
      id: "V003",
      patientName: "Mike Wilson",
      patientId: "P003",
      visitDate: "2024-01-15",
      visitTime: "14:30",
      chiefComplaint: "Annual health check-up",
      diagnosis: "Healthy - routine check",
      clinician: "Dr. Brown",
      status: "waiting",
      vitals: {
        bp: "120/80",
        pulse: "68",
        temp: "36.5°C",
        weight: "82kg",
      },
    },
  ]

  const filteredVisits = mockVisits.filter(
    (visit) =>
      visit.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visit.patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visit.chiefComplaint.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting":
        return "bg-yellow-500"
      case "in-progress":
        return "bg-blue-500"
      case "completed":
        return "bg-green-500"
      case "cancelled":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Patient Visits</h1>
            <p className="text-muted-foreground">Manage patient visits and clinical encounters</p>
          </div>
          <Button onClick={handleNewVisit}>
            <Plus className="w-4 h-4 mr-2" />
            New Visit
          </Button>
        </div>

        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active">Active Visits</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="all">All Visits</TabsTrigger>
          </TabsList>

          <div className="flex items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search visits..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <TabsContent value="active" className="space-y-4">
            <div className="grid gap-4">
              {filteredVisits
                .filter((visit) => visit.status !== "completed")
                .map((visit) => (
                  <Card key={visit.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{visit.patientName}</span>
                              <Badge variant="outline">{visit.patientId}</Badge>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">{visit.visitTime}</span>
                            </div>
                            <Badge className={getStatusColor(visit.status)}>{visit.status}</Badge>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <span className="text-sm font-medium">Chief Complaint:</span>
                              <p className="text-sm text-muted-foreground">{visit.chiefComplaint}</p>
                            </div>
                            <div>
                              <span className="text-sm font-medium">Clinician:</span>
                              <span className="text-sm text-muted-foreground ml-2">{visit.clinician}</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-6 text-sm">
                            <div className="flex items-center space-x-1">
                              <Activity className="w-4 h-4 text-muted-foreground" />
                              <span>BP: {visit.vitals.bp}</span>
                            </div>
                            <div>Pulse: {visit.vitals.pulse}</div>
                            <div>Temp: {visit.vitals.temp}</div>
                            <div>Weight: {visit.vitals.weight}</div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewNotes(visit.id)}>
                            <FileText className="w-4 h-4 mr-2" />
                            Notes
                          </Button>
                          <Button size="sm" onClick={() => handleContinueVisit(visit.id)}>
                            <Stethoscope className="w-4 h-4 mr-2" />
                            Continue Visit
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <div className="grid gap-4">
              {filteredVisits
                .filter((visit) => visit.status === "completed")
                .map((visit) => (
                  <Card key={visit.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-4">
                            <span className="font-medium">{visit.patientName}</span>
                            <Badge variant="outline">{visit.patientId}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {visit.visitDate} at {visit.visitTime}
                            </span>
                          </div>
                          <div>
                            <span className="text-sm font-medium">Diagnosis:</span>
                            <span className="text-sm text-muted-foreground ml-2">{visit.diagnosis}</span>
                          </div>
                          <div>
                            <span className="text-sm font-medium">Clinician:</span>
                            <span className="text-sm text-muted-foreground ml-2">{visit.clinician}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getStatusColor(visit.status)}>{visit.status}</Badge>
                          <Button variant="outline" size="sm" onClick={() => handleViewDetails(visit.id)}>
                            View Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>All Patient Visits</CardTitle>
                <CardDescription>Complete visit history for all patients</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockVisits.map((visit) => (
                    <div key={visit.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div>
                          <p className="font-medium">{visit.patientName}</p>
                          <p className="text-sm text-muted-foreground">
                            {visit.visitDate} - {visit.diagnosis}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(visit.status)}>{visit.status}</Badge>
                        <Button variant="outline" size="sm" onClick={() => handleViewDetails(visit.id)}>
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* New Visit Dialog */}
      <Dialog open={isNewVisitOpen} onOpenChange={setIsNewVisitOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Start New Patient Visit</DialogTitle>
            <DialogDescription>Begin a new clinical encounter</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Patient</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Search and select patient..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="P001">John Doe (P001)</SelectItem>
                  <SelectItem value="P002">Jane Smith (P002)</SelectItem>
                  <SelectItem value="P003">Mike Wilson (P003)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Visit Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select visit type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation">Consultation</SelectItem>
                  <SelectItem value="follow-up">Follow-up</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="routine">Routine Check-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Chief Complaint</Label>
              <Textarea placeholder="Enter patient's main concern..." rows={3} />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsNewVisitOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  console.log("[v0] Starting new visit")
                  setIsNewVisitOpen(false)
                }}
              >
                Start Visit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
