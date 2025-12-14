"use client"

export default function TestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-green-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-green-800 mb-4">✅ Frontend is Working!</h1>
        <p className="text-lg text-gray-700">If you can see this, the frontend is rendering correctly.</p>
        <a href="/" className="mt-4 inline-block text-blue-600 underline">Go to Login Page</a>
      </div>
    </div>
  )
}

