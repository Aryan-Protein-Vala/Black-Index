"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const { signIn } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const { error } = await signIn(email, password)

    if (error) {
      setError(error.message || "Invalid credentials. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Cinematic Abstract */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-card overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-card via-background to-card" />

        {/* Abstract 3D-like shape */}
        <div className="relative">
          <motion.div
            animate={{
              rotateY: [0, 360],
              rotateX: [0, 15, 0, -15, 0],
            }}
            transition={{
              duration: 20,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
            className="w-64 h-64 relative"
            style={{ transformStyle: "preserve-3d", perspective: "1000px" }}
          >
            <div className="absolute inset-0 border border-foreground/10 rounded-3xl transform rotate-45" />
            <div className="absolute inset-4 border border-foreground/20 rounded-3xl transform rotate-12" />
            <div className="absolute inset-8 border border-foreground/30 rounded-3xl transform -rotate-12" />
            <div className="absolute inset-12 bg-foreground/5 backdrop-blur-sm rounded-3xl" />
          </motion.div>
        </div>

        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-foreground/20 rounded-full"
            animate={{
              y: [0, -100, 0],
              x: [0, Math.random() * 50 - 25, 0],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 5 + i,
              repeat: Number.POSITIVE_INFINITY,
              delay: i * 0.5,
            }}
            style={{
              left: `${20 + i * 12}%`,
              top: `${50 + i * 5}%`,
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
          <div className="mb-12">
            <h1 className="text-3xl font-light tracking-tight mb-2">Welcome back</h1>
            <p className="text-muted-foreground font-light">Enter your credentials to continue</p>
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
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 text-sm font-normal tracking-tight bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 group disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground font-light">
            Don't have an account?{" "}
            <Link href="/signup" className="text-foreground hover:underline">
              Join the Network
            </Link>
          </p>

        </motion.div>
      </div>
    </div>
  )
}

