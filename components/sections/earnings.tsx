"use client"

import { useEffect, useState, useRef } from "react"
import { motion, useInView, useSpring, useTransform } from "framer-motion"
import { FadeInSection } from "@/components/ui/fade-in-section"

// Animated number component - counts from 0 to target without overshooting
function AnimatedNumber({ value, prefix = "" }: { value: number; prefix?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const spring = useSpring(0, {
    stiffness: 100,
    damping: 25,
    restDelta: 100
  })
  const display = useTransform(spring, (current) => {
    // Clamp to not exceed target value
    const clamped = Math.min(Math.floor(current), value)
    return `${prefix}${clamped.toLocaleString("en-IN")}`
  })
  const [displayValue, setDisplayValue] = useState(`${prefix}0`)

  useEffect(() => {
    if (isInView) {
      spring.set(value)
    }
  }, [isInView, spring, value])

  useEffect(() => {
    return display.on("change", (latest) => {
      setDisplayValue(latest)
    })
  }, [display])

  return <span ref={ref} className="tabular-nums">{displayValue}</span>
}

export function EarningsSection() {
  return (
    <FadeInSection>
      <section id="earnings" className="min-h-screen flex items-center justify-center px-6 lg:px-12">
        <div className="max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center gap-3 mb-16"
          >
            <div className="w-8 h-px bg-muted-foreground/30" />
            <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Earnings</span>
            <div className="w-8 h-px bg-muted-foreground/30" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <p className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-light tracking-tighter">
              <AnimatedNumber value={1000000} prefix="₹" />
              <span className="text-muted-foreground">+</span>
            </p>
            <p className="mt-4 text-lg font-light text-muted-foreground tracking-tight">earned by top sellers</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-16 flex items-center justify-center gap-8 text-sm font-light text-muted-foreground"
          >
            <span className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-foreground/50" />
              Performance-based
            </span>
            <span className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-foreground/50" />
              No caps
            </span>
          </motion.div>
        </div>
      </section>
    </FadeInSection>
  )
}
