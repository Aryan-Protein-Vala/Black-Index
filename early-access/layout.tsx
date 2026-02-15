import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Early Access | Black Index",
    description: "Join the Black Index waitlist. The performance-based sales network where products meet results.",
}

export default function EarlyAccessLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
