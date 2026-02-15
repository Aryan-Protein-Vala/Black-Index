import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Clock, Calendar, Share2, Twitter, Linkedin } from "lucide-react"
import { blogPosts, getBlogPost, BlogPost } from "@/lib/blog-data"
import { Logo } from "@/components/logo"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import { marked } from "marked"
import sanitizeHtml from "sanitize-html"

interface Props {
    params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
    return blogPosts.map((post) => ({
        slug: post.slug,
    }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const post = getBlogPost(slug)

    if (!post) {
        return { title: "Post Not Found" }
    }

    return {
        title: post.title,
        description: post.excerpt,
        keywords: post.keywords,
        openGraph: {
            type: "article",
            title: post.title,
            description: post.excerpt,
            publishedTime: post.publishedAt,
            authors: [post.author],
            images: [{ url: post.image, width: 1200, height: 630 }],
        },
        twitter: {
            card: "summary_large_image",
            title: post.title,
            description: post.excerpt,
            images: [post.image],
        },
    }
}

export default async function BlogPostPage({ params }: Props) {
    const { slug } = await params
    const post = getBlogPost(slug)

    if (!post) {
        notFound()
    }

    // Get related posts (same category, excluding current)
    const relatedPosts = blogPosts
        .filter(p => p.category === post.category && p.slug !== post.slug)
        .slice(0, 2)

    // SECURITY: Parse markdown and sanitize to prevent XSS attacks
    // sanitize-html removes any malicious scripts, event handlers, or dangerous HTML
    const rawHtml = await marked.parse(post.content)
    const htmlContent = sanitizeHtml(rawHtml, {
        allowedTags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'b', 'i', 'code', 'pre', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'span', 'div'],
        allowedAttributes: {
            'a': ['href', 'target', 'rel'],
            'img': ['src', 'alt', 'title'],
            '*': ['class', 'id']
        },
        allowedSchemes: ['http', 'https', 'mailto'],
    })

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
                <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/">
                        <Logo className="h-6" />
                    </Link>
                    <nav className="flex items-center gap-6">
                        <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            ← Back to Blog
                        </Link>
                        <Link href="/signup">
                            <button className="px-4 py-2 text-sm bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors">
                                Start Earning
                            </button>
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Article */}
            <article className="pt-32 pb-16 px-6">
                <div className="max-w-3xl mx-auto">
                    {/* Meta */}
                    <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
                        <span className="px-3 py-1 rounded-full bg-foreground/5">
                            {post.category}
                        </span>
                        <span className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {post.readTime} min read
                        </span>
                        <span className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {new Date(post.publishedAt).toLocaleDateString('en-IN', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                        </span>
                    </div>

                    {/* Title */}
                    <h1 className="text-3xl md:text-5xl font-light tracking-tight mb-6">
                        {post.title}
                    </h1>

                    {/* Excerpt */}
                    <p className="text-lg text-muted-foreground font-light mb-8 pb-8 border-b border-border/30">
                        {post.excerpt}
                    </p>

                    {/* Content */}
                    <div 
                        className="prose prose-invert prose-lg max-w-none
                            [&>*]:mb-6
                            prose-headings:font-light prose-headings:tracking-tight 
                            prose-headings:mt-12 prose-headings:mb-6
                            prose-h1:text-3xl prose-h1:mt-16 prose-h1:mb-8
                            prose-h2:text-2xl prose-h2:mt-14 prose-h2:mb-6 prose-h2:pt-6 prose-h2:border-t prose-h2:border-border/20
                            prose-h3:text-xl prose-h3:mt-10 prose-h3:mb-4 prose-h3:text-foreground
                            prose-p:text-muted-foreground prose-p:font-light prose-p:leading-relaxed prose-p:mb-6
                            prose-a:text-green-400 prose-a:no-underline hover:prose-a:underline
                            prose-strong:text-foreground prose-strong:font-medium
                            prose-blockquote:border-l-green-500 prose-blockquote:bg-foreground/5 prose-blockquote:py-6 prose-blockquote:px-8 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:my-8
                            prose-code:text-green-400 prose-code:bg-foreground/10 prose-code:px-2 prose-code:py-1 prose-code:rounded
                            prose-li:text-muted-foreground prose-li:font-light prose-li:mb-3 prose-li:leading-relaxed
                            prose-ul:my-6 prose-ul:space-y-2 prose-ol:my-6 prose-ol:space-y-2
                            prose-hr:my-12 prose-hr:border-border/30
                            prose-img:rounded-lg prose-img:my-8
                            [&_table]:w-full [&_table]:my-10 [&_table]:border-collapse [&_table]:border [&_table]:border-white/20 [&_table]:rounded-lg [&_table]:overflow-hidden
                            [&_thead]:bg-white/10
                            [&_th]:p-4 [&_th]:text-left [&_th]:font-medium [&_th]:text-white [&_th]:border-b [&_th]:border-white/20
                            [&_tr]:border-b [&_tr]:border-white/10 [&_tr:last-child]:border-b-0
                            [&_tbody_tr:hover]:bg-white/5
                            [&_td]:p-4 [&_td]:text-gray-400
                        "
                        dangerouslySetInnerHTML={{ __html: htmlContent }}
                    />

                    {/* Author & Share */}
                    <div className="mt-12 pt-8 border-t border-border/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 font-medium">
                                BI
                            </div>
                            <div>
                                <p className="font-light">{post.author}</p>
                                <p className="text-sm text-muted-foreground">Black Index Team</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">Share:</span>
                            <a
                                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`https://blackindex.in/blog/${post.slug}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 transition-colors"
                            >
                                <Twitter className="w-4 h-4" />
                            </a>
                            <a
                                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://blackindex.in/blog/${post.slug}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 transition-colors"
                            >
                                <Linkedin className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                </div>
            </article>

            {/* CTA */}
            <section className="px-6 pb-16">
                <div className="max-w-3xl mx-auto">
                    <SpotlightCard className="p-8 text-center bg-gradient-to-b from-green-500/10 to-transparent">
                        <h2 className="text-2xl font-light tracking-tight mb-4">
                            Ready to Start Earning?
                        </h2>
                        <p className="text-muted-foreground font-light mb-6">
                            Join India&apos;s #1 affiliate platform and earn up to 50% commission.
                        </p>
                        <Link href="/signup">
                            <button className="px-8 py-4 bg-green-500 text-black font-medium rounded-lg hover:bg-green-400 transition-colors">
                                Join Black Index Free
                            </button>
                        </Link>
                    </SpotlightCard>
                </div>
            </section>

            {/* Related Posts */}
            {relatedPosts.length > 0 && (
                <section className="px-6 pb-20">
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-xl font-light mb-6">Related Articles</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {relatedPosts.map(related => (
                                <Link key={related.slug} href={`/blog/${related.slug}`}>
                                    <SpotlightCard className="p-5 hover:border-green-500/30 transition-all group">
                                        <h3 className="font-light group-hover:text-green-400 transition-colors line-clamp-2 mb-2">
                                            {related.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {related.excerpt}
                                        </p>
                                    </SpotlightCard>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Footer */}
            <footer className="border-t border-border/30 py-8 px-6">
                <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <Logo className="h-5" />
                    <p className="text-sm text-muted-foreground">
                        © 2025 Black Index. All rights reserved.
                    </p>
                </div>
            </footer>

            {/* JSON-LD Structured Data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Article",
                        headline: post.title,
                        description: post.excerpt,
                        author: {
                            "@type": "Organization",
                            name: "Black Index"
                        },
                        publisher: {
                            "@type": "Organization",
                            name: "Black Index",
                            url: "https://blackindex.in"
                        },
                        datePublished: post.publishedAt,
                        keywords: post.keywords.join(", ")
                    })
                }}
            />
        </div>
    )
}

