"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"

const sections = [
  {
    title: "General Disclaimer",
    content:
      "The information provided on Black Index's platform is for general informational purposes only. While we strive to keep information accurate and up-to-date, we make no representations or warranties of any kind about the completeness, accuracy, reliability, or availability of the platform or information contained therein.",
  },
  {
    title: "Earnings Disclaimer",
    content:
      "Earnings displayed on our platform represent potential income and are not guaranteed. Individual results vary based on effort, market conditions, product selection, and other factors. Past performance does not guarantee future results. Any earnings figures are estimates only.",
  },
  {
    title: "No Financial Advice",
    content:
      "Nothing on this platform constitutes financial, legal, or professional advice. You should consult with appropriate professionals before making any financial decisions. Black Index is not responsible for decisions made based on information provided on our platform.",
  },
  {
    title: "Product Information",
    content:
      "Product descriptions, prices, and availability are subject to change without notice. We do not guarantee the accuracy of product information provided by third-party partners. Always verify details directly with the product source before promotion.",
  },
  {
    title: "Third-Party Links",
    content:
      "Our platform may contain links to third-party websites. We do not control and are not responsible for the content, privacy policies, or practices of any third-party sites. Visiting these sites is at your own risk.",
  },
  {
    title: "Platform Availability",
    content:
      "We do not guarantee that our platform will be available at all times or operate without interruption. We may suspend or terminate access for maintenance, security, or other reasons without prior notice.",
  },
  {
    title: "Limitation of Liability",
    content:
      "To the maximum extent permitted by law, Black Index shall not be liable for any damages arising from the use or inability to use our platform. This includes direct, indirect, incidental, consequential, and punitive damages.",
  },
]

export default function DisclaimerPage() {
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
            <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-4">Disclaimer</h1>
            <p className="text-muted-foreground font-light">Last updated: December 2024</p>
          </motion.div>

          <div className="space-y-12">
            {sections.map((section, index) => (
              <motion.section
                key={section.title}
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
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-16 pt-12 border-t border-border/30"
          >
            <p className="text-sm text-muted-foreground/60 font-light">
              Questions? Contact us at <span className="text-foreground">aryansharma24112003@gmail.com</span>
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
