import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "sonner"
import "./globals.css"
import { ScrollToTop } from "@/components/scroll-to-top"
import { AuthProvider } from "@/components/auth-provider"
import { ConfirmProvider } from "@/components/confirm-provider"
import Script from "next/script"

export const metadata: Metadata = {
  title: {
    default: "Black Index | The Sales Network of the Internet",
    template: "%s | Black Index"
  },
  description: "Black Index is the sales network of the internet. Connect products with people. Sell through content, referrals, UGC, or any way you want. Founders set the commissions, you earn your share.",
  keywords: [
    "black index",
    "sales network",
    "make money online",
    "earn money online india",
    "passive income",
    "content creators",
    "earn from home",
    "side hustle india",
    "online income 2025",
    "commission based sales",
    "performance marketing",
    "influencer earnings"
  ],
  authors: [{ name: "Black Index" }],
  creator: "Black Index",
  publisher: "Black Index",
  metadataBase: new URL("https://blackindex.in"),
  alternates: {
    canonical: "https://blackindex.in"
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://blackindex.in",
    siteName: "Black Index",
    title: "Black Index | The Sales Network of the Internet",
    description: "The sales network connecting products with people. Sell through content, referrals, UGC, or any way you want.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Black Index - The Sales Network of the Internet"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Black Index | The Sales Network of the Internet",
    description: "The sales network connecting products with people. Sell your way, earn your share.",
    images: ["/og-image.png"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.svg",
        media: "(prefers-color-scheme: light)",
        type: "image/svg+xml",
      },
      {
        url: "/icon-dark-32x32.svg",
        media: "(prefers-color-scheme: dark)",
        type: "image/svg+xml",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.svg",
  },
  // verification: {
  //   google: "your-google-verification-code", // TODO: Add real Google Search Console verification
  // }
}

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
}

// JSON-LD structured data for Google Search (logo + organization)
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Black Index",
  "url": "https://blackindex.in",
  "logo": "https://blackindex.in/logo.png",
  "description": "The Sales Network of the Internet. Connect products with people. Sell your way.",
  "sameAs": [],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "email": "support@blackindex.in"
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased">
        <AuthProvider>
          <ConfirmProvider>
            <ScrollToTop />
            <div className="grain-overlay" />
            {children}
            <Toaster
              position="top-center"
              toastOptions={{
                style: {
                  background: '#1a1a1a',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                },
              }}
            />
            <Analytics />
            <Script src="/track.js" strategy="afterInteractive" />
          </ConfirmProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
