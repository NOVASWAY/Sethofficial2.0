"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { Download, FileText, Table, FileSpreadsheet, Loader2 } from "lucide-react"

interface DataExportProps {
  data: any[]
  filename?: string
  title?: string
  className?: string
  disabled?: boolean
}

export function DataExport({ 
  data, 
  filename = "export", 
  title = "Export Data",
  className,
  disabled = false 
}: DataExportProps) {
  const { toast } = useToast()
  const [isExporting, setIsExporting] = React.useState(false)

  const exportToCSV = async () => {
    if (!data || data.length === 0) {
      toast({
        title: "No Data",
        description: "There is no data to export.",
        variant: "error",
      })
      return
    }

    setIsExporting(true)
    
    try {
      // Get headers from the first object
      const headers = Object.keys(data[0])
      
      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header]
            // Handle values that might contain commas or quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`
            }
            return value || ''
          }).join(',')
        )
      ].join('\n')

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `${filename}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Export Successful",
        description: "Data has been exported to CSV successfully.",
      })
    } catch (error) {
      console.error('CSV export error:', error)
      toast({
        title: "Export Failed",
        description: "Failed to export data to CSV.",
        variant: "error",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const exportToJSON = async () => {
    if (!data || data.length === 0) {
      toast({
        title: "No Data",
        description: "There is no data to export.",
        variant: "error",
      })
      return
    }

    setIsExporting(true)
    
    try {
      const jsonContent = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonContent], { type: 'application/json' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `${filename}.json`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Export Successful",
        description: "Data has been exported to JSON successfully.",
      })
    } catch (error) {
      console.error('JSON export error:', error)
      toast({
        title: "Export Failed",
        description: "Failed to export data to JSON.",
        variant: "error",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const exportToPDF = async () => {
    if (!data || data.length === 0) {
      toast({
        title: "No Data",
        description: "There is no data to export.",
        variant: "error",
      })
      return
    }

    setIsExporting(true)
    
    try {
      // Simple PDF generation using browser's print functionality
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        throw new Error('Could not open print window')
      }

      const headers = Object.keys(data[0])
      const tableRows = data.map(row => 
        headers.map(header => `<td>${row[header] || ''}</td>`).join('')
      ).map(row => `<tr>${row}</tr>`).join('')

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .export-info { margin-bottom: 20px; text-align: center; color: #666; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="export-info">
            Exported on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}<br>
            Total Records: ${data.length}
          </div>
          <table>
            <thead>
              <tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
        </html>
      `

      printWindow.document.write(htmlContent)
      printWindow.document.close()
      printWindow.print()

      toast({
        title: "PDF Export",
        description: "PDF export dialog opened. Please use your browser's print function to save as PDF.",
      })
    } catch (error) {
      console.error('PDF export error:', error)
      toast({
        title: "Export Failed",
        description: "Failed to export data to PDF.",
        variant: "error",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const exportToExcel = async () => {
    if (!data || data.length === 0) {
      toast({
        title: "No Data",
        description: "There is no data to export.",
        variant: "error",
      })
      return
    }

    setIsExporting(true)
    
    try {
      // Create Excel-like CSV with proper formatting
      const headers = Object.keys(data[0])
      
      // Add BOM for Excel compatibility
      const csvContent = '\uFEFF' + [
        headers.join('\t'),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header]
            // Convert to string and handle special characters
            return String(value || '').replace(/\t/g, ' ').replace(/\n/g, ' ')
          }).join('\t')
        )
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/tab-separated-values;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `${filename}.xls`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Export Successful",
        description: "Data has been exported to Excel format successfully.",
      })
    } catch (error) {
      console.error('Excel export error:', error)
      toast({
        title: "Export Failed",
        description: "Failed to export data to Excel format.",
        variant: "error",
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={className}
          disabled={disabled || isExporting}
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {isExporting ? "Exporting..." : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={exportToCSV} disabled={isExporting}>
          <FileText className="mr-2 h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToExcel} disabled={isExporting}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToJSON} disabled={isExporting}>
          <Table className="mr-2 h-4 w-4" />
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF} disabled={isExporting}>
          <FileText className="mr-2 h-4 w-4" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Utility function to format data for export
export function formatDataForExport(data: any[], columns?: string[]) {
  if (!data || data.length === 0) return []
  
  if (columns) {
    return data.map(row => {
      const formattedRow: any = {}
      columns.forEach(column => {
        formattedRow[column] = row[column] || ''
      })
      return formattedRow
    })
  }
  
  return data
}

// Utility function to generate export filename with timestamp
export function generateExportFilename(baseName: string, extension: string = 'csv') {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  return `${baseName}_${timestamp}.${extension}`
}
