"use client"

import { motion } from "framer-motion"
import { MousePointer2, Globe, Zap } from "lucide-react"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import { FadeInSection } from "@/components/ui/fade-in-section"

const steps = [
  {
    title: "Choose an Offer",
    caption: "Browse curated products",
    icon: MousePointer2,
  },
  {
    title: "Sell Anywhere",
    caption: "Your network, your way",
    icon: Globe,
  },
  {
    title: "Earn Automatically",
    caption: "Instant commission payouts",
    icon: Zap,
  },
]

export function HowItWorksSection() {
  return (
    <FadeInSection>
      <section id="how-it-works" className="min-h-screen flex items-center justify-center px-6 lg:px-12 py-24">
        <div className="max-w-5xl w-full">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 mb-16"
          >
            <div className="w-8 h-px bg-muted-foreground/30" />
            <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">How It Works</span>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <SpotlightCard className="p-8 group">
                    <div className="absolute top-4 right-4 text-xs font-light text-muted-foreground/50">
                      0{index + 1}
                    </div>
                    <Icon className="w-6 h-6 mb-8 text-muted-foreground group-hover:text-foreground transition-colors duration-300" />
                    <h3 className="text-lg font-normal tracking-tight mb-2">{step.title}</h3>
                    <p className="text-sm font-light text-muted-foreground">{step.caption}</p>
                  </SpotlightCard>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>
    </FadeInSection>
  )
}
