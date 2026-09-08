import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function toCSV(rows: Record<string, unknown>[], headers: string[]): string {
  const headerRow = headers.join(",")
  const dataRows = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h]
        const str = val == null ? "" : String(val)
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str
      })
      .join(",")
  )
  return [headerRow, ...dataRows].join("\n")
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type") || "patients"
    const startDate = searchParams.get("start")
    const endDate = searchParams.get("end")

    const dateFilter: Record<string, unknown> = {}
    if (startDate) dateFilter.gte = new Date(startDate)
    if (endDate) dateFilter.lte = new Date(endDate)
    const hasDateFilter = Object.keys(dateFilter).length > 0

    let csv = ""
    let filename = ""

    switch (type) {
      case "patients": {
        const where = hasDateFilter ? { createdAt: dateFilter } : {}
        const patients = await prisma.patient.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 5000,
        })
        csv = toCSV(
          patients.map((p) => ({
            patient_number: p.patientNumber,
            first_name: p.firstName,
            last_name: p.lastName,
            date_of_birth: p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split("T")[0] : "",
            gender: p.gender,
            phone: p.phone,
            email: p.email || "",
            insurance_type: p.insuranceType || "",
            insurance_number: p.insuranceNumber || "",
            created_at: p.createdAt,
          })),
          ["patient_number", "first_name", "last_name", "date_of_birth", "gender", "phone", "email", "insurance_type", "insurance_number", "created_at"]
        )
        filename = "patients_export.csv"
        break
      }

      case "invoices": {
        const where = hasDateFilter ? { createdAt: dateFilter } : {}
        const invoices = await prisma.invoice.findMany({
          where,
          include: {
            patient: { select: { firstName: true, lastName: true, patientNumber: true } },
            paymentAllocations: { select: { amount: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 5000,
        })
        csv = toCSV(
          invoices.map((inv: any) => {
            const totalPaid = (inv.paymentAllocations || []).reduce(
              (sum: number, pa: any) => sum + (pa.amount || 0), 0
            )
            return {
              invoice_number: inv.invoiceNumber,
              patient_name: `${inv.patient?.firstName || ""} ${inv.patient?.lastName || ""}`,
              patient_number: inv.patient?.patientNumber || "",
              total_amount: Number(inv.totalAmount || 0),
              amount_paid: totalPaid,
              balance: Number(inv.totalAmount || 0) - totalPaid,
              payment_status: inv.paymentStatus,
              payment_method: inv.paymentMethod || "",
              created_at: inv.createdAt,
            }
          }),
          ["invoice_number", "patient_name", "patient_number", "total_amount", "amount_paid", "balance", "payment_status", "payment_method", "created_at"]
        )
        filename = "invoices_export.csv"
        break
      }

      case "medicines": {
        const medicines = await prisma.medicine.findMany({
          orderBy: { name: "asc" },
          take: 5000,
        })
        csv = toCSV(
          medicines.map((m) => ({
            name: m.name,
            generic_name: m.genericName || "",
            category: m.category || "",
            batch_number: m.batchNumber || "",
            current_stock: m.currentStock,
            unit_price: m.unitPrice,
            reorder_level: m.reorderLevel,
            expiry_date: m.expiryDate ? new Date(m.expiryDate).toISOString().split("T")[0] : "",
            manufacturer: m.manufacturer || "",
          })),
          ["name", "generic_name", "category", "batch_number", "current_stock", "unit_price", "reorder_level", "expiry_date", "manufacturer"]
        )
        filename = "medicines_export.csv"
        break
      }

      case "consultations": {
        const where = hasDateFilter ? { createdAt: dateFilter } : {}
        const consults = await prisma.consultation.findMany({
          where,
          include: { patient: { select: { firstName: true, lastName: true, patientNumber: true } } },
          orderBy: { createdAt: "desc" },
          take: 5000,
        })
        csv = toCSV(
          consults.map((c) => ({
            consultation_number: c.consultationNumber,
            patient_name: `${c.patient?.firstName || ""} ${c.patient?.lastName || ""}`,
            patient_number: c.patient?.patientNumber || "",
            diagnosis: c.diagnosis || "",
            chief_complaint: c.chiefComplaint || "",
            status: c.status || "",
            created_at: c.createdAt,
          })),
          ["consultation_number", "patient_name", "patient_number", "diagnosis", "chief_complaint", "status", "created_at"]
        )
        filename = "consultations_export.csv"
        break
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown export type: ${type}` }, { status: 400 })
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("[Export Error]", error)
    return NextResponse.json({ success: false, error: "Export failed" }, { status: 500 })
  }
}
