"use client"

import { useParams } from "next/navigation"
import { EnhancedServiceCatalog } from "@/components/enhanced-service-catalog"
import { AdminServiceManagement } from "@/components/admin-service-management"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ServicesPage() {
  const params = useParams()
  const role = params.role as string
  const isAdmin = role === 'admin'

  if (isAdmin) {
    return (
        <Tabs defaultValue="catalog" className="space-y-6">
          <TabsList>
            <TabsTrigger value="catalog">Service Catalog</TabsTrigger>
            <TabsTrigger value="admin">Price Management</TabsTrigger>
          </TabsList>
          
          <TabsContent value="catalog">
            <EnhancedServiceCatalog role={role} />
          </TabsContent>
          
          <TabsContent value="admin">
            <AdminServiceManagement role={role} />
          </TabsContent>
        </Tabs>
    )
  }

  return (
      <EnhancedServiceCatalog role={role} />
  )
}

