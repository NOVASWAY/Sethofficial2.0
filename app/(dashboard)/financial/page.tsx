import { Metadata } from 'next'
import FinancialDashboard from '@/components/dashboard/financial-dashboard'

export const metadata: Metadata = {
  title: 'Financial Dashboard | Seth Medical Clinic',
  description: 'Comprehensive financial overview and analytics for the clinic',
}

export default function FinancialPage() {
  return (
    <div className="container mx-auto py-6">
      <FinancialDashboard />
    </div>
  )
}
