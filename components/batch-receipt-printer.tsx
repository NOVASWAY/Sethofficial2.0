"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Printer, FileText, Download, X } from 'lucide-react'
import { Invoice } from '@/contexts/invoice-context'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface BatchReceiptPrinterProps {
  invoices: Invoice[]
  onClose?: () => void
}

export function BatchReceiptPrinter({ invoices, onClose }: BatchReceiptPrinterProps) {
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set(invoices.map(inv => inv.id)))
  const [isPrinting, setIsPrinting] = useState(false)
  const { toast } = useToast()

  const toggleInvoice = (invoiceId: string) => {
    const newSelected = new Set(selectedInvoices)
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId)
    } else {
      newSelected.add(invoiceId)
    }
    setSelectedInvoices(newSelected)
  }

  const selectAll = () => {
    setSelectedInvoices(new Set(invoices.map(inv => inv.id)))
  }

  const deselectAll = () => {
    setSelectedInvoices(new Set())
  }

  const printBatch = async () => {
    if (selectedInvoices.size === 0) {
      toast({
        title: "No Invoices Selected",
        description: "Please select at least one invoice to print",
        variant: "destructive",
      })
      return
    }

    setIsPrinting(true)
    try {
      const invoicesToPrint = invoices.filter(inv => selectedInvoices.has(inv.id))
      
      // Create print window
      const printWindow = window.open('', '_blank', 'width=800,height=600')
      
      if (!printWindow) {
        toast({
          title: "Print Failed",
          description: "Please allow popups to print receipts",
          variant: "destructive",
        })
        setIsPrinting(false)
        return
      }

      // Generate HTML for all receipts
      const receiptsHTML = invoicesToPrint.map((invoice, index) => generateReceiptHTML(invoice, index)).join('<div style="page-break-after: always;"></div>')

      const printContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Batch Receipts - Seth Medical Clinic</title>
    <style>
        ${getReceiptStyles()}
    </style>
</head>
<body>
    ${receiptsHTML}
    <script>
        window.onload = function() {
            window.print();
            window.onafterprint = function() {
                window.close();
            };
        };
    </script>
</body>
</html>`

      printWindow.document.write(printContent)
      printWindow.document.close()

      toast({
        title: "Printing Started",
        description: `Printing ${selectedInvoices.size} receipt(s)`,
      })
    } catch (error) {
      console.error('Batch print error:', error)
      toast({
        title: "Print Failed",
        description: "An error occurred while printing. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsPrinting(false)
    }
  }

  const printThermalBatch = async () => {
    if (selectedInvoices.size === 0) {
      toast({
        title: "No Invoices Selected",
        description: "Please select at least one invoice to print",
        variant: "destructive",
      })
      return
    }

    setIsPrinting(true)
    try {
      const invoicesToPrint = invoices.filter(inv => selectedInvoices.has(inv.id))
      
      // Create print window optimized for thermal printers (80mm width)
      const printWindow = window.open('', '_blank', 'width=300,height=600')
      
      if (!printWindow) {
        toast({
          title: "Print Failed",
          description: "Please allow popups to print receipts",
          variant: "destructive",
        })
        setIsPrinting(false)
        return
      }

      // Generate thermal printer optimized HTML
      const receiptsHTML = invoicesToPrint.map((invoice, index) => generateThermalReceiptHTML(invoice, index)).join('<div style="page-break-after: always; margin-bottom: 20px;"></div>')

      const printContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thermal Receipts - Seth Medical Clinic</title>
    <style>
        ${getThermalReceiptStyles()}
    </style>
</head>
<body>
    ${receiptsHTML}
    <script>
        window.onload = function() {
            window.print();
            window.onafterprint = function() {
                window.close();
            };
        };
    </script>
</body>
</html>`

      printWindow.document.write(printContent)
      printWindow.document.close()

      toast({
        title: "Printing Started",
        description: `Printing ${selectedInvoices.size} thermal receipt(s)`,
      })
    } catch (error) {
      console.error('Thermal batch print error:', error)
      toast({
        title: "Print Failed",
        description: "An error occurred while printing. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsPrinting(false)
    }
  }

  const totalAmount = invoices
    .filter(inv => selectedInvoices.has(inv.id))
    .reduce((sum, inv) => sum + inv.total, 0)

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Batch Receipt Printing
          </DialogTitle>
          <DialogDescription>
            Select invoices to print receipts. You can print all selected receipts at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selection Controls */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All ({invoices.length})
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Deselect All
              </Button>
              <Badge variant="secondary">
                {selectedInvoices.size} of {invoices.length} selected
              </Badge>
            </div>
            <div className="text-sm font-semibold text-gray-700">
              Total: KSh {totalAmount.toLocaleString()}
            </div>
          </div>

          {/* Invoice List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {invoices.map((invoice) => (
              <Card key={invoice.id} className="p-4">
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={selectedInvoices.has(invoice.id)}
                    onCheckedChange={() => toggleInvoice(invoice.id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{invoice.patientName}</p>
                        <p className="text-sm text-gray-600">
                          {invoice.invoiceNumber} • {new Date(invoice.date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">KSh {invoice.total.toLocaleString()}</p>
                        <Badge
                          variant={
                            invoice.paymentStatus === 'paid' ? 'default' :
                            invoice.paymentStatus === 'pending' ? 'secondary' : 'destructive'
                          }
                        >
                          {invoice.paymentStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Print Actions */}
          <div className="flex items-center gap-4 pt-4 border-t">
            <Button
              onClick={printBatch}
              disabled={selectedInvoices.size === 0 || isPrinting}
              className="flex-1"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print {selectedInvoices.size} Receipt(s) (Standard)
            </Button>
            <Button
              onClick={printThermalBatch}
              disabled={selectedInvoices.size === 0 || isPrinting}
              variant="outline"
              className="flex-1"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print {selectedInvoices.size} Receipt(s) (Thermal)
            </Button>
            {onClose && (
              <Button variant="ghost" onClick={onClose}>
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function generateReceiptHTML(invoice: Invoice, index: number): string {
  return `
    <div class="receipt-container">
        <div class="receipt-header">
            <h1>SETH MEDICAL CLINIC</h1>
            <p>Professional Healthcare Services</p>
            <p>P.O. Box 12345, Nairobi, Kenya</p>
            <p>Tel: +254 712 345 678 | Email: info@sethmedical.co.ke</p>
        </div>
        
        <div class="receipt-info">
            <div class="info-section">
                <h3>PATIENT INFORMATION</h3>
                <p><strong>Name:</strong> ${invoice.patientName}</p>
                <p><strong>Patient ID:</strong> ${invoice.patientId}</p>
                ${invoice.patientNumber ? `<p><strong>Patient Number:</strong> ${invoice.patientNumber}</p>` : ''}
            </div>
            
            <div class="info-section">
                <h3>RECEIPT DETAILS</h3>
                <p><strong>Receipt #:</strong> ${invoice.invoiceNumber}</p>
                <p><strong>Date:</strong> ${new Date(invoice.date).toLocaleDateString('en-GB')}</p>
                <p><strong>Status:</strong> <span class="status-badge status-${invoice.paymentStatus}">${invoice.paymentStatus.toUpperCase()}</span></p>
            </div>
        </div>
        
        <div class="services-section">
            <h3>SERVICES & ITEMS</h3>
            <table class="services-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.items.map(item => `
                        <tr>
                            <td>${item.description}</td>
                            <td>${item.quantity}</td>
                            <td>KSh ${item.unitPrice.toLocaleString()}</td>
                            <td>KSh ${item.totalPrice.toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="totals-section">
            <div class="totals-row">
                <span>Subtotal:</span>
                <span>KSh ${invoice.subtotal.toLocaleString()}</span>
            </div>
            <div class="totals-row">
                <span>Tax (16%):</span>
                <span>KSh ${invoice.tax.toLocaleString()}</span>
            </div>
            ${invoice.discount > 0 ? `
            <div class="totals-row">
                <span>Discount:</span>
                <span>KSh ${invoice.discount.toLocaleString()}</span>
            </div>
            ` : ''}
            <div class="totals-row total-amount">
                <span>TOTAL:</span>
                <span>KSh ${invoice.total.toLocaleString()}</span>
            </div>
        </div>
        
        ${invoice.paymentMethod && invoice.paymentMethod !== 'pending' ? `
        <div class="payment-info">
            <h3>PAYMENT INFORMATION</h3>
            <p><strong>Payment Method:</strong> ${invoice.paymentMethod.toUpperCase()}</p>
            ${invoice.mpesaTransactionCode ? `<p><strong>M-Pesa Code:</strong> ${invoice.mpesaTransactionCode}</p>` : ''}
            ${invoice.shaClaimNumber ? `<p><strong>SHA Claim:</strong> ${invoice.shaClaimNumber}</p>` : ''}
            <p><strong>Amount Paid:</strong> KSh ${invoice.amountPaid.toLocaleString()}</p>
            ${invoice.balance > 0 ? `<p><strong>Balance:</strong> KSh ${invoice.balance.toLocaleString()}</p>` : ''}
        </div>
        ` : ''}
        
        <div class="receipt-footer">
            <p><strong>Thank you for choosing Seth Medical Clinic!</strong></p>
            <p>For queries: +254 712 345 678</p>
            <p>Generated: ${new Date().toLocaleString('en-GB')}</p>
        </div>
    </div>
  `
}

function generateThermalReceiptHTML(invoice: Invoice, index: number): string {
  return `
    <div class="thermal-receipt">
        <div class="thermal-header">
            <h1>SETH MEDICAL CLINIC</h1>
            <p>Professional Healthcare Services</p>
            <p>P.O. Box 12345, Nairobi, Kenya</p>
            <p>Tel: +254 712 345 678</p>
        </div>
        
        <div class="thermal-divider"></div>
        
        <div class="thermal-info">
            <p><strong>Receipt:</strong> ${invoice.invoiceNumber}</p>
            <p><strong>Date:</strong> ${new Date(invoice.date).toLocaleDateString('en-GB')}</p>
            <p><strong>Patient:</strong> ${invoice.patientName}</p>
            ${invoice.patientNumber ? `<p><strong>Patient #:</strong> ${invoice.patientNumber}</p>` : ''}
        </div>
        
        <div class="thermal-divider"></div>
        
        <div class="thermal-items">
            ${invoice.items.map(item => `
                <div class="thermal-item">
                    <div class="item-desc">${item.description}</div>
                    <div class="item-details">
                        <span>${item.quantity} x KSh ${item.unitPrice.toLocaleString()}</span>
                        <span class="item-total">KSh ${item.totalPrice.toLocaleString()}</span>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="thermal-divider"></div>
        
        <div class="thermal-totals">
            <div class="thermal-total-row">
                <span>Subtotal:</span>
                <span>KSh ${invoice.subtotal.toLocaleString()}</span>
            </div>
            <div class="thermal-total-row">
                <span>Tax (16%):</span>
                <span>KSh ${invoice.tax.toLocaleString()}</span>
            </div>
            ${invoice.discount > 0 ? `
            <div class="thermal-total-row">
                <span>Discount:</span>
                <span>KSh ${invoice.discount.toLocaleString()}</span>
            </div>
            ` : ''}
            <div class="thermal-total-row thermal-total">
                <span>TOTAL:</span>
                <span>KSh ${invoice.total.toLocaleString()}</span>
            </div>
        </div>
        
        ${invoice.paymentMethod && invoice.paymentMethod !== 'pending' ? `
        <div class="thermal-divider"></div>
        <div class="thermal-payment">
            <p><strong>Payment:</strong> ${invoice.paymentMethod.toUpperCase()}</p>
            ${invoice.mpesaTransactionCode ? `<p><strong>M-Pesa:</strong> ${invoice.mpesaTransactionCode}</p>` : ''}
            <p><strong>Paid:</strong> KSh ${invoice.amountPaid.toLocaleString()}</p>
        </div>
        ` : ''}
        
        <div class="thermal-divider"></div>
        
        <div class="thermal-footer">
            <p>Thank you for choosing</p>
            <p>Seth Medical Clinic!</p>
            <p>${new Date().toLocaleString('en-GB')}</p>
        </div>
    </div>
  `
}

function getReceiptStyles(): string {
  return `
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }
    
    body {
        font-family: 'Arial', sans-serif;
        line-height: 1.6;
        color: #333;
        background: white;
        padding: 20px;
    }
    
    .receipt-container {
        max-width: 800px;
        margin: 0 auto 40px;
        background: white;
        border: 1px solid #ddd;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    
    .receipt-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 30px;
        text-align: center;
    }
    
    .receipt-header h1 {
        font-size: 28px;
        font-weight: bold;
        margin-bottom: 10px;
    }
    
    .receipt-info {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 30px;
        padding: 30px;
        background: #f8f9fa;
    }
    
    .info-section {
        background: white;
        padding: 20px;
        border-radius: 8px;
    }
    
    .info-section h3 {
        color: #667eea;
        font-size: 16px;
        margin-bottom: 15px;
        border-bottom: 2px solid #667eea;
        padding-bottom: 5px;
    }
    
    .services-section {
        padding: 30px;
    }
    
    .services-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
    }
    
    .services-table th {
        background: #667eea;
        color: white;
        padding: 15px;
        text-align: left;
    }
    
    .services-table td {
        padding: 15px;
        border-bottom: 1px solid #e9ecef;
    }
    
    .totals-section {
        background: #f8f9fa;
        padding: 20px 30px;
        border-top: 2px solid #667eea;
    }
    
    .totals-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
    }
    
    .total-amount {
        font-size: 20px;
        font-weight: bold;
        color: #667eea;
        border-top: 2px solid #667eea;
        padding-top: 10px;
        margin-top: 10px;
    }
    
    .payment-info {
        padding: 20px 30px;
        background: #e8f5e8;
        border-left: 4px solid #28a745;
    }
    
    .receipt-footer {
        padding: 20px 30px;
        text-align: center;
        background: #f8f9fa;
        border-top: 1px solid #e9ecef;
    }
    
    .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
    }
    
    .status-paid {
        background: #d4edda;
        color: #155724;
    }
    
    .status-pending {
        background: #fff3cd;
        color: #856404;
    }
    
    @media print {
        body {
            padding: 0;
        }
        .receipt-container {
            box-shadow: none;
            border: none;
            margin-bottom: 20px;
        }
    }
  `
}

function getThermalReceiptStyles(): string {
  return `
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }
    
    body {
        font-family: 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.4;
        color: #000;
        background: white;
        padding: 10px;
        width: 80mm;
        margin: 0 auto;
    }
    
    .thermal-receipt {
        width: 100%;
        max-width: 80mm;
        margin: 0 auto 20px;
        background: white;
    }
    
    .thermal-header {
        text-align: center;
        padding: 10px 0;
        border-bottom: 1px dashed #000;
    }
    
    .thermal-header h1 {
        font-size: 16px;
        font-weight: bold;
        margin-bottom: 5px;
        text-transform: uppercase;
    }
    
    .thermal-header p {
        font-size: 10px;
        margin: 2px 0;
    }
    
    .thermal-divider {
        border-top: 1px dashed #000;
        margin: 10px 0;
    }
    
    .thermal-info {
        padding: 5px 0;
    }
    
    .thermal-info p {
        margin: 3px 0;
        font-size: 11px;
    }
    
    .thermal-items {
        padding: 5px 0;
    }
    
    .thermal-item {
        margin-bottom: 8px;
    }
    
    .item-desc {
        font-weight: bold;
        margin-bottom: 3px;
    }
    
    .item-details {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
    }
    
    .item-total {
        font-weight: bold;
    }
    
    .thermal-totals {
        padding: 5px 0;
    }
    
    .thermal-total-row {
        display: flex;
        justify-content: space-between;
        margin: 5px 0;
        font-size: 11px;
    }
    
    .thermal-total {
        font-weight: bold;
        font-size: 14px;
        border-top: 1px solid #000;
        padding-top: 5px;
        margin-top: 5px;
    }
    
    .thermal-payment {
        padding: 5px 0;
        font-size: 11px;
    }
    
    .thermal-payment p {
        margin: 3px 0;
    }
    
    .thermal-footer {
        text-align: center;
        padding: 10px 0;
        border-top: 1px dashed #000;
        font-size: 10px;
    }
    
    @media print {
        body {
            padding: 0;
            width: 80mm;
        }
        .thermal-receipt {
            page-break-after: always;
        }
        @page {
            size: 80mm auto;
            margin: 0;
        }
    }
  `
}

