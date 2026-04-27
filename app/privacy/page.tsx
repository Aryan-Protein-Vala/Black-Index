"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { Footer } from "@/components/sections/footer"

const sections = [
  {
    title: "1. Information We Collect",
    content:
      "We collect information you provide directly, including name, email address, payment details, and profile information. We also automatically collect usage data, device information, and cookies when you interact with our platform.",
  },
  {
    title: "2. How We Use Your Information",
    content:
      "Your information is used to provide and improve our services, process payments, communicate with you, prevent fraud, and comply with legal obligations. We may also use anonymized data for analytics and platform optimization.",
  },
  {
    title: "3. Information Sharing",
    content:
      "We do not sell your personal information. We may share data with service providers who assist in operating our platform, with your consent, or when required by law. Partners receive only the data necessary to fulfill their services.",
  },
  {
    title: "4. Data Security",
    content:
      "We implement industry-standard security measures including encryption, secure servers, and regular security audits. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.",
  },
  {
    title: "5. Your Rights",
    content:
      "You have the right to access, correct, or delete your personal data. You may also opt out of marketing communications and request data portability. To exercise these rights, contact our privacy team.",
  },
  {
    title: "6. Cookies and Tracking",
    content:
      "We use cookies and similar technologies to enhance your experience, analyze usage patterns, and deliver personalized content. You can manage cookie preferences through your browser settings.",
  },
  {
    title: "7. Data Retention",
    content:
      "We retain your information for as long as your account is active or as needed to provide services. After account deletion, we may retain certain data as required by law or for legitimate business purposes.",
  },
  {
    title: "8. International Transfers",
    content:
      "Your data may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for such transfers in compliance with applicable data protection laws.",
  },
  {
    title: "9. Children's Privacy",
    content:
      "Our services are not intended for individuals under 18. We do not knowingly collect personal information from children. If we learn we have collected such information, we will delete it promptly.",
  },
  {
    title: "10. Changes to This Policy",
    content:
      "We may update this privacy policy periodically. We will notify you of material changes via email or platform notification. Your continued use after changes constitutes acceptance of the updated policy.",
  },
]

export default function PrivacyPage() {
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
            <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-4">Privacy Policy</h1>
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
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-16 pt-12 border-t border-border/30"
          >
            <p className="text-sm text-muted-foreground/60 font-light">
              Privacy concerns? Contact us at <span className="text-foreground">aryansharma24112003@gmail.com</span>
            </p>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
