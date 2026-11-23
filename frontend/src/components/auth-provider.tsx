"use client"

import { createContext, useContext, useEffect, type ReactNode } from "react"
import useSWR from "swr"
import { authApi, type RegisterInput } from "@/lib/backend-api"
import type { User } from "@/lib/types"

const AUTH_KEY = "/api/backend/api/v1/auth/me"

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  connectionError: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: RegisterInput) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, error, isLoading, mutate } = useSWR<User | null>(
    AUTH_KEY,
    () => authApi.currentUser(),
    { shouldRetryOnError: false, dedupingInterval: 30_000 },
  )

  useEffect(() => {
    const resetSession = () => {
      void mutate(null, { revalidate: false })
    }
    window.addEventListener("qr-studio:unauthorized", resetSession)
    return () => window.removeEventListener("qr-studio:unauthorized", resetSession)
  }, [mutate])

  async function refreshUser() {
    const user = await authApi.currentUser()
    await mutate(user, { revalidate: false })
  }

  async function signIn(email: string, password: string) {
    await authApi.login(email, password)
    await refreshUser()
  }

  async function signUp(input: RegisterInput) {
    await authApi.register(input)
    await signIn(input.email, input.password)
  }

  async function signOut() {
    try {
      await authApi.logout()
    } finally {
      await mutate(null, { revalidate: false })
    }
  }

  const connectionError = error && error.status !== 401
    ? error.message || "The QR API is unavailable. Check the backend connection."
    : null

  return (
    <AuthContext.Provider
      value={{
        user: data ?? null,
        isLoading,
        connectionError,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside AuthProvider")
  return context
}
