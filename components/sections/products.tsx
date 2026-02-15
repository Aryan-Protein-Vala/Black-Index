"use client"

import { motion } from "framer-motion"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import { FadeInSection } from "@/components/ui/fade-in-section"

const products = [
  {
    category: "SaaS",
    price: "₹999/mo",
    commission: "30%",
    avgPayout: "₹299",
  },
  {
    category: "Services",
    price: "₹15,000",
    commission: "20%",
    avgPayout: "₹3,000",
  },
  {
    category: "Subscriptions",
    price: "₹499/mo",
    commission: "40%",
    avgPayout: "₹199",
  },
]

export function ProductsSection() {
  return (
    <FadeInSection>
      <section id="products" className="min-h-screen flex items-center justify-center px-6 lg:px-12 py-24">
        <div className="max-w-5xl w-full">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 mb-16"
          >
            <div className="w-8 h-px bg-muted-foreground/30" />
            <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Products</span>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {products.map((product, index) => (
              <motion.div
                key={product.category}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <SpotlightCard className="p-8">
                  <h3 className="text-xl font-normal tracking-tight mb-8">{product.category}</h3>

                  <div className="space-y-4">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-light text-muted-foreground uppercase tracking-wider">Price</span>
                      <span className="text-sm font-light">{product.price}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-light text-muted-foreground uppercase tracking-wider">
                        Commission
                      </span>
                      <span className="text-sm font-light text-foreground">{product.commission}</span>
                    </div>
                    <div className="h-px bg-border/50" />
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-light text-muted-foreground uppercase tracking-wider">
                        Avg Payout
                      </span>
                      <span className="text-lg font-normal">{product.avgPayout}</span>
                    </div>
                  </div>
                </SpotlightCard>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 text-xs font-light text-muted-foreground/50 text-center"
          >
            *Commissions shown are for illustration only. Actual rates may be higher or lower as set by founders.
          </motion.p>
        </div>
      </section>
    </FadeInSection>
  )
}
