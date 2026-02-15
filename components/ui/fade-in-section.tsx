"use client"

import type React from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { useRef } from "react"

interface FadeInSectionProps {
  children: React.ReactNode
  className?: string
}

export function FadeInSection({ children, className }: FadeInSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0])
  const y = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [60, 0, 0, -60])

  return (
    <motion.div ref={ref} style={{ opacity, y }} className={className}>
      {children}
    </motion.div>
  )
}
