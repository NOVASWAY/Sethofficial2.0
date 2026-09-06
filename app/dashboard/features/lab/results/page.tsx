'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LabResultViewer } from '@/components/lab-result-viewer'
import { labAPI } from '@/lib/api-client'
import { LabTestResult } from '@/lib/api-client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, RefreshCw } from 'lucide-react'

export default function LabResultsPage() {
  const params = useParams()
  const role = params.role as string
  const [results, setResults] = useState<LabTestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedResult, setSelectedResult] = useState<LabTestResult | null>(null)

  useEffect(() => {
    loadResults()
  }, [])

  const loadResults = async () => {
    try {
      setLoading(true)
      const data = await labAPI.getResults({})
      setResults(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load lab results:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const filteredResults = results.filter(result => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      result.patient_name?.toLowerCase().includes(search) ||
      result.test_type?.toLowerCase().includes(search) ||
      result.order_id?.toLowerCase().includes(search)
    )
  })

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lab Results</h1>
          <p className="text-muted-foreground">
            View and manage all lab test results
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lab Test Results</CardTitle>
                <CardDescription>
                  {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} found
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search results..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-64"
                  />
                </div>
                <Button variant="outline" size="icon" onClick={loadResults}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading results...
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No lab results found
              </div>
            ) : (
              <div className="space-y-4">
                {filteredResults.map((result) => (
                  <Card
                    key={result.id}
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => setSelectedResult(result)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{result.patient_name || 'Unknown Patient'}</h3>
                          <p className="text-sm text-muted-foreground">
                            {result.test_type} • {result.order_id}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {new Date(result.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {result.status}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedResult && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Result Details</CardTitle>
                <Button variant="outline" onClick={() => setSelectedResult(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <LabResultViewer
                resultId={selectedResult.id}
                showActions={true}
                onBack={() => setSelectedResult(null)}
              />
            </CardContent>
          </Card>
        )}
      </div>
  )
}

