"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { Footer } from "@/components/sections/footer"

const sections = [
  {
    title: "1. Acceptance of Terms",
    content:
      "By accessing and using Black Index's services, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree to these terms, you may not access or use our services.",
  },
  {
    title: "2. Description of Service",
    content:
      "Black Index provides a performance-based sales network that connects sellers with premium products. Our platform enables users to generate revenue through successful sales referrals and affiliate partnerships.",
  },
  {
    title: "3. User Accounts",
    content:
      "To access certain features of our service, you must register for an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete.",
  },
  {
    title: "4. Earnings and Payments",
    content:
      "Commissions are earned based on verified sales made through your unique referral links. Payments are processed monthly for balances exceeding the minimum threshold. Black Index reserves the right to withhold payments pending fraud verification.",
  },
  {
    id: "recurring-commission",
    title: "4.1 Recurring Commission ('Forever')",
    content:
      "When we say 'Sell once, earn forever', we mean that Warlords earn recurring commissions for as long as the customer they referred continues to pay for their subscription. 'Forever' refers to the lifetime of the customer's active subscription with the Founder's product. Recurring commissions are subject to: (a) the customer maintaining an active paid subscription, (b) the Founder continuing to offer recurring commissions on their product, (c) the Warlord maintaining an active account in good standing, and (d) the product remaining listed on Black Index. Commission rates and structures may be modified by Founders with 30 days notice.",
  },
  {
    title: "5. Prohibited Conduct",
    content:
      "Users may not engage in fraudulent activities, spam marketing, misrepresentation of products, or any conduct that violates applicable laws. Violation of these terms may result in immediate account termination.",
  },
  {
    title: "6. Intellectual Property",
    content:
      "All content, trademarks, and intellectual property on the Black Index platform remain the exclusive property of Black Index. Users are granted a limited, non-exclusive license to use the platform for its intended purpose.",
  },
  {
    title: "7. Limitation of Liability",
    content:
      "Black Index shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service. Our total liability shall not exceed the amount paid to you in the preceding twelve months.",
  },
  {
    title: "8. Modifications",
    content:
      "Black Index reserves the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the modified terms. Material changes will be communicated via email or platform notification.",
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="grain-overlay" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-12 py-6 flex items-center justify-between bg-background/80 backdrop-blur-xl border-b border-border/50"
      >
        <Link href="/">
          <Logo showText={true} />
        </Link>
        <Link href="/">
          <Button
            variant="ghost"
            className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-2 w-4 h-4" />
            Back
          </Button>
        </Link>
      </motion.header>

      {/* Content */}
      <main className="pt-32 pb-24 px-6 lg:px-12">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-16"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-px bg-muted-foreground/30" />
              <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Legal</span>
              <div className="w-8 h-px bg-muted-foreground/30" />
            </div>
            <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-4">Terms of Service</h1>
            <p className="text-muted-foreground font-light">Last updated: December 2024</p>
          </motion.div>

          <div className="space-y-12">
            {sections.map((section, index) => (
              <motion.section
                key={section.title}
                id={(section as any).id || undefined}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 + index * 0.05 }}
              >
                <h2 className="text-xl font-light tracking-tight mb-4">{section.title}</h2>
                <p className="text-muted-foreground font-light leading-relaxed">{section.content}</p>
              </motion.section>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-16 pt-12 border-t border-border/30"
          >
            <p className="text-sm text-muted-foreground/60 font-light">
              Questions about these terms? Contact us at <span className="text-foreground">aryansharma24112003@gmail.com</span>
            </p>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
