import { MetadataRoute } from 'next'

// Blog posts - will be used for sitemap
const blogPosts = [
    { slug: 'how-to-make-money-online-2025', lastModified: new Date('2024-12-29') },
    { slug: 'easy-ways-to-earn-passive-income', lastModified: new Date('2024-12-29') },
    { slug: 'affiliate-marketing-beginners-guide', lastModified: new Date('2024-12-29') },
    { slug: 'best-side-hustles-india-2025', lastModified: new Date('2024-12-29') },
    { slug: 'earn-money-from-home-no-investment', lastModified: new Date('2024-12-29') },
    { slug: 'passive-income-ideas-students', lastModified: new Date('2024-12-29') },
]

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://blackindex.in'

    // Static pages
    const staticPages = [
        { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1 },
        { url: `${baseUrl}/login`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.5 },
        { url: `${baseUrl}/signup`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.6 },
        { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
        { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'yearly' as const, priority: 0.3 },
        { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'yearly' as const, priority: 0.3 },
    ]

    // Blog posts
    const blogPages = blogPosts.map(post => ({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: post.lastModified,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
    }))

    return [...staticPages, ...blogPages]
}
