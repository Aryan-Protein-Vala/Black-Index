"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Layers, Workflow, TrendingUp, Package, Trophy, UserPlus } from "lucide-react"
import { Logo } from "@/components/logo"

const navItems = [
  { id: "overview", label: "Overview", icon: Layers },
  { id: "how-it-works", label: "How It Works", icon: Workflow },
  { id: "earnings", label: "Earnings", icon: TrendingUp },
  { id: "products", label: "Products", icon: Package },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "join", label: "Join", icon: UserPlus },
]

export function VerticalNav() {
  const [activeSection, setActiveSection] = useState("overview")

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      { threshold: 0.5 },
    )

    navItems.forEach((item) => {
      const element = document.getElementById(item.id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <nav className="fixed left-0 top-0 h-full w-20 lg:w-56 bg-sidebar/80 backdrop-blur-xl border-r border-border/50 z-50 flex flex-col">
      <div className="p-4 lg:p-6 border-b border-border/30">
        <Logo showText={true} className="hidden lg:flex" />
        <Logo showText={false} className="flex lg:hidden justify-center" />
      </div>

      <ul className="flex-1 flex flex-col justify-center space-y-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          return (
            <li key={item.id}>
              <button
                onClick={() => scrollToSection(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-300 group",
                  isActive
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5",
                )}
              >
                <Icon className={cn("w-5 h-5 transition-all duration-300", isActive && "text-foreground")} />
                <span
                  className={cn(
                    "hidden lg:block text-sm font-light tracking-tight transition-all duration-300",
                    isActive && "font-normal",
                  )}
                >
                  {item.label}
                </span>
                {isActive && <div className="hidden lg:block ml-auto w-1 h-1 rounded-full bg-foreground" />}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
