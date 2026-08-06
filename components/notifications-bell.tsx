"use client"

import { useState, useEffect } from "react"
import { Bell, Check, X } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { motion, AnimatePresence } from "framer-motion"

interface Notification {
    id: string
    title: string
    message: string
    type: string
    read: boolean
    created_at: string
}

export function NotificationsBell() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const supabase = createClient()

    useEffect(() => {
        fetchNotifications()

        const interval = setInterval(fetchNotifications, 60000)
        window.addEventListener("focus", fetchNotifications)

        return () => {
            clearInterval(interval)
            window.removeEventListener("focus", fetchNotifications)
        }
    }, [])

    const fetchNotifications = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20)

        if (data) {
            setNotifications(data)
            setUnreadCount(data.filter((n: any) => !n.read).length)
        }
    }

    const markAsRead = async (id: string) => {
        await supabase.from("notifications").update({ read: true } as never).eq("id", id)
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
        setUnreadCount((prev) => Math.max(0, prev - 1))
    }

    const markAllAsRead = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase.from("notifications").update({ read: true } as never).eq("user_id", user.id).eq("read", false)
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        setUnreadCount(0)
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-foreground/5 transition-colors"
            >
                <Bell className="w-5 h-5 text-muted-foreground" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full">
                        {unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 mt-2 w-80 bg-background border border-border/50 rounded-xl shadow-xl z-50 overflow-hidden"
                        >
                            <div className="p-4 border-b border-border/50 flex justify-between items-center bg-foreground/[0.02]">
                                <h3 className="font-light">Notifications</h3>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                    >
                                        <Check className="w-3 h-3" /> Mark all read
                                    </button>
                                )}
                            </div>

                            <div className="max-h-96 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground text-sm">
                                        No notifications yet
                                    </div>
                                ) : (
                                    notifications.map((n) => (
                                        <div
                                            key={n.id}
                                            onClick={() => !n.read && markAsRead(n.id)}
                                            className={`p-4 border-b border-border/10 hover:bg-foreground/[0.02] cursor-pointer transition-colors ${!n.read ? "bg-foreground/[0.03]" : ""}`}
                                        >
                                            <div className="flex justify-between items-start gap-4">
                                                <div>
                                                    <h4 className={`text-sm ${!n.read ? "font-medium" : "font-light text-muted-foreground"}`}>
                                                        {n.title}
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                        {n.message}
                                                    </p>
                                                    <span className="text-[10px] text-muted-foreground mt-2 block">
                                                        {new Date(n.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                {!n.read && (
                                                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1 flex-shrink-0" />
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
