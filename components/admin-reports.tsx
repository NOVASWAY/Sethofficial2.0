"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { Download, DollarSign, Users, Activity, TrendingUp, FileText, BarChart3 } from "lucide-react"

interface AdminReportsProps {
  role: string
}

const revenueData = [
  { month: "Jan", revenue: 45000, expenses: 32000, profit: 13000 },
  { month: "Feb", revenue: 52000, expenses: 35000, profit: 17000 },
  { month: "Mar", revenue: 48000, expenses: 33000, profit: 15000 },
  { month: "Apr", revenue: 61000, expenses: 38000, profit: 23000 },
  { month: "May", revenue: 55000, expenses: 36000, profit: 19000 },
  { month: "Jun", revenue: 67000, expenses: 41000, profit: 26000 },
]

const patientVisitsData = [
  { date: "2024-01-15", visits: 28 },
  { date: "2024-01-16", visits: 32 },
  { date: "2024-01-17", visits: 25 },
  { date: "2024-01-18", visits: 35 },
  { date: "2024-01-19", visits: 29 },
  { date: "2024-01-20", visits: 41 },
  { date: "2024-01-21", visits: 38 },
]

const departmentData = [
  { name: "General Medicine", value: 45, color: "#8b5cf6" },
  { name: "Pharmacy", value: 25, color: "#f97316" },
  { name: "Dental", value: 15, color: "#06b6d4" },
  { name: "Laboratory", value: 10, color: "#10b981" },
  { name: "Emergency", value: 5, color: "#ef4444" },
]

const topDiagnoses = [
  { diagnosis: "Hypertension", count: 156, percentage: 18.2 },
  { diagnosis: "Diabetes Type 2", count: 134, percentage: 15.6 },
  { diagnosis: "Upper Respiratory Infection", count: 98, percentage: 11.4 },
  { diagnosis: "Malaria", count: 87, percentage: 10.1 },
  { diagnosis: "Gastritis", count: 76, percentage: 8.9 },
]

const staffPerformance = [
  { name: "Dr. Smith", department: "General Medicine", patients: 245, rating: 4.8 },
  { name: "Dr. Johnson", department: "Pediatrics", patients: 198, rating: 4.7 },
  { name: "Dr. Brown", department: "Internal Medicine", patients: 167, rating: 4.6 },
  { name: "Nurse Wilson", department: "Emergency", patients: 312, rating: 4.9 },
  { name: "Pharmacist Davis", department: "Pharmacy", patients: 456, rating: 4.5 },
]

export function AdminReports({ role }: AdminReportsProps) {
  const [dateRange, setDateRange] = useState("last30days")
  const [reportType, setReportType] = useState("overview")

  const canViewReports = role === "admin" || role === "clinician"
  const canViewFinancialReports = role === "admin"

  if (!canViewReports) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">Access Restricted</h3>
          <p className="text-muted-foreground">You don't have permission to view reports.</p>
        </div>
      </div>
    )
  }

  const totalRevenue = revenueData.reduce((sum, item) => sum + item.revenue, 0)
  const totalExpenses = revenueData.reduce((sum, item) => sum + item.expenses, 0)
  const totalProfit = totalRevenue - totalExpenses
  const profitMargin = ((totalProfit / totalRevenue) * 100).toFixed(1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">Reports & Analytics</h1>
          <p className="text-muted-foreground">Comprehensive clinic performance insights</p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last7days">Last 7 Days</SelectItem>
              <SelectItem value="last30days">Last 30 Days</SelectItem>
              <SelectItem value="last3months">Last 3 Months</SelectItem>
              <SelectItem value="last6months">Last 6 Months</SelectItem>
              <SelectItem value="lastyear">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      {canViewFinancialReports && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold">KSh {totalRevenue.toLocaleString()}</p>
                  <p className="text-xs text-green-600 flex items-center">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    +12.5% from last period
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Total Patients</p>
                  <p className="text-2xl font-bold">1,247</p>
                  <p className="text-xs text-blue-600 flex items-center">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    +8.2% from last period
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Patient Visits</p>
                  <p className="text-2xl font-bold">2,156</p>
                  <p className="text-xs text-primary flex items-center">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    +15.3% from last period
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-accent" />
                <div>
                  <p className="text-sm font-medium">Profit Margin</p>
                  <p className="text-2xl font-bold">{profitMargin}%</p>
                  <p className="text-xs text-accent flex items-center">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    +2.1% from last period
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!canViewFinancialReports && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Total Patients</p>
                  <p className="text-2xl font-bold">1,247</p>
                  <p className="text-xs text-blue-600 flex items-center">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    +8.2% from last period
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Patient Visits</p>
                  <p className="text-2xl font-bold">2,156</p>
                  <p className="text-xs text-primary flex items-center">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    +15.3% from last period
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-accent" />
                <div>
                  <p className="text-sm font-medium">Appointment Rate</p>
                  <p className="text-2xl font-bold">88.5%</p>
                  <p className="text-xs text-accent flex items-center">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    +2.1% from last period
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Reports */}
      <Tabs defaultValue={canViewFinancialReports ? "financial" : "patients"} className="space-y-4">
        <TabsList className={`grid w-full ${canViewFinancialReports ? "grid-cols-5" : "grid-cols-4"}`}>
          {canViewFinancialReports && <TabsTrigger value="financial">Financial</TabsTrigger>}
          <TabsTrigger value="patients">Patients</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        {canViewFinancialReports && (
          <TabsContent value="financial" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue vs Expenses</CardTitle>
                  <CardDescription>Monthly financial performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`KSh ${value.toLocaleString()}`, ""]} />
                      <Bar dataKey="revenue" fill="#8b5cf6" name="Revenue" />
                      <Bar dataKey="expenses" fill="#f97316" name="Expenses" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Profit Trend</CardTitle>
                  <CardDescription>Monthly profit analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`KSh ${value.toLocaleString()}`, "Profit"]} />
                      <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
                <CardDescription>Revenue sources by department</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={departmentData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}%`}
                        >
                          {departmentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {departmentData.map((dept, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: dept.color }} />
                          <span className="text-sm">{dept.name}</span>
                        </div>
                        <span className="font-medium">{dept.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="patients" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily Patient Visits</CardTitle>
                <CardDescription>Patient visit trends over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={patientVisitsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString()} />
                    <YAxis />
                    <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString()} />
                    <Line type="monotone" dataKey="visits" stroke="#8b5cf6" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Diagnoses</CardTitle>
                <CardDescription>Most common patient diagnoses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topDiagnoses.map((diagnosis, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{diagnosis.diagnosis}</p>
                        <p className="text-sm text-muted-foreground">{diagnosis.count} cases</p>
                      </div>
                      <Badge variant="outline">{diagnosis.percentage}%</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Patient Demographics</CardTitle>
              <CardDescription>Age and gender distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <h4 className="font-medium">Age Groups</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">0-18 years</span>
                      <span className="text-sm font-medium">23%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">19-35 years</span>
                      <span className="text-sm font-medium">34%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">36-55 years</span>
                      <span className="text-sm font-medium">28%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">55+ years</span>
                      <span className="text-sm font-medium">15%</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Gender</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Female</span>
                      <span className="text-sm font-medium">58%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Male</span>
                      <span className="text-sm font-medium">42%</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Insurance Type</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">SHA/NHIF</span>
                      <span className="text-sm font-medium">67%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Cash</span>
                      <span className="text-sm font-medium">33%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Appointment Statistics</CardTitle>
                <CardDescription>Appointment booking and completion rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Total Appointments</span>
                    <span className="font-bold">1,856</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Completed</span>
                    <span className="font-bold text-green-600">1,642 (88.5%)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>No-shows</span>
                    <span className="font-bold text-red-600">156 (8.4%)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Cancelled</span>
                    <span className="font-bold text-yellow-600">58 (3.1%)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Average Wait Times</CardTitle>
                <CardDescription>Patient wait times by department</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">General Medicine</span>
                    <span className="text-sm font-medium">18 min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Emergency</span>
                    <span className="text-sm font-medium">5 min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Pharmacy</span>
                    <span className="text-sm font-medium">12 min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Laboratory</span>
                    <span className="text-sm font-medium">8 min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Dental</span>
                    <span className="text-sm font-medium">22 min</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Service Utilization</CardTitle>
              <CardDescription>Most requested services and procedures</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>General Consultation</TableCell>
                    <TableCell>General Medicine</TableCell>
                    <TableCell>456</TableCell>
                    <TableCell>KSh 228,000</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Blood Pressure Check</TableCell>
                    <TableCell>General Medicine</TableCell>
                    <TableCell>234</TableCell>
                    <TableCell>KSh 46,800</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Prescription Refill</TableCell>
                    <TableCell>Pharmacy</TableCell>
                    <TableCell>189</TableCell>
                    <TableCell>KSh 94,500</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Blood Test</TableCell>
                    <TableCell>Laboratory</TableCell>
                    <TableCell>167</TableCell>
                    <TableCell>KSh 83,500</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Dental Cleaning</TableCell>
                    <TableCell>Dental</TableCell>
                    <TableCell>98</TableCell>
                    <TableCell>KSh 58,800</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Staff Performance</CardTitle>
              <CardDescription>Employee productivity and patient satisfaction ratings</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Patients Served</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Performance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffPerformance.map((staff, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{staff.name}</TableCell>
                      <TableCell>{staff.department}</TableCell>
                      <TableCell>{staff.patients}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <span>{staff.rating}</span>
                          <span className="text-yellow-500">★</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={staff.rating >= 4.7 ? "default" : staff.rating >= 4.5 ? "secondary" : "outline"}
                        >
                          {staff.rating >= 4.7 ? "Excellent" : staff.rating >= 4.5 ? "Good" : "Average"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Staff Utilization</CardTitle>
                <CardDescription>Working hours and efficiency</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Average Hours/Week</span>
                    <span className="text-sm font-medium">42.5 hrs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Overtime Hours</span>
                    <span className="text-sm font-medium">8.2 hrs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Efficiency Rate</span>
                    <span className="text-sm font-medium">87.3%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Patient Satisfaction</span>
                    <span className="text-sm font-medium">4.6/5.0</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Department Staffing</CardTitle>
                <CardDescription>Staff distribution by department</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">General Medicine</span>
                    <span className="text-sm font-medium">8 staff</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Nursing</span>
                    <span className="text-sm font-medium">12 staff</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Pharmacy</span>
                    <span className="text-sm font-medium">3 staff</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Administration</span>
                    <span className="text-sm font-medium">5 staff</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Support</span>
                    <span className="text-sm font-medium">4 staff</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Value</CardTitle>
                <CardDescription>Total medication inventory worth</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-3xl font-bold">KSh 2.4M</p>
                  <p className="text-sm text-muted-foreground">Current inventory value</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Stock Alerts</CardTitle>
                <CardDescription>Items requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Low Stock</span>
                    <Badge variant="secondary">12 items</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Out of Stock</span>
                    <Badge variant="destructive">3 items</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Expiring Soon</span>
                    <Badge variant="outline">8 items</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Moving Items</CardTitle>
                <CardDescription>Most dispensed medications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Paracetamol</span>
                    <span className="text-sm font-medium">456 units</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Amoxicillin</span>
                    <span className="text-sm font-medium">234 units</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Metformin</span>
                    <span className="text-sm font-medium">189 units</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Inventory Turnover</CardTitle>
              <CardDescription>Medication usage and restocking patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Turnover Rate</TableHead>
                    <TableHead>Avg. Stock Days</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Analgesics</TableCell>
                    <TableCell>45</TableCell>
                    <TableCell>8.2x/year</TableCell>
                    <TableCell>44 days</TableCell>
                    <TableCell>
                      <Badge variant="default">Optimal</Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Antibiotics</TableCell>
                    <TableCell>32</TableCell>
                    <TableCell>6.8x/year</TableCell>
                    <TableCell>54 days</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Good</Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Antidiabetics</TableCell>
                    <TableCell>18</TableCell>
                    <TableCell>4.2x/year</TableCell>
                    <TableCell>87 days</TableCell>
                    <TableCell>
                      <Badge variant="outline">Slow</Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
