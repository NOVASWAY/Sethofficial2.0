"use client"

import { useParams } from "next/navigation"

export default function DashboardDebugPage() {
    const params = useParams()
    const role = params.role as string

    return (
        <div className="p-8 bg-white min-h-screen">
            <h1 className="text-2xl font-bold text-black">Dashboard Debug Page</h1>
            <p className="text-gray-600">Role: {role}</p>
            <p className="text-gray-600">If you see this, the route params work.</p>
        </div>
    )
}
