'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileText, 
  TrendingUp,
  AlertCircle,
  Eye,
  RefreshCw,
  Play
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { patientAPI } from '@/lib/api-client'
import { format } from 'date-fns'
import { ResumeImport } from './resume-import'

interface ImportSession {
  id: string
  file_name: string
  total_records: number
  imported_count: number
  failed_count: number
  duplicate_count: number
  status: string
  progress_percentage: number | null
  current_batch: number
  total_batches: number
  started_at: string | null
  completed_at: string | null
  created_at: string
}


export function ImportProgressDashboard() {
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [sessions, setSessions] = useState<ImportSession[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSession, setSelectedSession] = useState<ImportSession | null>(null)
  const [resumeSession, setResumeSession] = useState<ImportSession | null>(null)

  const loadHistory = async () => {
    setLoading(true)
    try {
      const response = await patientAPI.getImportHistory()
      if (response && response.sessions) {
        setSessions(response.sessions as ImportSession[])
      }
    } catch (error) {
      console.error('Failed to load import history:', error)
      toast({
        title: 'Error',
        description: 'Failed to load import history',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadHistory()
    }
  }, [isOpen])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
      case 'in_progress':
        return <Badge className="bg-blue-500"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>
      case 'partial':
        return <Badge className="bg-yellow-500"><AlertCircle className="w-3 h-3 mr-1" />Partial</Badge>
      case 'cancelled':
        return <Badge variant="outline"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm')
    } catch {
      return dateString
    }
  }

  const getSuccessRate = (session: ImportSession) => {
    if (session.total_records === 0) return 0
    return Math.round((session.imported_count / session.total_records) * 100)
  }

  // Calculate statistics
  const totalImports = sessions.length
  const totalRecords = sessions.reduce((sum, s) => sum + s.total_records, 0)
  const totalImported = sessions.reduce((sum, s) => sum + s.imported_count, 0)
  const totalFailed = sessions.reduce((sum, s) => sum + s.failed_count, 0)
  const successRate = totalRecords > 0 ? Math.round((totalImported / totalRecords) * 100) : 0

  return (
    <>
      <Button onClick={() => setIsOpen(true)} variant="outline">
        <History className="w-4 h-4 mr-2" />
        Import History
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Progress & History</DialogTitle>
            <DialogDescription>
              View all patient import operations and their status
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Statistics Overview */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-2xl font-bold">{totalImports}</p>
                      <p className="text-sm text-muted-foreground">Total Imports</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold">{totalImported.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Records Imported</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold">{totalFailed.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Failed Records</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold">{successRate}%</p>
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Import Sessions Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Import Sessions</CardTitle>
                    <CardDescription>Recent patient import operations</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadHistory} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No import history found
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Progress</TableHead>
                          <TableHead>Records</TableHead>
                          <TableHead>Success Rate</TableHead>
                          <TableHead>Started</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessions.map((session) => (
                          <TableRow key={session.id}>
                            <TableCell className="font-medium">{session.file_name}</TableCell>
                            <TableCell>{getStatusBadge(session.status)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 w-32">
                                <Progress 
                                  value={session.progress_percentage || 0} 
                                  className="h-2 flex-1"
                                />
                                <span className="text-xs text-muted-foreground">
                                  {Math.round(session.progress_percentage || 0)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div className="font-medium text-green-600">
                                  {session.imported_count} imported
                                </div>
                                {session.failed_count > 0 && (
                                  <div className="text-red-600">
                                    {session.failed_count} failed
                                  </div>
                                )}
                                {session.duplicate_count > 0 && (
                                  <div className="text-orange-600">
                                    {session.duplicate_count} duplicates
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {getSuccessRate(session)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(session.started_at)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedSession(session)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {(session.status === 'failed' || session.status === 'partial' || session.status === 'in_progress') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setResumeSession(session)}
                                  >
                                    <Play className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
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
        </DialogContent>
      </Dialog>

      {/* Session Details Dialog */}
      {selectedSession && (
        <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Import Session Details</DialogTitle>
              <DialogDescription>
                Detailed information about this import operation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">File Name</p>
                  <p className="font-medium">{selectedSession.file_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  {getStatusBadge(selectedSession.status)}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Records</p>
                  <p className="font-medium">{selectedSession.total_records}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                  <p className="font-medium">{getSuccessRate(selectedSession)}%</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Started</p>
                  <p className="text-sm">{formatDate(selectedSession.started_at)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <p className="text-sm">{formatDate(selectedSession.completed_at)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Results</p>
                <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg">
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {selectedSession.imported_count}
                    </p>
                    <p className="text-sm text-muted-foreground">Imported</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">
                      {selectedSession.failed_count}
                    </p>
                    <p className="text-sm text-muted-foreground">Failed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-orange-600">
                      {selectedSession.duplicate_count}
                    </p>
                    <p className="text-sm text-muted-foreground">Duplicates</p>
                  </div>
                </div>
              </div>
              {selectedSession.total_batches > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Batch Progress</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Batch {selectedSession.current_batch} of {selectedSession.total_batches}</span>
                      <span>{Math.round((selectedSession.current_batch / selectedSession.total_batches) * 100)}%</span>
                    </div>
                    <Progress 
                      value={(selectedSession.current_batch / selectedSession.total_batches) * 100} 
                      className="h-2"
                    />
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Resume Import Dialog */}
      {resumeSession && (
        <Dialog open={!!resumeSession} onOpenChange={() => setResumeSession(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Resume Import</DialogTitle>
              <DialogDescription>
                Continue importing from where it left off
              </DialogDescription>
            </DialogHeader>
            <ResumeImport
              session={resumeSession}
              onResumeComplete={() => {
                setResumeSession(null)
                loadHistory()
              }}
              onCancel={() => setResumeSession(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

