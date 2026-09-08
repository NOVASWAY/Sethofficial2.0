import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import jsPDF from "jspdf"

function formatCurrency(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function toNum(val: unknown): number {
  if (val == null) return 0
  if (typeof val === "number") return val
  if (typeof val === "string") return parseFloat(val) || 0
  if (typeof val === "object" && typeof (val as any).toNumber === "function") return (val as any).toNumber()
  return Number(val) || 0
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        patient: {
          select: {
            firstName: true, lastName: true, patientNumber: true,
            phone: true, email: true, insuranceType: true, insuranceNumber: true,
          },
        },
        createdBy: { select: { name: true } },
        invoiceItems: true,
        paymentAllocations: true,
      },
    })

    if (!invoice) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 })
    }

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFont("helvetica", "bold")
    doc.setFontSize(20)
    doc.text("Seth Medical Clinic", pageWidth / 2, 25, { align: "center" })

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.text("P.O. Box 12345, Nairobi, Kenya | Tel: +254 700 123 456", pageWidth / 2, 32, { align: "center" })
    doc.text("Email: info@sethmedical.co.ke | KRA PIN: A001234567P", pageWidth / 2, 37, { align: "center" })

    doc.setDrawColor(0)
    doc.setLineWidth(0.5)
    doc.line(20, 42, pageWidth - 20, 42)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.text("INVOICE", pageWidth / 2, 52, { align: "center" })

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, 20, 62)
    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString("en-KE")}`, 20, 68)
    doc.text(`Status: ${invoice.paymentStatus.toUpperCase()}`, 20, 74)

    doc.setFont("helvetica", "bold")
    doc.text("Bill To:", 120, 62)
    doc.setFont("helvetica", "normal")
    doc.text(`${invoice.patient?.firstName || ""} ${invoice.patient?.lastName || ""}`, 120, 68)
    doc.text(`Patient #: ${invoice.patient?.patientNumber || "N/A"}`, 120, 74)
    if (invoice.patient?.insuranceType) {
      doc.text(`Insurance: ${invoice.patient.insuranceType.toUpperCase()}`, 120, 80)
    }

    let yPos = 100
    doc.setFillColor(240, 240, 240)
    doc.rect(20, yPos - 5, pageWidth - 40, 8, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.text("Item", 22, yPos)
    doc.text("Qty", 120, yPos)
    doc.text("Unit Price", 140, yPos)
    doc.text("Amount", 170, yPos, { align: "right" })
    doc.line(20, yPos + 3, pageWidth - 20, yPos + 3)
    yPos += 10

    doc.setFont("helvetica", "normal")
    const items = (invoice.invoiceItems || []) as any[]
    for (const item of items) {
      if (yPos > 250) { doc.addPage(); yPos = 25 }
      doc.text((item.description || "Service").substring(0, 40), 22, yPos)
      doc.text(String(item.quantity || 1), 120, yPos)
      doc.text(formatCurrency(toNum(item.unitPrice)), 140, yPos)
      doc.text(formatCurrency(toNum(item.totalPrice)), 170, yPos, { align: "right" })
      yPos += 7
    }

    if (items.length === 0) { doc.text("No items", 22, yPos); yPos += 7 }

    yPos += 3
    doc.line(120, yPos, pageWidth - 20, yPos)
    yPos += 7

    const totalAmount = toNum(invoice.totalAmount)
    const subtotal = toNum(invoice.subtotal)
    const taxAmount = toNum(invoice.taxAmount)
    const totalPaid = (invoice.paymentAllocations || []).reduce(
      (sum: number, pa: any) => sum + toNum(pa.amount), 0
    )

    doc.setFont("helvetica", "normal")
    doc.text("Subtotal:", 140, yPos)
    doc.text(formatCurrency(subtotal), 170, yPos, { align: "right" })
    yPos += 7

    doc.text("Tax:", 140, yPos)
    doc.text(formatCurrency(taxAmount), 170, yPos, { align: "right" })
    yPos += 7

    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.text("Total:", 140, yPos)
    doc.text(formatCurrency(totalAmount), 170, yPos, { align: "right" })
    yPos += 7

    if (totalPaid > 0) {
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.text("Amount Paid:", 140, yPos)
      doc.text(formatCurrency(totalPaid), 170, yPos, { align: "right" })
      yPos += 7
      doc.setFont("helvetica", "bold")
      doc.text("Balance Due:", 140, yPos)
      doc.text(formatCurrency(totalAmount - totalPaid), 170, yPos, { align: "right" })
    }

    const footerY = doc.internal.pageSize.getHeight() - 15
    doc.setFontSize(8)
    doc.setFont("helvetica", "italic")
    doc.text("Thank you for choosing Seth Medical Clinic", pageWidth / 2, footerY, { align: "center" })
    doc.text("This is a computer-generated invoice", pageWidth / 2, footerY + 5, { align: "center" })

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"))
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      },
    })
  } catch (error) {
    console.error("[Invoice PDF Error]", error)
    return NextResponse.json({ success: false, error: "Failed to generate PDF" }, { status: 500 })
  }
}
