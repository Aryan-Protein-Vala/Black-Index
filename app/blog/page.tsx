"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowRight, Clock, Calendar, TrendingUp, Sparkles } from "lucide-react"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import { blogPosts } from "@/lib/blog-data"
import { Logo } from "@/components/logo"

export default function BlogPage() {
    const categories = ["All", "Money Making", "Passive Income", "Affiliate Marketing", "Side Hustles", "Students"]

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/">
                        <Logo className="h-6" />
                    </Link>
                    <nav className="flex items-center gap-6">
                        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            Home
                        </Link>
                        <Link href="/blog" className="text-sm text-foreground font-medium">
                            Blog
                        </Link>
                        <Link href="/signup">
                            <button className="px-4 py-2 text-sm bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors">
                                Start Earning
                            </button>
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Hero Section */}
            <section className="pt-32 pb-16 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-400 text-sm mb-6"
                    >
                        <TrendingUp className="w-4 h-4" />
                        Learn How to Make Money Online
                    </motion.div>
                    
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-6xl font-light tracking-tight mb-6"
                    >
                        The Black Index <span className="text-green-400">Blog</span>
                    </motion.h1>
                    
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-lg text-muted-foreground font-light max-w-2xl mx-auto"
                    >
                        Your guide to making money online, passive income, and affiliate marketing. 
                        Real strategies that actually work in 2025.
                    </motion.p>
                </div>
            </section>

            {/* Featured Post */}
            <section className="px-6 pb-16">
                <div className="max-w-6xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <Link href={`/blog/${blogPosts[0].slug}`}>
                            <SpotlightCard className="p-8 md:p-12 hover:border-green-500/30 transition-all group">
                                <div className="flex items-center gap-2 mb-4">
                                    <Sparkles className="w-4 h-4 text-amber-400" />
                                    <span className="text-xs text-amber-400 uppercase tracking-wider">Featured Post</span>
                                </div>
                                <h2 className="text-2xl md:text-4xl font-light tracking-tight mb-4 group-hover:text-green-400 transition-colors">
                                    {blogPosts[0].title}
                                </h2>
                                <p className="text-muted-foreground font-light mb-6 max-w-3xl">
                                    {blogPosts[0].excerpt}
                                </p>
                                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        {blogPosts[0].readTime} min read
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        {new Date(blogPosts[0].publishedAt).toLocaleDateString('en-IN', { 
                                            month: 'short', 
                                            day: 'numeric', 
                                            year: 'numeric' 
                                        })}
                                    </span>
                                    <span className="px-3 py-1 rounded-full bg-foreground/5 text-xs">
                                        {blogPosts[0].category}
                                    </span>
                                </div>
                            </SpotlightCard>
                        </Link>
                    </motion.div>
                </div>
            </section>

            {/* All Posts Grid */}
            <section className="px-6 pb-20">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-2xl font-light tracking-tight mb-8">All Articles</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {blogPosts.slice(1).map((post, i) => (
                            <motion.div
                                key={post.slug}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * i }}
                            >
                                <Link href={`/blog/${post.slug}`}>
                                    <SpotlightCard className="p-6 h-full flex flex-col hover:border-green-500/30 transition-all group">
                                        <span className="text-xs px-3 py-1 rounded-full bg-foreground/5 text-muted-foreground w-fit mb-4">
                                            {post.category}
                                        </span>
                                        <h3 className="text-lg font-light tracking-tight mb-3 group-hover:text-green-400 transition-colors line-clamp-2">
                                            {post.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground font-light mb-4 line-clamp-3 flex-1">
                                            {post.excerpt}
                                        </p>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border/30">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {post.readTime} min
                                            </span>
                                            <span className="flex items-center gap-1 text-green-400 group-hover:gap-2 transition-all">
                                                Read <ArrowRight className="w-3 h-3" />
                                            </span>
                                        </div>
                                    </SpotlightCard>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="px-6 pb-20">
                <div className="max-w-4xl mx-auto">
                    <SpotlightCard className="p-8 md:p-12 text-center bg-gradient-to-b from-green-500/5 to-transparent">
                        <h2 className="text-2xl md:text-3xl font-light tracking-tight mb-4">
                            Ready to Start Making Money?
                        </h2>
                        <p className="text-muted-foreground font-light mb-8 max-w-xl mx-auto">
                            Join Black Index today and start earning up to 50% commission on every sale.
                            It&apos;s free to join and takes less than 2 minutes.
                        </p>
                        <Link href="/signup">
                            <button className="px-8 py-4 bg-green-500 text-black font-medium rounded-lg hover:bg-green-400 transition-colors">
                                Start Earning Now - It&apos;s Free
                            </button>
                        </Link>
                    </SpotlightCard>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-border/30 py-8 px-6">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <Logo className="h-5" />
                    <p className="text-sm text-muted-foreground">
                        © 2025 Black Index. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    )
}
