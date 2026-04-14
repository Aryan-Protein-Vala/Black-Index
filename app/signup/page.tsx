"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { toast } from "sonner"

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const { signUp } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    // Validate password length
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setIsLoading(false)
      return
    }

    const { error } = await signUp(email, password, name)

    if (error) {
      setError(error.message || "Failed to create account. Please try again.")
      setIsLoading(false)
    } else {
      // Show success state and toast
      setIsSuccess(true)
      setIsLoading(false)
      toast.success("Account created! Check your inbox to verify your email.", {
        duration: 6000,
        icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
      })
    }
  }


  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Cinematic Abstract */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-card overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-card via-background to-card" />

        {/* Abstract geometric shape */}
        <div className="relative">
          <motion.div
            animate={{
              rotate: [0, 360],
            }}
            transition={{
              duration: 30,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
            className="w-72 h-72 relative"
          >
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute inset-0 border border-foreground/10 rounded-full"
                style={{
                  transform: `scale(${1 - i * 0.15}) rotate(${i * 15}deg)`,
                }}
                animate={{
                  rotate: [i * 15, i * 15 + 360],
                }}
                transition={{
                  duration: 20 + i * 5,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "linear",
                }}
              />
            ))}
            <div className="absolute inset-20 bg-foreground/5 backdrop-blur-sm rounded-full" />
          </motion.div>
        </div>

        {/* Floating lines */}
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-px h-20 bg-gradient-to-b from-transparent via-foreground/20 to-transparent"
            animate={{
              y: [-50, 50, -50],
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{
              duration: 4 + i,
              repeat: Number.POSITIVE_INFINITY,
              delay: i * 0.8,
            }}
            style={{
              left: `${25 + i * 15}%`,
              top: `${30 + i * 10}%`,
            }}
          />
        ))}
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {isSuccess ? (
            // Success State
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 15, delay: 0.1 }}
                className="w-20 h-20 mx-auto mb-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center"
              >
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </motion.div>
              <h1 className="text-3xl font-light tracking-tight mb-4">Check Your Inbox</h1>
              <p className="text-muted-foreground font-light mb-8">
                We've sent a verification link to <span className="text-foreground">{email}</span>.
                Click the link to verify your account, then come back to log in.
              </p>
              <Link href="/login">
                <Button className="h-12 px-8 text-sm font-normal tracking-tight bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 group">
                  Go to Login
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                </Button>
              </Link>
            </motion.div>
          ) : (
            // Form State
            <>
              <div className="mb-12">
                <h1 className="text-3xl font-light tracking-tight mb-2">Join the Network</h1>
                <p className="text-muted-foreground font-light">Start earning from your first sale</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-light"
                  >
                    {error}
                  </motion.div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Full Name</label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="h-12 bg-input/30 backdrop-blur border-border/50 text-sm font-light placeholder:text-muted-foreground/50 focus:border-foreground/30"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-12 bg-input/30 backdrop-blur border-border/50 text-sm font-light placeholder:text-muted-foreground/50 focus:border-foreground/30"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-12 bg-input/30 backdrop-blur border-border/50 text-sm font-light placeholder:text-muted-foreground/50 focus:border-foreground/30 pr-12"
                      required
                      disabled={isLoading}
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground/50 font-light">Must be at least 6 characters</p>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 text-sm font-normal tracking-tight bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 group disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                    </>
                  )}
                </Button>
              </form>

              <p className="mt-8 text-center text-sm text-muted-foreground font-light">
                Already have an account?{" "}
                <Link href="/login" className="text-foreground hover:underline">
                  Sign In
                </Link>
              </p>


          )}
        </motion.div>
      </div>
    </div>
  )
}


