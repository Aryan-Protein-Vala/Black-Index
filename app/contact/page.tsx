"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Mail, MapPin, Clock } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { SpotlightCard } from "@/components/ui/spotlight-card"

export default function ContactPage() {
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
                            <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Support</span>
                            <div className="w-8 h-px bg-muted-foreground/30" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-4">Contact Us</h1>
                        <p className="text-muted-foreground font-light">We're here to help. Reach out to us through any of the channels below.</p>
                    </motion.div>

                    <div className="grid gap-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                        >
                            <SpotlightCard className="p-8">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-lg bg-green-500/10">
                                        <Mail className="w-6 h-6 text-green-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-light tracking-tight mb-2">Email Support</h2>
                                        <p className="text-muted-foreground font-light mb-4">
                                            For general inquiries, support, or partnership opportunities.
                                        </p>
                                        <a
                                            href="mailto:aryansharma24112003@gmail.com"
                                            className="text-foreground hover:text-green-400 transition-colors font-medium"
                                        >
                                            aryansharma24112003@gmail.com
                                        </a>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                        >
                            <SpotlightCard className="p-8">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-lg bg-blue-500/10">
                                        <Clock className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-light tracking-tight mb-2">Response Time</h2>
                                        <p className="text-muted-foreground font-light">
                                            We typically respond within 24-48 hours during business days. For urgent matters, please mention "URGENT" in your subject line.
                                        </p>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                        >
                            <SpotlightCard className="p-8">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-lg bg-purple-500/10">
                                        <MapPin className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-light tracking-tight mb-2">Location</h2>
                                        <p className="text-muted-foreground font-light">
                                            Black Index operates remotely across India.
                                        </p>
                                    </div>
                                </div>
                            </SpotlightCard>
                        </motion.div>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className="mt-16"
                    >
                        <SpotlightCard className="p-8 text-center">
                            <h2 className="text-xl font-light tracking-tight mb-4">Quick Links</h2>
                            <div className="flex flex-wrap justify-center gap-4">
                                <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                                    Terms of Service
                                </Link>
                                <span className="text-muted-foreground/30">•</span>
                                <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                                    Privacy Policy
                                </Link>
                                <span className="text-muted-foreground/30">•</span>
                                <Link href="/refunds" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                                    Refund Policy
                                </Link>
                                <span className="text-muted-foreground/30">•</span>
                                <Link href="/disclaimer" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                                    Disclaimer
                                </Link>
                            </div>
                        </SpotlightCard>
                    </motion.div>
                </div>
            </main>
        </div>
    )
}
