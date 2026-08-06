"use client"

import { useState, useEffect } from "react"
import { Joyride, STATUS, Step, TooltipRenderProps } from "react-joyride"
import { useAuth } from "@/components/auth-provider"
import { toast } from "sonner"

interface ProductTourProps {
    steps: Step[]
    tourType: 'seller' | 'founder'
    run: boolean
}

export function ProductTour({ steps, tourType, run: initialRun }: ProductTourProps) {
    const [run, setRun] = useState(false)
    const { refreshProfile } = useAuth()

    // Only start the tour after mount to avoid hydration mismatch
    useEffect(() => {
        if (initialRun) {
            // Slight delay to ensure all UI elements are rendered
            const timer = setTimeout(() => setRun(true), 500)
            return () => clearTimeout(timer)
        }
    }, [initialRun])

    const markTourComplete = async () => {
        setRun(false)
        console.log('[ProductTour] Marking tour complete directly from button click')
        try {
            const res = await fetch('/api/user/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tourType })
            })
            
            if (!res.ok) {
                throw new Error('API failed to update tour state')
            }

            // Refresh local profile state so it doesn't pop up again before a hard refresh
            await refreshProfile()
            toast.success("Tour finished! You won't see this again.")
        } catch (error) {
            console.error('Failed to save tour completion status:', error)
            toast.error("Failed to save tour state. It might appear again.")
        }
    }

    // Custom Tooltip using Black Index aesthetics, defined inside to access markTourComplete
    const CustomTooltip = ({
        index,
        step,
        backProps,
        closeProps,
        primaryProps,
        skipProps,
        tooltipProps,
        isLastStep,
    }: TooltipRenderProps) => {
        return (
            <div 
                {...tooltipProps} 
                className="bg-[#141414] border border-[#2a2a2a] rounded-xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] p-6 w-[350px] font-sans"
            >
                {step.title && <h3 className="text-lg font-light tracking-tight mb-2">{step.title}</h3>}
                <div className="text-sm text-muted-foreground font-light leading-relaxed mb-6">
                    {step.content}
                </div>
                
                <div className="flex items-center justify-between mt-4">
                    <button
                        {...skipProps}
                        onClick={(e) => {
                            markTourComplete()
                            if (skipProps.onClick) skipProps.onClick(e as any)
                        }}
                        className="text-xs font-light text-muted-foreground hover:text-white transition-colors"
                    >
                        Skip Tour
                    </button>
                    <div className="flex gap-2">
                        {index > 0 && (
                            <button
                                {...backProps}
                                className="px-4 py-2 text-xs font-light text-muted-foreground hover:text-white transition-all border border-[#2a2a2a] bg-white/5 rounded-lg hover:bg-white/10"
                            >
                                Back
                            </button>
                        )}
                        <button
                            {...primaryProps}
                            onClick={(e) => {
                                if (isLastStep) markTourComplete()
                                if (primaryProps.onClick) primaryProps.onClick(e as any)
                            }}
                            className="px-5 py-2 text-xs font-medium bg-white text-black rounded-lg hover:bg-white/90 transition-colors shadow-lg"
                        >
                            {isLastStep ? 'Finish' : 'Next'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const handleJoyrideCallback = async (data: any) => {
        const { status, type } = data
        console.log('Joyride Callback (Internal):', data)
        // We now handle completion directly in the button clicks, 
        // but we still stop the run state if Joyride naturally ends
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED]
        if (finishedStatuses.includes(status) || type === 'tour:end') {
            setRun(false)
        }
    }

    if (!run) return null

    const JoyrideComponent = Joyride as any

    return (
        <JoyrideComponent
            steps={steps}
            run={run}
            continuous={true}
            scrollToFirstStep={true}
            callback={handleJoyrideCallback}
            tooltipComponent={CustomTooltip}
            styles={{
                options: {
                    zIndex: 1000,
                    overlayColor: 'rgba(0, 0, 0, 0.85)',
                }
            } as any}
        />
    )
}
