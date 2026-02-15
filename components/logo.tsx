"use client"

import { motion } from "framer-motion"

interface LogoProps {
  className?: string
  showText?: boolean
}

export function Logo({ className = "", showText = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative w-8 h-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 border border-foreground/30 rounded-sm"
          style={{ transform: "translate(-2px, -2px)" }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotate: 10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="absolute inset-0 border border-foreground/50 rounded-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="absolute inset-0 bg-foreground rounded-sm"
          style={{ transform: "translate(2px, 2px)", width: "50%", height: "50%" }}
        />
      </div>
      {showText && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex items-baseline gap-1"
        >
          <span className="text-sm font-light tracking-tight text-muted-foreground">BLACK</span>
          <span className="text-sm font-medium tracking-tight text-foreground">INDEX</span>
        </motion.div>
      )}
    </div>
  )
}

