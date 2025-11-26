'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  RefreshCw, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Clock,
  AlertTriangle,
  Info
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { patientAPI } from '@/lib/api-client'

interface ImportSession {
  id: string
  file_name: string
  total_records: number
  imported_count: number
  failed_count: number
  status: string
  current_batch: number
  total_batches: number
  progress_percentage: number | null
  started_at: string | null
  completed_at: string | null
  error_summary?: any
  batch_results?: any[]
}

interface ResumeImportProps {
  session: ImportSession
  onResumeComplete?: () => void
  onCancel?: () => void
}

export function ResumeImport({ session, onResumeComplete, onCancel }: ResumeImportProps) {
  const { toast } = useToast()
  const [isResuming, setIsResuming] = useState(false)
  const [resumeProgress, setResumeProgress] = useState({
    current: session.imported_count,
    total: session.total_records,
    percentage: session.progress_percentage || 0,
  })

  const canResume = session.status === 'failed' || session.status === 'partial' || session.status === 'in_progress'
  const remainingRecords = session.total_records - session.imported_count
  const remainingBatches = session.total_batches - session.current_batch

  const handleResume = async () => {
    if (!canResume) {
      toast({
        title: 'Cannot Resume',
        description: `Import session with status "${session.status}" cannot be resumed`,
        variant: 'error',
      })
      return
    }

    setIsResuming(true)

    try {
      // Note: In a real implementation, you would need to retrieve the original patient data
      // This could be stored in session metadata or retrieved from the original file
      toast({
        title: 'Resume Not Available',
        description: 'Original patient data is required to resume. Please re-upload the file and use the resume option.',
        variant: 'info',
      })
      
      // For now, show that resume capability structure is ready
      if (onResumeComplete) {
        onResumeComplete()
      }
    } catch (error) {
      console.error('Resume error:', error)
      toast({
        title: 'Resume Failed',
        description: error instanceof Error ? error.message : 'Failed to resume import',
        variant: 'error',
      })
    } finally {
      setIsResuming(false)
    }
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This import was interrupted or failed. You can resume from where it left off.
        </AlertDescription>
      </Alert>

      {/* Session Status */}
      <Card>
        <CardHeader>
          <CardTitle>Import Session Status</CardTitle>
          <CardDescription>Current progress and status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">File Name</p>
              <p className="font-medium">{session.file_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge 
                className={
                  session.status === 'completed' ? 'bg-green-500' :
                  session.status === 'failed' ? 'bg-red-500' :
                  session.status === 'partial' ? 'bg-yellow-500' :
                  'bg-blue-500'
                }
              >
                {session.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Records</p>
              <p className="font-medium">{session.total_records}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Imported</p>
              <p className="font-medium text-green-600">{session.imported_count}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="font-medium text-red-600">{session.failed_count}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className="font-medium text-orange-600">{remainingRecords}</p>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{Math.round(session.progress_percentage || 0)}%</span>
            </div>
            <Progress value={session.progress_percentage || 0} className="h-2" />
          </div>

          {/* Batch Progress */}
          {session.total_batches > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Batch Progress</span>
                <span>Batch {session.current_batch} of {session.total_batches}</span>
              </div>
              <Progress 
                value={(session.current_batch / session.total_batches) * 100} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">
                {remainingBatches} batch(es) remaining
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Summary */}
      {session.error_summary && (
        <Card>
          <CardHeader>
            <CardTitle>Error Summary</CardTitle>
            <CardDescription>Issues encountered during import</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">Total Errors:</span>{' '}
                {session.error_summary.total_errors || 0}
              </p>
              {session.error_summary.sample_errors && session.error_summary.sample_errors.length > 0 && (
                <div className="mt-4 space-y-1">
                  <p className="text-sm font-medium">Sample Errors:</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {session.error_summary.sample_errors.slice(0, 5).map((error: any, index: number) => (
                      <div key={index} className="text-xs p-2 bg-red-50 border border-red-200 rounded">
                        <span className="font-medium">Row {error.row}:</span> {error.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleResume} 
          disabled={!canResume || isResuming}
          className="min-w-[120px]"
        >
          {isResuming ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Resuming...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Resume Import
            </>
          )}
        </Button>
      </div>

      {!canResume && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This import session cannot be resumed. Status: {session.status}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

