"use client"

import React from 'react'
import { Invoice } from '@/contexts/invoice-context'

interface PrintableInvoiceProps {
  invoice: Invoice
  onClose?: () => void
}

export function PrintableInvoice({ invoice, onClose }: PrintableInvoiceProps) {
  const openDoc = (title: string, bodyHtml: string, pageCss = "") => {
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
      alert('Please allow popups to print')
      return null
    }
    printWindow.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title>
<style>${pageCss}</style></head><body>${bodyHtml}
<script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };</script>
</body></html>`)
    printWindow.document.close()
    return printWindow
  }

  const buildReceiptHtml = () => {
    const inv = invoice as any
    const items = (invoice.items || []).map((it: any) => `
      <div class="r-row"><span>${it.description || it.name} x${it.quantity || 1}</span><span>${Number(it.totalPrice ?? it.total ?? 0).toFixed(2)}</span></div>`).join("")
    return `<div class="receipt">
      <div class="r-center"><strong>SETH MEDICAL CLINIC</strong><br/>Internal Receipt — non-fiscal<br/>Fiscal receipt issued separately by KRA machine</div>
      <div class="r-sep"></div>
      <div class="r-row"><span>Receipt:</span><span>${invoice.id}</span></div>
      <div class="r-row"><span>Date:</span><span>${new Date().toLocaleString('en-GB')}</span></div>
      <div class="r-row"><span>Patient:</span><span>${invoice.patientName || ''}</span></div>
      <div class="r-row"><span>Method:</span><span>${inv.paymentDetails?.method || invoice.paymentMethod || 'Cash'}</span></div>
      ${inv.paymentDetails?.transactionId ? `<div class="r-row"><span>Ref:</span><span>${inv.paymentDetails.transactionId}</span></div>` : ''}
      <div class="r-sep"></div>
      ${items}
      <div class="r-sep"></div>
      <div class="r-row r-total"><span>TOTAL KES</span><span>${Number(invoice.total || 0).toFixed(2)}</span></div>
      <div class="r-sep"></div>
      <div class="r-center">Thank you — get well soon</div>
    </div>`
  }

  const receiptCss = `@page{size:80mm auto;margin:4mm}*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:11px;color:#000;background:#fff}
.receipt{width:72mm;margin:0 auto}.r-center{text-align:center}.r-sep{border-top:1px dashed #000;margin:6px 0}
.r-row{display:flex;justify-content:space-between;gap:8px;margin:2px 0}.r-total{font-size:14px;font-weight:bold}`

  const handlePrintReceipt = () => {
    openDoc(`Receipt ${invoice.id}`, buildReceiptHtml(), receiptCss)
  }

  const handleDownload = () => {
    const blob = new Blob([buildReceiptHtml()], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `receipt-${invoice.id}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleShare = async () => {
    const inv = invoice as any
    const text = `Seth Medical Clinic receipt ${invoice.id} — KES ${Number(invoice.total || 0).toFixed(2)} (${inv.paymentDetails?.method || invoice.paymentMethod || 'Cash'})`
    if ((navigator as any).share) {
      try { await (navigator as any).share({ title: `Receipt ${invoice.id}`, text }) } catch { /* dismissed */ }
    } else {
      handleDownload()
    }
  }

  const handlePrint = () => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    
    if (!printWindow) {
      alert('Please allow popups to print the invoice')
      return
    }

    const printContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${invoice.id} - Seth Medical Clinic</title>
    <style>
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
        
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border: 1px solid #ddd;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .header p {
            font-size: 14px;
            opacity: 0.9;
        }
        
        .invoice-info {
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
            border: 1px solid #e9ecef;
        }
        
        .info-section h3 {
            color: #667eea;
            font-size: 16px;
            margin-bottom: 15px;
            border-bottom: 2px solid #667eea;
            padding-bottom: 5px;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            padding: 5px 0;
        }
        
        .info-label {
            font-weight: 600;
            color: #555;
        }
        
        .info-value {
            color: #333;
        }
        
        .services-section {
            padding: 30px;
        }
        
        .services-section h3 {
            color: #667eea;
            font-size: 18px;
            margin-bottom: 20px;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
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
            font-weight: 600;
        }
        
        .services-table td {
            padding: 15px;
            border-bottom: 1px solid #e9ecef;
        }
        
        .services-table tr:nth-child(even) {
            background: #f8f9fa;
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
            padding: 8px 0;
        }
        
        .totals-label {
            font-weight: 600;
            color: #555;
        }
        
        .totals-value {
            color: #333;
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
        
        .payment-info h3 {
            color: #28a745;
            margin-bottom: 15px;
        }
        
        .footer {
            padding: 20px 30px;
            text-align: center;
            background: #f8f9fa;
            border-top: 1px solid #e9ecef;
            color: #666;
            font-size: 14px;
        }
        
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .status-paid {
            background: #d4edda;
            color: #155724;
        }
        
        .status-pending {
            background: #fff3cd;
            color: #856404;
        }
        
        .status-overdue {
            background: #f8d7da;
            color: #721c24;
        }
        
        @media print {
            body {
                padding: 0;
            }
            
            .invoice-container {
                box-shadow: none;
                border: none;
            }
            
            .no-print {
                display: none !important;
            }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <!-- Header -->
        <div class="header">
            <h1>SETH MEDICAL CLINIC</h1>
            <p>Professional Healthcare Services</p>
            <p>P.O. Box 12345, Nairobi, Kenya | Tel: +254 712 345 678</p>
            <p>Email: info@sethmedical.co.ke | Website: www.sethmedical.co.ke</p>
        </div>
        
        <!-- Invoice Information -->
        <div class="invoice-info">
            <div class="info-section">
                <h3>BILL TO</h3>
                <div class="info-row">
                    <span class="info-label">Patient Name:</span>
                    <span class="info-value">${invoice.patientName}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Patient ID:</span>
                    <span class="info-value">${invoice.patientId}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Patient Number:</span>
                    <span class="info-value">${invoice.patientNumber || 'N/A'}</span>
                </div>
            </div>
            
            <div class="info-section">
                <h3>INVOICE DETAILS</h3>
                <div class="info-row">
                    <span class="info-label">Invoice #:</span>
                    <span class="info-value">${invoice.id}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Date:</span>
                    <span class="info-value">${new Date(invoice.date).toLocaleDateString('en-GB')}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Due Date:</span>
                    <span class="info-value">${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-GB') : 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Type:</span>
                    <span class="info-value">${invoice.invoiceType}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Status:</span>
                    <span class="info-value">
                        <span class="status-badge status-${invoice.paymentStatus.toLowerCase()}">${invoice.paymentStatus}</span>
                    </span>
                </div>
            </div>
        </div>
        
        <!-- Services -->
        <div class="services-section">
            <h3>SERVICES & ITEMS</h3>
            <table class="services-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Quantity</th>
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
        
        <!-- Totals -->
        <div class="totals-section">
            <div class="totals-row">
                <span class="totals-label">Subtotal:</span>
                <span class="totals-value">KSh ${invoice.subtotal.toLocaleString()}</span>
            </div>
            <div class="totals-row">
                <span class="totals-label">Tax (16%):</span>
                <span class="totals-value">KSh ${invoice.tax.toLocaleString()}</span>
            </div>
            <div class="totals-row">
                <span class="totals-label">Discount:</span>
                <span class="totals-value">KSh ${(invoice.discount || 0).toLocaleString()}</span>
            </div>
            <div class="totals-row total-amount">
                <span class="totals-label">TOTAL AMOUNT:</span>
                <span class="totals-value">KSh ${invoice.total.toLocaleString()}</span>
            </div>
        </div>
        
        <!-- Payment Information -->
        ${invoice.paymentMethod ? `
        <div class="payment-info">
            <h3>PAYMENT INFORMATION</h3>
            <div class="info-row">
                <span class="info-label">Payment Method:</span>
                <span class="info-value">${invoice.paymentMethod}</span>
            </div>
            ${invoice.mpesaTransactionCode ? `
            <div class="info-row">
                <span class="info-label">Transaction Code:</span>
                <span class="info-value">${invoice.mpesaTransactionCode}</span>
            </div>
            ` : ''}
            ${invoice.shaClaimNumber ? `
            <div class="info-row">
                <span class="info-label">SHA Claim Number:</span>
                <span class="info-value">${invoice.shaClaimNumber}</span>
            </div>
            ` : ''}
        </div>
        ` : ''}
        
        <!-- Notes -->
        ${invoice.notes ? `
        <div class="services-section">
            <h3>NOTES</h3>
            <p>${invoice.notes}</p>
        </div>
        ` : ''}
        
        <!-- Footer -->
        <div class="footer">
            <p><strong>Thank you for choosing Seth Medical Clinic!</strong></p>
            <p>For any queries regarding this invoice, please contact us at +254 712 345 678</p>
            <p>This invoice was generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}</p>
        </div>
    </div>
    
    <script>
        // Auto-print when window loads
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
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Invoice Preview</h2>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handlePrint}
                className="bg-blue-600 text-white px-4 py-2 min-h-[44px] rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Invoice
              </button>
              <button
                onClick={handlePrintReceipt}
                className="bg-green-600 text-white px-4 py-2 min-h-[44px] rounded-lg hover:bg-green-700"
              >
                Receipt (80mm)
              </button>
              <button
                onClick={handleDownload}
                className="bg-gray-700 text-white px-4 py-2 min-h-[44px] rounded-lg hover:bg-gray-800"
              >
                Download
              </button>
              <button
                onClick={handleShare}
                className="bg-purple-600 text-white px-4 py-2 min-h-[44px] rounded-lg hover:bg-purple-700"
              >
                Share
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                >
                  Close
                </button>
              )}
            </div>
          </div>
          
          {/* Preview of the invoice */}
          <div className="border border-gray-200 rounded-lg p-6 bg-white">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-blue-600 mb-2">SETH MEDICAL CLINIC</h1>
              <p className="text-gray-600">Professional Healthcare Services</p>
              <p className="text-sm text-gray-500">P.O. Box 12345, Nairobi, Kenya | Tel: +254 712 345 678</p>
            </div>
            
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 p-4 rounded">
                <h3 className="font-semibold text-blue-600 mb-3">BILL TO</h3>
                <p><strong>{invoice.patientName}</strong></p>
                <p>Patient ID: {invoice.patientId}</p>
                <p>Patient Number: {invoice.patientNumber || 'N/A'}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <h3 className="font-semibold text-blue-600 mb-3">INVOICE DETAILS</h3>
                <p><strong>Invoice #:</strong> {invoice.id}</p>
                <p><strong>Date:</strong> {new Date(invoice.date).toLocaleDateString()}</p>
                <p><strong>Type:</strong> {invoice.invoiceType}</p>
                <p><strong>Status:</strong> 
                  <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                    invoice.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                    invoice.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {invoice.paymentStatus}
                  </span>
                </p>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="font-semibold text-blue-600 mb-3">SERVICES & ITEMS</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-blue-600 text-white">
                      <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Quantity</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Unit Price</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="border border-gray-300 px-4 py-2">{item.description}</td>
                        <td className="border border-gray-300 px-4 py-2">{item.quantity}</td>
                        <td className="border border-gray-300 px-4 py-2">KSh {item.unitPrice.toLocaleString()}</td>
                        <td className="border border-gray-300 px-4 py-2">KSh {item.totalPrice.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded">
              <div className="flex justify-between mb-2">
                <span>Subtotal:</span>
                <span>KSh {invoice.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Tax (16%):</span>
                <span>KSh {invoice.tax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Discount:</span>
                <span>KSh {(invoice.discount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-blue-600 border-t pt-2">
                <span>TOTAL AMOUNT:</span>
                <span>KSh {invoice.total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
