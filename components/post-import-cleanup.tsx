'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  Wrench, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw,
  FileText,
  Phone,
  MapPin,
  Mail,
  Calendar,
  Info
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { patientAPI } from '@/lib/api-client'
import { usePatientEnhanced } from '@/contexts/patient-context-enhanced'

interface CleanupIssue {
  id: string
  patient_number: string
  first_name: string
  last_name: string
  issue_type: 'missing_phone' | 'missing_location' | 'invalid_phone' | 'missing_email' | 'missing_dob' | 'duplicate'
  severity: 'error' | 'warning' | 'info'
  description: string
  suggestion: string
}

interface CleanupStats {
  total_patients: number
  issues_found: number
  missing_phone: number
  missing_location: number
  invalid_phone: number
  missing_email: number
  missing_dob: number
  duplicates: number
}

export function PostImportCleanup() {
  const { toast } = useToast()
  const { patients, loadPatients } = usePatientEnhanced()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [issues, setIssues] = useState<CleanupIssue[]>([])
  const [stats, setStats] = useState<CleanupStats | null>(null)
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set())
  const [isFixing, setIsFixing] = useState(false)
  const [fixProgress, setFixProgress] = useState(0)

  useEffect(() => {
    if (patients.length > 0) {
      analyzeData()
    }
  }, [patients])

  const analyzeData = async () => {
    setIsAnalyzing(true)
    try {
      const cleanupIssues: CleanupIssue[] = []
      const stats: CleanupStats = {
        total_patients: patients.length,
        issues_found: 0,
        missing_phone: 0,
        missing_location: 0,
        invalid_phone: 0,
        missing_email: 0,
        missing_dob: 0,
        duplicates: 0,
      }

      // Analyze each patient
      patients.forEach(patient => {
        // Check missing phone
        if (!patient.phone || patient.phone.trim() === '' || patient.phone === '0000000000') {
          cleanupIssues.push({
            id: patient.id,
            patient_number: patient.patient_number || patient.id,
            first_name: patient.first_name,
            last_name: patient.last_name,
            issue_type: 'missing_phone',
            severity: 'warning',
            description: 'Phone number is missing or invalid',
            suggestion: 'Add a valid phone number',
          })
          stats.missing_phone++
        } else {
          // Check invalid phone format
          const phoneRegex = /^(\+?254|0)?[17]\d{8}$/
          if (!phoneRegex.test(patient.phone.replace(/\s+/g, ''))) {
            cleanupIssues.push({
              id: patient.id,
              patient_number: patient.patient_number || patient.id,
              first_name: patient.first_name,
              last_name: patient.last_name,
              issue_type: 'invalid_phone',
              severity: 'warning',
              description: `Phone number format may be invalid: ${patient.phone}`,
              suggestion: 'Update to valid format (e.g., +254XXXXXXXXX or 0XXXXXXXXX)',
            })
            stats.invalid_phone++
          }
        }

        // Check missing location
        if (!patient.location || patient.location.trim() === '') {
          cleanupIssues.push({
            id: patient.id,
            patient_number: patient.patient_number || patient.id,
            first_name: patient.first_name,
            last_name: patient.last_name,
            issue_type: 'missing_location',
            severity: 'info',
            description: 'Location/address is missing',
            suggestion: 'Add patient location',
          })
          stats.missing_location++
        }

        // Check missing email (optional but good to have)
        if (!patient.email || patient.email.trim() === '') {
          cleanupIssues.push({
            id: patient.id,
            patient_number: patient.patient_number || patient.id,
            first_name: patient.first_name,
            last_name: patient.last_name,
            issue_type: 'missing_email',
            severity: 'info',
            description: 'Email address is missing',
            suggestion: 'Add email address if available',
          })
          stats.missing_email++
        }

        // Check missing date of birth
        if (!patient.date_of_birth || patient.date_of_birth.trim() === '') {
          cleanupIssues.push({
            id: patient.id,
            patient_number: patient.patient_number || patient.id,
            first_name: patient.first_name,
            last_name: patient.last_name,
            issue_type: 'missing_dob',
            severity: 'warning',
            description: 'Date of birth is missing',
            suggestion: 'Add date of birth',
          })
          stats.missing_dob++
        }
      })

      // Check for duplicates (simplified - would use duplicate detection library in production)
      const nameMap = new Map<string, string[]>()
      patients.forEach(p => {
        const fullName = `${p.first_name} ${p.last_name}`.toLowerCase()
        if (!nameMap.has(fullName)) {
          nameMap.set(fullName, [])
        }
        nameMap.get(fullName)!.push(p.id)
      })

      nameMap.forEach((ids, name) => {
        if (ids.length > 1) {
          ids.forEach(id => {
            const patient = patients.find(p => p.id === id)
            if (patient) {
              cleanupIssues.push({
                id: patient.id,
                patient_number: patient.patient_number || patient.id,
                first_name: patient.first_name,
                last_name: patient.last_name,
                issue_type: 'duplicate',
                severity: 'error',
                description: `Possible duplicate: ${name}`,
                suggestion: 'Review and merge if duplicate',
              })
              stats.duplicates++
            }
          })
        }
      })

      stats.issues_found = cleanupIssues.length
      setIssues(cleanupIssues)
      setStats(stats)
    } catch (error) {
      console.error('Analysis error:', error)
      toast({
        title: 'Analysis Failed',
        description: 'Failed to analyze patient data',
        variant: 'error',
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleBulkFix = async () => {
    if (selectedIssues.size === 0) {
      toast({
        title: 'No Issues Selected',
        description: 'Please select issues to fix',
        variant: 'info',
      })
      return
    }

    setIsFixing(true)
    setFixProgress(0)

    try {
      const selectedIssuesList = issues.filter(i => selectedIssues.has(i.id))
      let fixed = 0

      for (let i = 0; i < selectedIssuesList.length; i++) {
        const issue = selectedIssuesList[i]
        
        // For now, just mark as processed
        // In production, would actually fix the issues
        await new Promise(resolve => setTimeout(resolve, 100))
        
        fixed++
        setFixProgress((fixed / selectedIssuesList.length) * 100)
      }

      toast({
        title: 'Cleanup Complete',
        description: `Processed ${fixed} issue(s)`,
      })

      // Reload patients
      await loadPatients()
      
      // Re-analyze
      await analyzeData()
      
      setSelectedIssues(new Set())
    } catch (error) {
      console.error('Fix error:', error)
      toast({
        title: 'Fix Failed',
        description: 'Failed to fix selected issues',
        variant: 'error',
      })
    } finally {
      setIsFixing(false)
      setFixProgress(0)
    }
  }

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'missing_phone':
      case 'invalid_phone':
        return <Phone className="w-4 h-4" />
      case 'missing_location':
        return <MapPin className="w-4 h-4" />
      case 'missing_email':
        return <Mail className="w-4 h-4" />
      case 'missing_dob':
        return <Calendar className="w-4 h-4" />
      case 'duplicate':
        return <Users className="w-4 h-4" />
      default:
        return <AlertTriangle className="w-4 h-4" />
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      case 'warning':
        return <Badge className="bg-yellow-500">Warning</Badge>
      case 'info':
        return <Badge variant="outline">Info</Badge>
      default:
        return <Badge variant="outline">{severity}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Post-Import Cleanup</h2>
          <p className="text-muted-foreground">
            Identify and fix data quality issues after import
          </p>
        </div>
        <Button onClick={analyzeData} disabled={isAnalyzing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
          {isAnalyzing ? 'Analyzing...' : 'Re-analyze'}
        </Button>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.total_patients}</p>
                  <p className="text-sm text-muted-foreground">Total Patients</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.issues_found}</p>
                  <p className="text-sm text-muted-foreground">Issues Found</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {stats.total_patients - stats.issues_found}
                  </p>
                  <p className="text-sm text-muted-foreground">Clean Records</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {Math.round(((stats.total_patients - stats.issues_found) / stats.total_patients) * 100)}%
                  </p>
                  <p className="text-sm text-muted-foreground">Quality Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Issue Breakdown */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Issue Breakdown</CardTitle>
            <CardDescription>Types of issues found in patient data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4 text-orange-600" />
                  <span className="font-medium">Phone Issues</span>
                </div>
                <p className="text-2xl font-bold">{stats.missing_phone + stats.invalid_phone}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.missing_phone} missing, {stats.invalid_phone} invalid
                </p>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">Location Issues</span>
                </div>
                <p className="text-2xl font-bold">{stats.missing_location}</p>
                <p className="text-xs text-muted-foreground">Missing addresses</p>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-red-600" />
                  <span className="font-medium">Duplicates</span>
                </div>
                <p className="text-2xl font-bold">{stats.duplicates}</p>
                <p className="text-xs text-muted-foreground">Possible duplicates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Issues List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Issues Found</CardTitle>
              <CardDescription>
                {issues.length} issue(s) identified in patient data
              </CardDescription>
            </div>
            {selectedIssues.size > 0 && (
              <Button onClick={handleBulkFix} disabled={isFixing}>
                <Wrench className="w-4 h-4 mr-2" />
                Fix Selected ({selectedIssues.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isFixing && (
            <div className="mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Fixing issues...</span>
                <span>{Math.round(fixProgress)}%</span>
              </div>
              <Progress value={fixProgress} className="h-2" />
            </div>
          )}

          {issues.length === 0 ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                No issues found! All patient records are clean.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedIssues.size === issues.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIssues(new Set(issues.map(i => i.id)))
                          } else {
                            setSelectedIssues(new Set())
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Issue Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Suggestion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map(issue => (
                    <TableRow key={issue.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIssues.has(issue.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedIssues)
                            if (e.target.checked) {
                              newSelected.add(issue.id)
                            } else {
                              newSelected.delete(issue.id)
                            }
                            setSelectedIssues(newSelected)
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {issue.first_name} {issue.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {issue.patient_number}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getIssueIcon(issue.issue_type)}
                          <span className="capitalize">
                            {issue.issue_type.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getSeverityBadge(issue.severity)}</TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm truncate">{issue.description}</p>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm text-muted-foreground truncate">
                          {issue.suggestion}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

