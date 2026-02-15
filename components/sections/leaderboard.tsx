"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Trophy, Medal, Award } from "lucide-react"
import { FadeInSection } from "@/components/ui/fade-in-section"

const leaders = [
  { rank: 1, name: "Priya Sharma", earnings: "₹42,850", badge: "Diamond" },
  { rank: 2, name: "Rahul Verma", earnings: "₹31,200", badge: "Platinum" },
  { rank: 3, name: "Ankit Patel", earnings: "₹24,600", badge: "Gold" },
  { rank: 4, name: "Sarah Williams", earnings: "₹18,400", badge: "Silver" },
  { rank: 5, name: "Vikram Singh", earnings: "₹12,750", badge: "Bronze" },
  { rank: 6, name: "Neha Gupta", earnings: "₹9,320", badge: "Bronze" },
  { rank: 7, name: "James Chen", earnings: "₹7,100", badge: "Bronze" },
]

const getBadgeIcon = (rank: number) => {
  if (rank === 1) return Trophy
  if (rank === 2) return Medal
  return Award
}

export function LeaderboardSection() {
  return (
    <FadeInSection>
      <section id="leaderboard" className="min-h-screen flex items-center justify-center px-6 lg:px-12 py-24">
        <div className="max-w-3xl w-full">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 mb-16"
          >
            <div className="w-8 h-px bg-muted-foreground/30" />
            <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Leaderboard</span>
          </motion.div>

          <div className="space-y-3">
            {leaders.map((leader, index) => {
              const Icon = getBadgeIcon(leader.rank)
              return (
                <motion.div
                  key={leader.rank}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                  whileHover={{ x: 4 }}
                  className={cn(
                    "group flex items-center justify-between p-5 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm",
                    "transition-all duration-300 hover:border-border hover:bg-card/50",
                    leader.rank === 1 && "border-foreground/20",
                  )}
                >
                  <div className="flex items-center gap-5">
                    <span
                      className={cn(
                        "w-8 text-center text-sm font-light",
                        leader.rank === 1 && "text-foreground font-normal",
                      )}
                    >
                      #{leader.rank}
                    </span>
                    <span className="text-sm font-light tracking-tight">{leader.name}</span>
                  </div>

                  <div className="flex items-center gap-6">
                    <span
                      className={cn(
                        "text-sm font-light tabular-nums",
                        leader.rank === 1 && "text-foreground font-normal",
                      )}
                    >
                      {leader.earnings}
                    </span>
                    <div className="flex items-center gap-2">
                      <Icon
                        className={cn("w-4 h-4", leader.rank === 1 ? "text-foreground" : "text-muted-foreground/50")}
                      />
                      <span className="text-xs font-light text-muted-foreground hidden sm:block">{leader.badge}</span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-8 text-xs font-light text-muted-foreground/50 text-center"
          >
            Updated in real-time
          </motion.p>
        </div>
      </section>
    </FadeInSection>
  )
}
