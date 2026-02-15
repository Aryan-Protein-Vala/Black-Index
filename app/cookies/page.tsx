"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"

const sections = [
  {
    title: "What Are Cookies",
    content:
      "Cookies are small text files stored on your device when you visit our website. They help us remember your preferences, understand how you use our platform, and improve your overall experience.",
  },
  {
    title: "Essential Cookies",
    content:
      "These cookies are necessary for the website to function properly. They enable core features like user authentication, session management, and security. You cannot opt out of essential cookies.",
  },
  {
    title: "Analytics Cookies",
    content:
      "We use analytics cookies to understand how visitors interact with our platform. This helps us improve our services, identify popular features, and optimize user experience. All data is anonymized.",
  },
  {
    title: "Functional Cookies",
    content:
      "Functional cookies remember your choices and preferences, such as language settings and display options. They provide a more personalized experience without tracking your activity across other websites.",
  },
  {
    title: "Marketing Cookies",
    content:
      "With your consent, we may use marketing cookies to deliver relevant advertisements and measure campaign effectiveness. These cookies may track your activity across different websites.",
  },
  {
    title: "Managing Cookies",
    content:
      "You can control and delete cookies through your browser settings. Note that disabling certain cookies may affect the functionality of our platform. Each browser has different cookie management options.",
  },
  {
    title: "Third-Party Cookies",
    content:
      "Some cookies are placed by third-party services that appear on our pages, such as embedded content or analytics providers. We do not control these cookies and recommend reviewing their privacy policies.",
  },
]

export default function CookiesPage() {
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
            <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-4">Cookie Policy</h1>
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
              Questions about cookies? Contact us at <span className="text-foreground">aryansharma24112003@gmail.com</span>
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
