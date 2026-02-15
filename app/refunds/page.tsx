"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"

const sections = [
    {
        title: "Refund Policy",
        content:
            "Black Index operates on a performance-based model. Founder upgrade fees are non-refundable once the upgrade is processed and access is granted. This is because the service (platform access and listing capabilities) is delivered immediately upon payment verification.",
    },
    {
        title: "Cancellation of Founder Account",
        content:
            "Founders may request to deactivate their products at any time through the dashboard. Deactivating products will stop new affiliate links from being generated but will not affect existing referral relationships or pending commissions.",
    },
    {
        title: "Commission Disputes",
        content:
            "If you believe a commission was incorrectly calculated or not credited, please contact us within 30 days of the transaction. We will investigate and, if an error is confirmed, correct the balance accordingly.",
    },
    {
        title: "Chargebacks and Fraud",
        content:
            "If a customer initiates a chargeback on a purchase made through an affiliate link, the associated commission may be reversed. Repeated fraudulent activity may result in account termination.",
    },
    {
        title: "Exceptional Circumstances",
        content:
            "In cases of technical errors, duplicate charges, or other exceptional circumstances, refunds may be considered on a case-by-case basis. Please contact us with details and proof of the issue.",
    },
    {
        title: "How to Request a Refund",
        content:
            "To request a refund or discuss a billing issue, please email us at aryansharma24112003@gmail.com with your registered email, transaction ID, and a description of the issue. We will respond within 3-5 business days.",
    },
]

export default function RefundsPage() {
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
                        <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-4">Cancellation & Refunds</h1>
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
                            Questions about refunds? Contact us at <span className="text-foreground">aryansharma24112003@gmail.com</span>
                        </p>
                    </motion.div>
                </div>
            </main>
        </div>
    )
}
