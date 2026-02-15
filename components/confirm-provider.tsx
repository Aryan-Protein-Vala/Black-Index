"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface ConfirmOptions {
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    type?: "danger" | "warning" | "info"
}

interface ConfirmContextType {
    showConfirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | null>(null)

export function useConfirm() {
    const context = useContext(ConfirmContext)
    if (!context) {
        throw new Error("useConfirm must be used within ConfirmProvider")
    }
    return context
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [confirmState, setConfirmState] = useState<{
        options: ConfirmOptions
        resolve: (value: boolean) => void
    } | null>(null)

    const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setConfirmState({ options, resolve })
        })
    }, [])

    const handleConfirm = (result: boolean) => {
        if (confirmState) {
            confirmState.resolve(result)
            setConfirmState(null)
        }
    }

    return (
        <ConfirmContext.Provider value={{ showConfirm }}>
            {children}

            {/* Confirm Modal */}
            <AnimatePresence>
                {confirmState && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[250] flex items-center justify-center p-4"
                        onClick={() => handleConfirm(false)}
                    >
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-2xl">
                                <h3 className="text-lg font-light mb-2">{confirmState.options.title}</h3>
                                <p className="text-sm text-muted-foreground font-light mb-6">
                                    {confirmState.options.message}
                                </p>
                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={() => handleConfirm(false)}
                                        className="px-4 py-2 text-sm font-light rounded-lg border border-border/50 hover:bg-foreground/5 transition-colors"
                                    >
                                        {confirmState.options.cancelText || "Cancel"}
                                    </button>
                                    <button
                                        onClick={() => handleConfirm(true)}
                                        className={cn(
                                            "px-4 py-2 text-sm font-light rounded-lg transition-colors",
                                            confirmState.options.type === "danger"
                                                ? "bg-red-500 text-white hover:bg-red-600"
                                                : "bg-foreground text-background hover:bg-foreground/90"
                                        )}
                                    >
                                        {confirmState.options.confirmText || "Confirm"}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </ConfirmContext.Provider>
    )
}
