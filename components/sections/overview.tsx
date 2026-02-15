"use client"

import { motion } from "framer-motion"
import { FadeInSection } from "@/components/ui/fade-in-section"

export function OverviewSection() {
  return (
    <FadeInSection>
      <section id="overview" className="min-h-screen flex items-center justify-center px-6 lg:px-12">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 mb-8"
          >
            <div className="w-8 h-px bg-muted-foreground/30" />
            <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Overview</span>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-2xl md:text-3xl lg:text-4xl font-light tracking-tight leading-relaxed text-balance"
          >
            A new marketplace where sales talent is rewarded <span className="text-muted-foreground">instantly</span>{" "}
            and <span className="text-muted-foreground">fairly.</span>
          </motion.p>
        </div>
      </section>
    </FadeInSection>
  )
}
