import React from "react"
import { DashboardLayout } from "@/components/dashboard-layout"

interface RoleLayoutProps {
    children: React.ReactNode
    params: any
}

export default function RoleLayout({ children, params }: RoleLayoutProps) {
    // IGNORE PARAMS
    return (
        <DashboardLayout role="admin">
            {children}
        </DashboardLayout>
    )
}


