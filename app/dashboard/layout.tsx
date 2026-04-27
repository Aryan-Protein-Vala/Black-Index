import type React from "react"
import { Footer } from "@/components/sections/footer"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <Footer showCopyright={false} />
    </>
  )
}
