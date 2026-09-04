'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Workflow, Users, Clock, CheckCircle2, AlertCircle, Plus, 
  UserCheck, FileText, Stethoscope, Loader2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { workflowAPI } from '@/lib/api-client'

interface WorkflowData {
  workflow_id: string
  patient_id: string
  current_stage: string
  initial_role: string
}

interface Task {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  assigned_to: string
  due_date?: string
  priority: 'low' | 'medium' | 'high'
}

interface WorkflowManagementProps {
  role?: string
  onWorkflowCreated?: (workflow: WorkflowData) => void
}

export function WorkflowManagement({ role = 'admin', onWorkflowCreated }: WorkflowManagementProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  
  // Workflow creation form
  const [workflowForm, setWorkflowForm] = useState({
    patientId: '',
    workflowType: 'consultation',
    assignedTo: role === 'admin' ? 'receptionist' : role
  })

  // Load tasks for current role
  useEffect(() => {
    if (role) {
      loadTasksForRole(role)
    }
  }, [role])

  const loadTasksForRole = async (roleName: string) => {
    try {
      setLoadingTasks(true)
      const result = await workflowAPI.getTasksForRole(roleName)
      setTasks(result.tasks || [])
    } catch (error) {
      console.error('Failed to load tasks:', error)
      toast({
        variant: 'error',
        title: 'Failed to Load Tasks',
        description: 'Unable to load workflow tasks. Please try again.',
      })
    } finally {
      setLoadingTasks(false)
    }
  }

  const handleCreateWorkflow = async () => {
    if (!workflowForm.patientId.trim()) {
      toast({
        variant: 'error',
        title: 'Patient ID Required',
        description: 'Please enter a patient ID to create a workflow',
      })
      return
    }

    setLoading(true)
    try {
      const result = await workflowAPI.create(
        workflowForm.patientId,
        workflowForm.workflowType,
        workflowForm.assignedTo
      )

      toast({
        title: 'Workflow Created Successfully',
        description: `Workflow ${result.workflow_id} created for patient ${result.patient_id}`,
      })

      // Reset form
      setWorkflowForm({
        patientId: '',
        workflowType: 'consultation',
        assignedTo: role === 'admin' ? 'receptionist' : role
      })

      if (onWorkflowCreated) {
        onWorkflowCreated(result)
      }

      // Reload tasks
      loadTasksForRole(role)

    } catch (error) {
      console.error('Failed to create workflow:', error)
      toast({
        variant: 'error',
        title: 'Workflow Creation Failed',
        description: 'Unable to create workflow. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-600" />
      default: return <AlertCircle className="h-4 w-4 text-yellow-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      default: return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleIcon = (roleName: string) => {
    switch (roleName) {
      case 'clinician': return <Stethoscope className="h-4 w-4" />
      case 'nurse': return <UserCheck className="h-4 w-4" />
      case 'receptionist': return <Users className="h-4 w-4" />
      case 'pharmacist': return <FileText className="h-4 w-4" />
      default: return <Users className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Workflow Management</h2>
          <p className="text-muted-foreground">
            Manage patient workflows and task assignments
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Create Workflow */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New Workflow
            </CardTitle>
            <CardDescription>
              Start a new patient workflow process
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="patientId">Patient ID *</Label>
              <Input
                id="patientId"
                placeholder="Enter patient ID"
                value={workflowForm.patientId}
                onChange={(e) => setWorkflowForm(prev => ({ ...prev, patientId: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workflowType">Workflow Type</Label>
              <Select 
                value={workflowForm.workflowType} 
                onValueChange={(value) => setWorkflowForm(prev => ({ ...prev, workflowType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation">Consultation</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="procedure">Procedure</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assign To</Label>
              <Select 
                value={workflowForm.assignedTo} 
                onValueChange={(value) => setWorkflowForm(prev => ({ ...prev, assignedTo: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receptionist">Receptionist</SelectItem>
                  <SelectItem value="nurse">Nurse</SelectItem>
                  <SelectItem value="clinician">Clinician</SelectItem>
                  <SelectItem value="pharmacist">Pharmacist</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleCreateWorkflow} 
              disabled={loading || !workflowForm.patientId.trim()}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Workflow...
                </>
              ) : (
                <>
                  <Workflow className="mr-2 h-4 w-4" />
                  Create Workflow
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Right Column - Current Role Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getRoleIcon(role)}
              My Tasks ({role})
            </CardTitle>
            <CardDescription>
              Tasks assigned to your role
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTasks ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading tasks...</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Workflow className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No tasks assigned</p>
                <p className="text-sm">Tasks will appear here when workflows are created</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{task.title}</h4>
                          <Badge variant="outline" className={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(task.status)}
                        <Badge variant="outline" className={getStatusColor(task.status)}>
                          {task.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Assigned to: {task.assigned_to}</span>
                      {task.due_date && (
                        <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Workflow Information */}
      <Alert>
        <Workflow className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-1">
            <p className="font-semibold">Workflow System Information</p>
            <p className="text-sm">
              The workflow system automatically manages patient care processes:
            </p>
            <ul className="text-sm list-disc list-inside space-y-1">
              <li><strong>Registration:</strong> Patient check-in and initial assessment</li>
              <li><strong>Consultation:</strong> Medical examination and diagnosis</li>
              <li><strong>Treatment:</strong> Prescription and procedure execution</li>
              <li><strong>Billing:</strong> Automated invoice generation and payment processing</li>
              <li><strong>Follow-up:</strong> Post-treatment monitoring and care</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}
