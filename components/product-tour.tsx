"use client"

import { useState, useEffect } from "react"
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride"

interface ProductTourProps {
    steps: Step[]
    tourType: 'seller' | 'founder'
    run: boolean
}

export function ProductTour({ steps, tourType, run: initialRun }: ProductTourProps) {
    const [run, setRun] = useState(false)

    // Only start the tour after mount to avoid hydration mismatch
    useEffect(() => {
        if (initialRun) {
            // Slight delay to ensure all UI elements are rendered
            const timer = setTimeout(() => setRun(true), 500)
            return () => clearTimeout(timer)
        }
    }, [initialRun])

    const handleJoyrideCallback = async (data: CallBackProps) => {
        const { status } = data
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED]

        if (finishedStatuses.includes(status)) {
            setRun(false)
            
            // Mark tour as seen in database
            try {
                await fetch('/api/user/onboarding', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tourType })
                })
            } catch (error) {
                console.error('Failed to save tour completion status:', error)
            }
        }
    }

    if (!run) return null

    return (
        <Joyride
            steps={steps}
            run={run}
            continuous={true}
            scrollToFirstStep={true}
            showProgress={true}
            showSkipButton={true}
            callback={handleJoyrideCallback}
            styles={{
                options: {
                    primaryColor: '#ffffff', // Button color
                    textColor: '#ffffff',
                    backgroundColor: '#141414',
                    overlayColor: 'rgba(0, 0, 0, 0.85)',
                    zIndex: 1000,
                },
                tooltip: {
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                },
                tooltipContainer: {
                    textAlign: 'left',
                },
                buttonNext: {
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    fontSize: '14px',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontWeight: 500,
                },
                buttonBack: {
                    color: '#a1a1aa', // text-muted-foreground
                    marginRight: '10px',
                    fontSize: '14px',
                },
                buttonSkip: {
                    color: '#a1a1aa',
                    fontSize: '14px',
                },
                buttonClose: {
                    display: 'none', // Hide the tiny X in favor of the Skip button
                }
            }}
            locale={{
                last: 'Finish',
                skip: 'Skip Tour',
            }}
        />
    )
}
