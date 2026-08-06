"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, LayoutDashboard } from "lucide-react"
import { motion, useScroll, useTransform } from "framer-motion"
import { useRef } from "react"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"

const titleWords = ["Black", "Index"]
const subtitleWords = ["The", "Affiliate", "Marketplace", "for", "Indian", "SaaS."]

export function HeroSection() {
  const ref = useRef<HTMLElement>(null)
  const { user } = useAuth()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  })

  const titleY = useTransform(scrollYProgress, [0, 1], [0, 150])
  const subtitleY = useTransform(scrollYProgress, [0, 1], [0, 100])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

  return (
    <section ref={ref} className="min-h-screen flex items-center justify-center px-6 lg:px-12 relative overflow-hidden">
      <motion.div style={{ opacity }} className="max-w-4xl">
        <motion.h1
          style={{ y: titleY }}
          className="text-4xl md:text-6xl lg:text-7xl font-light tracking-tight leading-[1.1] text-balance"
        >
          {titleWords.map((word, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="inline-block mr-[0.25em]"
            >
              {word}
            </motion.span>
          ))}
          <br />
          <motion.span style={{ y: subtitleY }} className="text-muted-foreground inline-block">
            {subtitleWords.map((word, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                className="inline-block mr-[0.25em]"
              >
                {word}
              </motion.span>
            ))}
          </motion.span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-8 text-lg md:text-xl font-light text-muted-foreground tracking-tight max-w-xl"
        >
          Sell SaaS. Others promote it. They earn recurring commission paid straight to UPI.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-12">
            <Link href={user ? "/dashboard" : "/signup"} className="w-full sm:w-auto">
              <Button className="w-full h-12 px-8 text-sm font-normal tracking-tight bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 group shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                {user ? (
                  <>
                    Go to Dashboard
                    <LayoutDashboard className="ml-2 w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
                  </>
                ) : (
                  <>
                    Join the Network
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </>
                )}
              </Button>
            </Link>
            <Link href="/protocol" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full h-12 px-8 text-sm font-normal tracking-tight border-border/50 hover:bg-foreground/5 transition-all duration-300 group">
                What is Black Index?
                <ArrowRight className="ml-2 w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform duration-300" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}
