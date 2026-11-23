"use client"

import { useState, type FormEvent } from "react"
import { motion, useReducedMotion } from "motion/react"
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, QrCode, ScanLine, ShieldCheck, Sparkles } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/components/auth-provider"

interface AuthScreenProps {
  connectionError: string | null
}

export function AuthScreen({ connectionError }: AuthScreenProps) {
  const { signIn, signUp } = useAuth()
  const prefersReducedMotion = useReducedMotion()
  const [mode, setMode] = useState<"login" | "register">("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (mode === "register" && !passwordRules.every((rule) => rule.met)) {
      setError("Meet every password requirement before creating your account.")
      return
    }
    if (mode === "register" && password !== confirmPassword) {
      setError("Those passwords do not match yet.")
      return
    }

    setPending(true)
    try {
      if (mode === "login") {
        await signIn(email.trim(), password)
      } else {
        await signUp({
          name: name.trim(),
          email: email.trim(),
          password,
          confirm_password: confirmPassword,
        })
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Try again.")
    } finally {
      setPending(false)
    }
  }

  function changeMode(nextMode: "login" | "register") {
    setMode(nextMode)
    setError(null)
  }

  const passwordRules = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One number", met: /\d/.test(password) },
    { label: "One special character", met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ]
  const motionDuration = prefersReducedMotion ? 0 : 0.7

  return (
    <main className="auth-page">
      <div className="auth-backdrop" aria-hidden="true" />
      <section className="auth-showcase">
        <div className="auth-brand-row">
          <div className="brand-lockup">
            <div className="brand-mark"><QrCode aria-hidden="true" /></div>
            <span>QR<span className="brand-dot">.</span>STUDIO</span>
          </div>
          <div className="auth-secure-pill"><span className="status-dot" /> Private workspace</div>
        </div>

        <motion.div
          className="showcase-copy"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: motionDuration, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="eyebrow"><Sparkles aria-hidden="true" /> THE QR CREATION STUDIO</div>
          <h1>Make every<br /><span>scan count.</span></h1>
          <p>Thoughtful QR codes for the links, places, and moments you want people to find.</p>

          <div className="showcase-visual" aria-hidden="true">
            <div className="visual-orbit visual-orbit-one" />
            <div className="visual-orbit visual-orbit-two" />
            <div className="visual-glow" />
            <div className="visual-qr-card">
              <div className="visual-qr-top"><span className="visual-indicator" /> LIVE DESIGN PREVIEW <ScanLine /></div>
              <div className="visual-qr-center">
                <div className="visual-qr-frame"><QrCode /></div>
                <div className="visual-scanline" />
              </div>
              <div className="visual-qr-bottom"><span>YOUR NEXT BIG THING</span><ArrowRight /></div>
            </div>
            <div className="floating-chip chip-top"><span className="chip-sparkle"><Sparkles /></span> Made to be scanned</div>
            <div className="floating-chip chip-bottom"><span className="chip-check"><Check /></span> Live preview</div>
          </div>
        </motion.div>

        <div className="showcase-foot">
          <span><ShieldCheck aria-hidden="true" /> Secure by design</span>
          <span>01 <i /> 03</span>
        </div>
      </section>

      <section className="auth-panel-wrap">
        <motion.div
          className="auth-panel"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: motionDuration, delay: prefersReducedMotion ? 0 : 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="auth-mobile-brand brand-lockup">
            <div className="brand-mark"><QrCode aria-hidden="true" /></div>
            <span>QR<span className="brand-dot">.</span>STUDIO</span>
          </div>
          <div className="auth-panel-heading">
            <span className="panel-kicker">{mode === "login" ? "WELCOME BACK" : "YOUR STUDIO STARTS HERE"}</span>
            <h2>{mode === "login" ? "Sign in to your studio" : "Create your account"}</h2>
            <p>{mode === "login" ? "Your next great QR code is one good idea away." : "Set up your workspace and start making."}</p>
          </div>

          {connectionError && (
            <Alert variant="destructive" className="auth-alert">
              <LockKeyhole aria-hidden="true" />
              <AlertTitle>Backend connection needed</AlertTitle>
              <AlertDescription>{connectionError}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive" className="auth-alert">
              <AlertTitle>Could not continue</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <FieldGroup className="auth-fields">
              {mode === "register" && (
                <Field>
                  <FieldLabel htmlFor="name">Your name</FieldLabel>
                  <Input
                    id="name"
                    autoComplete="name"
                    placeholder="Alex Morgan"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="email">Email address</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <div className="field-label-line">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  {mode === "login" && <span className="field-aside">Your account password</span>}
                </div>
                <div className="password-input-wrap">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={mode === "register" ? 8 : undefined}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                {mode === "register" && (
                  <ul className="password-requirements" aria-label="Password requirements">
                    {passwordRules.map((rule) => (
                      <li key={rule.label} data-valid={rule.met}>
                        <span aria-hidden="true">{rule.met ? <Check /> : <span className="rule-empty" />}</span>
                        {rule.label}
                      </li>
                    ))}
                  </ul>
                )}
              </Field>
              {mode === "register" && (
                <Field>
                  <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Enter it one more time"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    minLength={8}
                  />
                </Field>
              )}
            </FieldGroup>

            <Button className="auth-submit" type="submit" disabled={pending}>
              {pending ? <span className="button-spinner" aria-hidden="true" /> : <LockKeyhole data-icon="inline-start" aria-hidden="true" />}
              {pending ? "Connecting…" : mode === "login" ? "Sign in" : "Create account"}
              {!pending && <ArrowRight data-icon="inline-end" aria-hidden="true" />}
            </Button>
          </form>

          <div className="auth-switch">
            <span>{mode === "login" ? "New to QR Studio?" : "Already have an account?"}</span>
            <button type="button" onClick={() => changeMode(mode === "login" ? "register" : "login")}>
              {mode === "login" ? "Create an account" : "Sign in instead"}
            </button>
          </div>
          <div className="auth-legal"><LockKeyhole aria-hidden="true" /> Your session is protected with a secure, HttpOnly cookie.</div>
        </motion.div>
      </section>
    </main>
  )
}
