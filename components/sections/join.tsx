"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight, UserPlus, LogIn } from "lucide-react"
import { FadeInSection } from "@/components/ui/fade-in-section"
import Link from "next/link"

export function JoinSection() {
  return (
    <FadeInSection>
      <section id="join" className="min-h-screen flex items-center justify-center px-6 lg:px-12">
        <div className="max-w-xl w-full text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center gap-3 mb-12"
          >
            <div className="w-8 h-px bg-muted-foreground/30" />
            <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Join</span>
            <div className="w-8 h-px bg-muted-foreground/30" />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl md:text-4xl font-light tracking-tight mb-4 text-balance"
          >
            Ready to Start Earning?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-muted-foreground font-light mb-12"
          >
            Join the network and unlock your earning potential.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link href="/signup">
              <Button className="h-12 px-8 text-sm font-normal tracking-tight bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 group shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                <UserPlus className="mr-2 w-4 h-4" />
                Create Account
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </Button>
            </Link>
            <Link href="/login">
              <Button
                variant="outline"
                className="h-12 px-8 text-sm font-normal tracking-tight border-border/50 hover:bg-foreground/5 transition-all duration-300 group bg-transparent"
              >
                <LogIn className="mr-2 w-4 h-4" />
                Sign In
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </Button>
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 text-xs text-muted-foreground/60 font-light"
          >
            By joining, you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-4 hover:text-foreground transition-colors">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
          </motion.p>
        </div>
      </section>
    </FadeInSection>
  )
}
