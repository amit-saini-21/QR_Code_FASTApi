"use client"

import { AuthProvider, useAuth } from "@/components/auth-provider"
import { AuthScreen } from "@/components/auth-screen"
import { StudioApp } from "@/components/studio-app"

function AppContent() {
  const { user, isLoading, connectionError } = useAuth()

  if (isLoading) {
    return (
      <main className="boot-screen" aria-label="Loading QR Studio">
        <div className="boot-mark"><span /></div>
        <p>Opening your studio</p>
      </main>
    )
  }

  if (!user) return <AuthScreen connectionError={connectionError} />
  return <StudioApp user={user} />
}

export function AppRoot() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
