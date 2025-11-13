'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, Circle, ArrowRight, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'

interface OnboardingStep {
  id: string
  title: string
  description: string
  component: React.ReactNode
}

interface UserOnboardingProps {
  onComplete: () => void
}

export function UserOnboarding({ onComplete }: UserOnboardingProps) {
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Clinic Management System',
      description: 'Let\'s get you started with a quick tour',
      component: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Welcome, {user?.name || 'User'}! This system helps you manage patients, appointments, consultations, and more.
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold">Key Features:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Patient Management</li>
              <li>Appointment Scheduling</li>
              <li>Medical Consultations</li>
              <li>Prescription Management</li>
              <li>Billing & Invoicing</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'dashboard',
      title: 'Your Dashboard',
      description: 'Overview of your role-specific dashboard',
      component: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Your dashboard provides quick access to the most important features for your role.
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold">Dashboard Sections:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Quick Stats</li>
              <li>Recent Activity</li>
              <li>Upcoming Appointments</li>
              <li>Quick Actions</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'navigation',
      title: 'Navigation',
      description: 'How to navigate the system',
      component: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Use the sidebar to navigate between different sections of the system.
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold">Navigation Tips:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Click menu items to switch sections</li>
              <li>Use keyboard shortcuts for faster navigation</li>
              <li>Search using Ctrl+K (or Cmd+K on Mac)</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'features',
      title: 'Key Features',
      description: 'Overview of main features',
      component: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Based on your role ({user?.role}), you have access to specific features:
          </p>
          <div className="space-y-2">
            {user?.role === 'admin' && (
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>User Management</li>
                <li>System Configuration</li>
                <li>Reports & Analytics</li>
                <li>All Features</li>
              </ul>
            )}
            {user?.role === 'clinician' && (
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Patient Management</li>
                <li>Consultations</li>
                <li>Prescriptions</li>
                <li>Medical Records</li>
              </ul>
            )}
            {user?.role === 'nurse' && (
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Patient Care</li>
                <li>Vital Signs</li>
                <li>Appointments</li>
              </ul>
            )}
            {user?.role === 'receptionist' && (
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Patient Registration</li>
                <li>Appointment Scheduling</li>
                <li>Billing</li>
              </ul>
            )}
          </div>
        </div>
      )
    },
    {
      id: 'complete',
      title: 'You\'re All Set!',
      description: 'Start using the system',
      component: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            You're ready to start using the Clinic Management System!
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold">Need Help?</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Click the help icon (?) for context-specific help</li>
              <li>Use keyboard shortcuts: Ctrl+K for search, Ctrl+N for new items</li>
              <li>Contact your system administrator for support</li>
            </ul>
          </div>
        </div>
      )
    }
  ]

  const progress = ((currentStep + 1) / steps.length) * 100

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCompletedSteps(prev => new Set(prev).add(steps[currentStep].id))
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    setCompletedSteps(prev => new Set(prev).add(steps[currentStep].id))
    // Mark onboarding as complete in user preferences
    localStorage.setItem('onboarding_completed', 'true')
    onComplete()
  }

  const handleSkip = () => {
    localStorage.setItem('onboarding_completed', 'true')
    onComplete()
  }

  const currentStepData = steps[currentStep]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{currentStepData.title}</CardTitle>
              <CardDescription>{currentStepData.description}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip
            </Button>
          </div>
          <Progress value={progress} className="mt-4" />
          <div className="flex items-center justify-center gap-2 mt-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                {index < currentStep ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : index === currentStep ? (
                  <Circle className="w-5 h-5 text-primary fill-current" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground" />
                )}
                {index < steps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-1 ${index < currentStep ? 'bg-green-600' : 'bg-muted'}`} />
                )}
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStepData.component}
          
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            <Button onClick={handleNext}>
              {currentStep === steps.length - 1 ? (
                'Complete'
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

