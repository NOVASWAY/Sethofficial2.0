'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  BarChart3, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  TrendingUp,
  TrendingDown,
  Target,
  FileText,
  XCircle
} from 'lucide-react'
import { 
  generateValidationSummary, 
  getValidationRecommendations,
  type ValidationSummary 
} from '@/lib/import-validation'

interface DataQualityDashboardProps {
  records: Array<Record<string, any>>
  issues: Array<Array<{ field: string; message: string; severity: 'error' | 'warning' | 'info' }>>
}

export function DataQualityDashboard({ records, issues }: DataQualityDashboardProps) {
  const summary = useMemo(() => {
    return generateValidationSummary(records, issues)
  }, [records, issues])

  const recommendations = useMemo(() => {
    return getValidationRecommendations(summary)
  }, [summary])

  const fieldCompleteness = useMemo(() => {
    const fields = [
      { key: 'first_name', label: 'First Name', required: true },
      { key: 'last_name', label: 'Last Name', required: true },
      { key: 'date_of_birth', label: 'Date of Birth', required: true },
      { key: 'gender', label: 'Gender', required: true },
      { key: 'phone', label: 'Phone', required: true },
      { key: 'location', label: 'Location', required: false },
      { key: 'email', label: 'Email', required: false },
      { key: 'emergency_contact', label: 'Emergency Contact', required: false },
    ]

    return fields.map(field => {
      const filled = records.filter(r => {
        const value = r[field.key]
        return value !== null && value !== undefined && value !== '' && 
               (typeof value !== 'string' || value.trim() !== '')
      }).length

      return {
        ...field,
        filled,
        total: records.length,
        percentage: records.length > 0 ? Math.round((filled / records.length) * 100) : 0,
      }
    })
  }, [records])

  const issueBreakdown = useMemo(() => {
    const errors = summary.issues.filter(i => i.severity === 'error')
    const warnings = summary.issues.filter(i => i.severity === 'warning')
    const info = summary.issues.filter(i => i.severity === 'info')

    const byField: Record<string, number> = {}
    summary.issues.forEach(issue => {
      byField[issue.field] = (byField[issue.field] || 0) + 1
    })

    return {
      errors: errors.length,
      warnings: warnings.length,
      info: info.length,
      byField: Object.entries(byField)
        .map(([field, count]) => ({ field, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    }
  }, [summary])

  const getQualityColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getQualityBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-500">Excellent</Badge>
    if (score >= 70) return <Badge className="bg-yellow-500">Good</Badge>
    if (score >= 50) return <Badge className="bg-orange-500">Fair</Badge>
    return <Badge variant="destructive">Poor</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              <div className="flex-1">
                <p className={`text-2xl font-bold ${getQualityColor(summary.qualityScore)}`}>
                  {summary.qualityScore}%
                </p>
                <p className="text-sm text-muted-foreground">Quality Score</p>
                <div className="mt-1">{getQualityBadge(summary.qualityScore)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {summary.completenessScore}%
                </p>
                <p className="text-sm text-muted-foreground">Completeness</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {summary.validRecords}
                </p>
                <p className="text-sm text-muted-foreground">Valid Records</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {summary.recordsWithErrors}
                </p>
                <p className="text-sm text-muted-foreground">With Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quality Metrics */}
      <div className="grid grid-cols-2 gap-4">
        {/* Field Completeness */}
        <Card>
          <CardHeader>
            <CardTitle>Field Completeness</CardTitle>
            <CardDescription>Percentage of records with each field filled</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fieldCompleteness.map(field => (
              <div key={field.key} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{field.label}</span>
                    {field.required && (
                      <Badge variant="outline" className="text-xs">Required</Badge>
                    )}
                  </div>
                  <span className="text-muted-foreground">
                    {field.filled}/{field.total} ({field.percentage}%)
                  </span>
                </div>
                <Progress value={field.percentage} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Issue Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Issue Breakdown</CardTitle>
            <CardDescription>Validation issues by type and field</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="font-medium">Errors</span>
                </div>
                <Badge variant="destructive">{issueBreakdown.errors}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <span className="font-medium">Warnings</span>
                </div>
                <Badge className="bg-yellow-500">{issueBreakdown.warnings}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">Info</span>
                </div>
                <Badge variant="outline">{issueBreakdown.info}</Badge>
              </div>
            </div>

            {issueBreakdown.byField.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium mb-2">Top Issues by Field:</p>
                <div className="space-y-2">
                  {issueBreakdown.byField.map(({ field, count }) => (
                    <div key={field} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground capitalize">{field.replace('_', ' ')}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
          <CardDescription>Suggested actions to improve data quality</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recommendations.map((rec, index) => (
              <Alert key={index} className={index === 0 && recommendations.length > 1 ? 'border-blue-200 bg-blue-50' : ''}>
                <Info className="h-4 w-4" />
                <AlertDescription>{rec}</AlertDescription>
              </Alert>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Summary Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <p className="text-2xl font-bold">{summary.totalRecords}</p>
              <p className="text-sm text-muted-foreground">Total Records</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <p className="text-2xl font-bold text-green-600">{summary.validRecords}</p>
              <p className="text-sm text-muted-foreground">Valid</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{summary.recordsWithWarnings}</p>
              <p className="text-sm text-muted-foreground">With Warnings</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <p className="text-2xl font-bold text-red-600">{summary.recordsWithErrors}</p>
              <p className="text-sm text-muted-foreground">With Errors</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

