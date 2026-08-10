"use client"

import { motion } from "framer-motion"
import { TrendingUp, Package } from "lucide-react"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import { FadeInSection } from "@/components/ui/fade-in-section"

export function TheMathsSection() {
  return (
    <FadeInSection>
      <section id="the-maths" className="min-h-screen flex items-center justify-center px-6 lg:px-12 py-24">
        <div className="max-w-5xl w-full">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 mb-16"
          >
            <div className="w-8 h-px bg-muted-foreground/30" />
            <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">The Maths</span>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Warlord Math */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <SpotlightCard className="p-8 h-full">
                <div className="flex items-center gap-3 mb-6">
                  <TrendingUp className="w-6 h-6 text-muted-foreground" />
                  <h3 className="text-xl font-light tracking-tight">Warlord Earnings</h3>
                </div>

                <div className="space-y-6">
                  <div className="p-4 rounded-lg bg-foreground/5 border border-border/30">
                    <p className="text-sm text-muted-foreground font-light mb-3">Imagine you sell a product worth:</p>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-light">₹1,000</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">/month subscription</p>
                      </div>
                      <div>
                        <p className="text-2xl font-light">1,000</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">customers</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-border/30 gap-2">
                      <span className="text-sm text-muted-foreground font-light shrink-0">Upfront (30%)</span>
                      <span className="text-base sm:text-lg font-light text-foreground text-right">₹3,00,000</span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-border/30 gap-2">
                      <span className="text-sm text-muted-foreground font-light shrink-0">Monthly (15%)</span>
                      <span className="text-base sm:text-lg font-light text-foreground text-right">₹1,50,000</span>
                    </div>
                    <div className="flex items-center justify-between py-3 gap-2">
                      <span className="text-sm font-light shrink-0">Year 1 Total</span>
                      <span className="text-xl sm:text-2xl font-light text-foreground text-right">₹19,50,000</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground font-light text-center">
                    Your customers keep paying → You keep earning. (Platform takes 5% of the commission)
                  </p>
                  <div className="pt-4 border-t border-border/30 mt-4">
                    <p className="text-sm font-light text-center text-foreground">Build recurring income</p>
                  </div>
                </div>
              </SpotlightCard>
            </motion.div>

            {/* Founder Math */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <SpotlightCard className="p-8 h-full">
                <div className="flex items-center gap-3 mb-6">
                  <Package className="w-6 h-6 text-muted-foreground" />
                  <h3 className="text-xl font-light tracking-tight">Founder Scale</h3>
                </div>

                <div className="space-y-6">
                  <div className="p-4 rounded-lg bg-foreground/5 border border-border/30">
                    <p className="text-sm text-muted-foreground font-light mb-3">Imagine you have:</p>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-light">1,000</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Warlords selling</p>
                      </div>
                      <div>
                        <p className="text-2xl font-light">10</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">sales each/month</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-border/30 gap-2">
                      <span className="text-sm text-muted-foreground font-light shrink-0">Sales/month</span>
                      <span className="text-base sm:text-lg font-light text-foreground text-right">10,000</span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-border/30 gap-2">
                      <span className="text-sm text-muted-foreground font-light shrink-0">At ₹1,000/sale</span>
                      <span className="text-base sm:text-lg font-light text-foreground text-right">₹1,00,00,000</span>
                    </div>
                    <div className="flex items-center justify-between py-3 gap-2">
                      <span className="text-sm font-light shrink-0">Cost (30%)</span>
                      <span className="text-xl sm:text-2xl font-light text-foreground text-right">₹30,00,000</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground font-light text-center">
                    ₹1 Crore revenue for ₹30 Lakh CAC. Warlords pay the 5% platform fee from their commission.
                  </p>
                  <p className="text-xs text-muted-foreground font-light text-center">
                    You pay only on real, webhook-verified sales.
                  </p>
                  <div className="pt-4 border-t border-border/30 mt-4">
                    <p className="text-sm font-light text-center text-foreground">1,000 salespeople. Zero payroll.</p>
                  </div>
                </div>
              </SpotlightCard>
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 text-xs font-light text-muted-foreground/50 text-center"
          >
            *Commission rates and duration are set by founders. Platform takes 5% of the commission.
          </motion.p>
        </div>
      </section>
    </FadeInSection>
  )
}
