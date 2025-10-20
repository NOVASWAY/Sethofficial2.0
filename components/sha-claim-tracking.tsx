'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Shield, FileText, Clock, CheckCircle2, XCircle, AlertCircle,
  DollarSign, Calendar, Download, Eye, TrendingUp, RefreshCw
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface SHAClaim {
  id: string
  claimNumber: string // SHA claim number from their website
  month: string
  year: number
  submissionDate: string // Date submitted on SHA website
  status: 'pending' | 'under-review' | 'approved' | 'rejected' | 'paid'
  totalPatients: number
  totalAmount: number // Total claimed
  approvedAmount?: number // Amount approved by SHA
  rejectedAmount?: number // Amount rejected by SHA
  paidAmount?: number // Amount actually paid
  paymentDate?: string
  reviewNotes?: string
  rejectionReason?: string
  recordedBy: string // Who recorded this in the system
  shaWebsiteReference?: string // Reference from SHA website
}

interface ClaimDetail {
  id: string
  claimId: string
  patientName: string
  patientNumber: string // Patient OP Number (e.g., 123/06)
  patientSHANumber: string
  visitDate: string
  consultationAmount: number
  labTestAmount: number
  medicationAmount: number
  totalAmount: number
  status: 'pending' | 'approved' | 'rejected'
  rejectionReason?: string
}

const SHA_CLAIMS_STORAGE_KEY = 'clinic_sha_claims_data'
const SHA_CLAIM_DETAILS_STORAGE_KEY = 'clinic_sha_claim_details_data'

// Default mock data for first-time users
const defaultClaims: SHAClaim[] = [
  {
    id: '1',
    claimNumber: 'SHA/CLM/2025/0001',
    month: 'September',
    year: 2025,
    submissionDate: '2025-10-01',
    status: 'paid',
    totalPatients: 45,
    totalAmount: 450000,
    approvedAmount: 432000,
    paidAmount: 432000,
    paymentDate: '2025-10-15',
    recordedBy: 'Admin User',
    shaWebsiteReference: 'REF-SHA-2025-0001',
  },
  {
    id: '2',
    claimNumber: 'SHA/CLM/2025/0002',
    month: 'October',
    year: 2025,
    submissionDate: '2025-11-01',
    status: 'under-review',
    totalPatients: 52,
    totalAmount: 520000,
    recordedBy: 'Admin User',
    shaWebsiteReference: 'REF-SHA-2025-0002',
  },
  {
    id: '3',
    claimNumber: 'SHA/CLM/2025/0003',
    month: 'October',
    year: 2025,
    submissionDate: '2025-11-02',
    status: 'approved',
    totalPatients: 38,
    totalAmount: 380000,
    approvedAmount: 375000,
    rejectedAmount: 5000,
    recordedBy: 'Admin User',
    shaWebsiteReference: 'REF-SHA-2025-0003',
  },
]

const defaultClaimDetails: ClaimDetail[] = [
  {
    id: '1',
    claimId: '1',
    patientName: 'John Doe',
    patientNumber: '123/06',
    patientSHANumber: 'SHA-2025-001',
    visitDate: '2025-09-15',
    consultationAmount: 2000,
    labTestAmount: 3000,
    medicationAmount: 5000,
    totalAmount: 10000,
    status: 'approved',
  },
  {
    id: '2',
    claimId: '1',
    patientName: 'Jane Smith',
    patientNumber: '456/10',
    patientSHANumber: 'SHA-2025-015',
    visitDate: '2025-09-18',
    consultationAmount: 2000,
    labTestAmount: 0,
    medicationAmount: 3500,
    totalAmount: 5500,
    status: 'approved',
  },
]

export function SHAClaimTracking() {
  const { toast } = useToast()
  
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isSubmitOpen, setIsSubmitOpen] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<SHAClaim | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  
  const [claims, setClaims] = useState<SHAClaim[]>([])
  const [claimDetails, setClaimDetails] = useState<ClaimDetail[]>([])

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedClaims = localStorage.getItem(SHA_CLAIMS_STORAGE_KEY)
      const savedDetails = localStorage.getItem(SHA_CLAIM_DETAILS_STORAGE_KEY)

      if (savedClaims) {
        setClaims(JSON.parse(savedClaims))
      } else {
        setClaims(defaultClaims)
      }

      if (savedDetails) {
        setClaimDetails(JSON.parse(savedDetails))
      } else {
        setClaimDetails(defaultClaimDetails)
      }
    } catch (error) {
      console.error('Error loading SHA claims from localStorage:', error)
      setClaims(defaultClaims)
      setClaimDetails(defaultClaimDetails)
    } finally {
      setIsInitialized(true)
    }
  }, [])

  // Save claims to localStorage whenever they change
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(SHA_CLAIMS_STORAGE_KEY, JSON.stringify(claims))
      } catch (error) {
        console.error('Error saving SHA claims to localStorage:', error)
      }
    }
  }, [claims, isInitialized])

  // Save claim details to localStorage whenever they change
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(SHA_CLAIM_DETAILS_STORAGE_KEY, JSON.stringify(claimDetails))
      } catch (error) {
        console.error('Error saving SHA claim details to localStorage:', error)
      }
    }
  }, [claimDetails, isInitialized])

  const [submitData, setSubmitData] = useState({
    claimNumber: '', // SHA claim number from their website
    month: '',
    year: new Date().getFullYear(),
    submissionDate: '', // Date you submitted on SHA website
    totalPatients: 0,
    totalAmount: 0,
    shaWebsiteReference: '',
    notes: '',
  })

  const getStatusBadge = (status: SHAClaim['status']) => {
    const styles = {
      pending: { bg: 'bg-blue-100 text-blue-800', icon: Clock },
      'under-review': { bg: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
      approved: { bg: 'bg-green-100 text-green-800', icon: CheckCircle2 },
      rejected: { bg: 'bg-red-100 text-red-800', icon: XCircle },
      paid: { bg: 'bg-purple-100 text-purple-800', icon: DollarSign },
    }
    const { bg, icon: Icon } = styles[status]
    return (
      <Badge className={bg}>
        <Icon className="h-3 w-3 mr-1" />
        {status.replace('-', ' ').toUpperCase()}
      </Badge>
    )
  }

  const handleViewDetails = (claim: SHAClaim) => {
    setSelectedClaim(claim)
    setIsDetailsOpen(true)
  }

  const handleRecordClaim = () => {
    if (!submitData.claimNumber || !submitData.month || !submitData.submissionDate) {
      toast({
        variant: 'error',
        title: 'Validation Error',
        description: 'Please fill in claim number, month, and submission date',
      })
      return
    }

    const newClaim: SHAClaim = {
      id: crypto.randomUUID(),
      claimNumber: submitData.claimNumber, // Claim number from SHA website
      month: submitData.month,
      year: submitData.year,
      submissionDate: submitData.submissionDate, // Date submitted on SHA website
      status: 'pending', // Default status when first recorded
      totalPatients: submitData.totalPatients,
      totalAmount: submitData.totalAmount,
      recordedBy: 'Current User',
      shaWebsiteReference: submitData.shaWebsiteReference,
    }

    setClaims([newClaim, ...claims])
    
    toast({
      title: 'Claim Recorded',
      description: `Claim ${newClaim.claimNumber} has been recorded in the system`,
    })

    setIsSubmitOpen(false)
    setSubmitData({ 
      claimNumber: '',
      month: '',
      year: new Date().getFullYear(),
      submissionDate: '',
      totalPatients: 0,
      totalAmount: 0,
      shaWebsiteReference: '',
      notes: ''
    })
  }

  const handleExportClaim = (claim: SHAClaim) => {
    let reportData = `SHA CLAIM REPORT\n`
    reportData += `${'='.repeat(100)}\n\n`
    reportData += `Claim Number: ${claim.claimNumber}\n`
    reportData += `Period: ${claim.month} ${claim.year}\n`
    reportData += `Submission Date: ${new Date(claim.submissionDate).toLocaleDateString()}\n`
    reportData += `Status: ${claim.status.toUpperCase()}\n`
    reportData += `Recorded By: ${claim.recordedBy}\n`
    if (claim.shaWebsiteReference) {
      reportData += `SHA Reference: ${claim.shaWebsiteReference}\n`
    }
    reportData += `\n`

    reportData += `CLAIM SUMMARY\n`
    reportData += `${'-'.repeat(100)}\n`
    reportData += `Total Patients: ${claim.totalPatients}\n`
    reportData += `Total Claimed Amount: KES ${claim.totalAmount.toLocaleString()}\n`
    
    if (claim.approvedAmount !== undefined) {
      reportData += `Approved Amount: KES ${claim.approvedAmount.toLocaleString()}\n`
    }
    if (claim.rejectedAmount !== undefined) {
      reportData += `Rejected Amount: KES ${claim.rejectedAmount.toLocaleString()}\n`
    }
    if (claim.paidAmount !== undefined) {
      reportData += `Paid Amount: KES ${claim.paidAmount.toLocaleString()}\n`
      reportData += `Payment Date: ${claim.paymentDate ? new Date(claim.paymentDate).toLocaleDateString() : 'N/A'}\n`
    }

    if (claim.rejectionReason) {
      reportData += `\nRejection Reason: ${claim.rejectionReason}\n`
    }
    if (claim.reviewNotes) {
      reportData += `\nReview Notes: ${claim.reviewNotes}\n`
    }

    const details = claimDetails.filter(d => d.claimId === claim.id)
    if (details.length > 0) {
      reportData += `\n\nCLAIM DETAILS\n`
      reportData += `${'='.repeat(100)}\n\n`
      
      details.forEach((detail, index) => {
        reportData += `${index + 1}. Patient: ${detail.patientName}\n`
        reportData += `   OP Number: ${detail.patientNumber}\n`
        reportData += `   SHA Number: ${detail.patientSHANumber}\n`
        reportData += `   Visit Date: ${new Date(detail.visitDate).toLocaleDateString()}\n`
        reportData += `   Consultation: KES ${detail.consultationAmount.toLocaleString()}\n`
        reportData += `   Lab Tests: KES ${detail.labTestAmount.toLocaleString()}\n`
        reportData += `   Medication: KES ${detail.medicationAmount.toLocaleString()}\n`
        reportData += `   Total: KES ${detail.totalAmount.toLocaleString()}\n`
        reportData += `   Status: ${detail.status.toUpperCase()}\n`
        if (detail.rejectionReason) {
          reportData += `   Rejection Reason: ${detail.rejectionReason}\n`
        }
        reportData += `\n`
      })
    }

    const blob = new Blob([reportData], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${claim.claimNumber}-report.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: 'Claim Exported',
      description: `${claim.claimNumber} report has been downloaded`,
    })
  }

  // Statistics
  const stats = {
    totalClaims: claims.length,
    pending: claims.filter(c => c.status === 'pending' || c.status === 'under-review').length,
    approved: claims.filter(c => c.status === 'approved' || c.status === 'paid').length,
    totalClaimed: claims.reduce((sum, c) => sum + c.totalAmount, 0),
    totalPaid: claims.reduce((sum, c) => sum + (c.paidAmount || 0), 0),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">SHA Claim Tracking</h2>
          <p className="text-muted-foreground">
            Record and track claims submitted on the SHA official website
          </p>
        </div>
        <Button size="lg" onClick={() => setIsSubmitOpen(true)}>
          <Shield className="mr-2 h-4 w-4" />
          Record New Claim
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalClaims}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Claimed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">KES {stats.totalClaimed.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-purple-600">KES {stats.totalPaid.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Claims Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All ({claims.length})</TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({claims.filter(c => c.status === 'pending' || c.status === 'under-review').length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({claims.filter(c => c.status === 'approved').length})
          </TabsTrigger>
          <TabsTrigger value="paid">
            Paid ({claims.filter(c => c.status === 'paid').length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({claims.filter(c => c.status === 'rejected').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-4">
          <ClaimsList 
            claims={claims} 
            onViewDetails={handleViewDetails}
            onExport={handleExportClaim}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>

        <TabsContent value="pending" className="space-y-4 mt-4">
          <ClaimsList 
            claims={claims.filter(c => c.status === 'pending' || c.status === 'under-review')}
            onViewDetails={handleViewDetails}
            onExport={handleExportClaim}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>

        <TabsContent value="approved" className="space-y-4 mt-4">
          <ClaimsList 
            claims={claims.filter(c => c.status === 'approved')}
            onViewDetails={handleViewDetails}
            onExport={handleExportClaim}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>

        <TabsContent value="paid" className="space-y-4 mt-4">
          <ClaimsList 
            claims={claims.filter(c => c.status === 'paid')}
            onViewDetails={handleViewDetails}
            onExport={handleExportClaim}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4 mt-4">
          <ClaimsList 
            claims={claims.filter(c => c.status === 'rejected')}
            onViewDetails={handleViewDetails}
            onExport={handleExportClaim}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>
      </Tabs>

      {/* Record Claim Dialog */}
      <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record SHA Claim</DialogTitle>
            <DialogDescription>
              After submitting a claim on the SHA official website, record it here for tracking
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-md text-sm">
              <p className="font-medium mb-1">📝 Important:</p>
              <p className="text-muted-foreground">
                First submit your claim on the SHA official website, then record the details here for tracking purposes.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="claimNumber">SHA Claim Number *</Label>
                <Input
                  id="claimNumber"
                  value={submitData.claimNumber}
                  onChange={(e) => setSubmitData({ ...submitData, claimNumber: e.target.value })}
                  placeholder="e.g. SHA/CLM/2025/0001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="submissionDate">Date Submitted on SHA Website *</Label>
                <Input
                  id="submissionDate"
                  type="date"
                  value={submitData.submissionDate}
                  onChange={(e) => setSubmitData({ ...submitData, submissionDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="month">Month *</Label>
                <select
                  id="month"
                  value={submitData.month}
                  onChange={(e) => setSubmitData({ ...submitData, month: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select month</option>
                  <option value="January">January</option>
                  <option value="February">February</option>
                  <option value="March">March</option>
                  <option value="April">April</option>
                  <option value="May">May</option>
                  <option value="June">June</option>
                  <option value="July">July</option>
                  <option value="August">August</option>
                  <option value="September">September</option>
                  <option value="October">October</option>
                  <option value="November">November</option>
                  <option value="December">December</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Year *</Label>
                <Input
                  id="year"
                  type="number"
                  value={submitData.year}
                  onChange={(e) => setSubmitData({ ...submitData, year: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalPatients">Total Patients</Label>
                <Input
                  id="totalPatients"
                  type="number"
                  value={submitData.totalPatients || ''}
                  onChange={(e) => setSubmitData({ ...submitData, totalPatients: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalAmount">Total Amount Claimed (KES)</Label>
                <Input
                  id="totalAmount"
                  type="number"
                  value={submitData.totalAmount || ''}
                  onChange={(e) => setSubmitData({ ...submitData, totalAmount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shaWebsiteReference">SHA Website Reference (Optional)</Label>
              <Input
                id="shaWebsiteReference"
                value={submitData.shaWebsiteReference}
                onChange={(e) => setSubmitData({ ...submitData, shaWebsiteReference: e.target.value })}
                placeholder="e.g. REF-SHA-2025-0001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={submitData.notes}
                onChange={(e) => setSubmitData({ ...submitData, notes: e.target.value })}
                placeholder="Additional notes or comments..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsSubmitOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRecordClaim}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Record Claim
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Claim Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Claim Details</DialogTitle>
            <DialogDescription>
              {selectedClaim?.claimNumber} - {selectedClaim?.month} {selectedClaim?.year}
            </DialogDescription>
          </DialogHeader>
          {selectedClaim && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Claim Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Claim Number</p>
                      <p className="font-medium">{selectedClaim.claimNumber}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <div className="mt-1">{getStatusBadge(selectedClaim.status)}</div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Submission Date</p>
                      <p className="font-medium">{new Date(selectedClaim.submissionDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Recorded By</p>
                      <p className="font-medium">{selectedClaim.recordedBy}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Patients</p>
                      <p className="font-medium">{selectedClaim.totalPatients}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Amount</p>
                      <p className="font-medium">KES {selectedClaim.totalAmount.toLocaleString()}</p>
                    </div>
                    {selectedClaim.approvedAmount !== undefined && (
                      <>
                        <div>
                          <p className="text-muted-foreground">Approved Amount</p>
                          <p className="font-medium text-green-600">KES {selectedClaim.approvedAmount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Rejection Amount</p>
                          <p className="font-medium text-red-600">KES {(selectedClaim.rejectedAmount || 0).toLocaleString()}</p>
                        </div>
                      </>
                    )}
                    {selectedClaim.paidAmount !== undefined && (
                      <>
                        <div>
                          <p className="text-muted-foreground">Paid Amount</p>
                          <p className="font-medium text-purple-600">KES {selectedClaim.paidAmount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Payment Date</p>
                          <p className="font-medium">
                            {selectedClaim.paymentDate ? new Date(selectedClaim.paymentDate).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {claimDetails.filter(d => d.claimId === selectedClaim.id).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Patient Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[400px] overflow-y-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-background border-b">
                          <tr className="text-left text-sm">
                            <th className="p-2">Patient</th>
                            <th className="p-2">OP Number</th>
                            <th className="p-2">SHA Number</th>
                            <th className="p-2">Visit Date</th>
                            <th className="p-2 text-right">Consultation</th>
                            <th className="p-2 text-right">Lab Tests</th>
                            <th className="p-2 text-right">Medication</th>
                            <th className="p-2 text-right">Total</th>
                            <th className="p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {claimDetails
                            .filter(d => d.claimId === selectedClaim.id)
                            .map(detail => (
                              <tr key={detail.id} className="border-b text-sm">
                                <td className="p-2">{detail.patientName}</td>
                                <td className="p-2">
                                  <Badge variant="outline" className="font-mono text-xs">
                                    {detail.patientNumber}
                                  </Badge>
                                </td>
                                <td className="p-2 text-muted-foreground">{detail.patientSHANumber}</td>
                                <td className="p-2">{new Date(detail.visitDate).toLocaleDateString()}</td>
                                <td className="p-2 text-right">{detail.consultationAmount.toLocaleString()}</td>
                                <td className="p-2 text-right">{detail.labTestAmount.toLocaleString()}</td>
                                <td className="p-2 text-right">{detail.medicationAmount.toLocaleString()}</td>
                                <td className="p-2 text-right font-semibold">{detail.totalAmount.toLocaleString()}</td>
                                <td className="p-2">
                                  <Badge className={
                                    detail.status === 'approved' ? 'bg-green-100 text-green-800' :
                                    detail.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }>
                                    {detail.status}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Helper component for claims list
function ClaimsList({ 
  claims, 
  onViewDetails, 
  onExport,
  getStatusBadge 
}: { 
  claims: SHAClaim[]
  onViewDetails: (claim: SHAClaim) => void
  onExport: (claim: SHAClaim) => void
  getStatusBadge: (status: SHAClaim['status']) => React.ReactNode
}) {
  if (claims.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Shield className="h-12 w-12 mx-auto mb-2 opacity-50 text-muted-foreground" />
          <p className="text-muted-foreground">No claims found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {claims.map(claim => (
        <Card key={claim.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold">{claim.claimNumber}</h3>
                  {getStatusBadge(claim.status)}
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Period</p>
                    <p className="font-medium">{claim.month} {claim.year}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Patients</p>
                    <p className="font-medium">{claim.totalPatients}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Amount</p>
                    <p className="font-medium">KES {claim.totalAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Submitted</p>
                    <p className="font-medium">{new Date(claim.submissionDate).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <Button size="sm" variant="outline" onClick={() => onViewDetails(claim)}>
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button size="sm" variant="outline" onClick={() => onExport(claim)}>
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

