import { createAdminClient } from '@/lib/supabase-server'
import { FadeInSection } from '@/components/ui/fade-in-section'

export const metadata = {
    title: 'Blacklist — Black Index',
    description: 'Public transparency list of sellers and products banned from the Black Index network.',
}

/**
 * /blacklist — public transparency page.
 * Shows ONLY: display_name, product_name, offense_code, date.
 * No entity column, no extra PII, and an appeal mailto line.
 */
export default async function BlacklistPage() {
    let entries: { display_name: string; product_name: string | null; offense_code: string; created_at: string }[] = []
    let error = false

    try {
        const supabase = createAdminClient()
        const { data, error: fetchError } = await supabase
            .from('blacklist')
            .select('display_name, product_name, offense_code, created_at')
            .order('created_at', { ascending: false })
            .limit(200)

        if (fetchError) throw fetchError
        entries = (data as any[]) || []
    } catch (err) {
        console.error('Blacklist page error:', err)
        error = true
    }

    const offenseLabels: Record<string, string> = {
        dispute_rate: 'Dispute-rate abuse',
        fraud: 'Confirmed fraud',
        chargeback: 'Chargeback abuse',
        other: 'Policy violation',
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-4xl mx-auto px-6 py-24">
                <FadeInSection>
                    <div className="mb-12">
                        <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Transparency</span>
                        <h1 className="text-4xl font-light tracking-tight mt-2 mb-4">The Blacklist</h1>
                        <p className="text-muted-foreground font-light max-w-2xl">
                            Sellers and products removed from the Black Index network for confirmed fraud,
                            fake bookings, or abuse of the escrow system. We publish this so founders can
                            trust every Warlord they onboard.
                        </p>
                    </div>

                    {error ? (
                        <div className="p-6 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                            Could not load the blacklist right now. Please try again shortly.
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="p-6 rounded-lg bg-foreground/5 border border-border/30 text-sm text-muted-foreground">
                            The blacklist is currently empty. Every entry here is a seller who was banned — let&apos;s keep it that way.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-border/30">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/30 bg-foreground/[0.03]">
                                        <th className="text-left font-light text-muted-foreground px-4 py-3">Name</th>
                                        <th className="text-left font-light text-muted-foreground px-4 py-3">Product</th>
                                        <th className="text-left font-light text-muted-foreground px-4 py-3">Offense</th>
                                        <th className="text-left font-light text-muted-foreground px-4 py-3">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry, i) => (
                                        <tr key={i} className="border-b border-border/20 last:border-0">
                                            <td className="px-4 py-3 font-light">{entry.display_name}</td>
                                            <td className="px-4 py-3 text-muted-foreground font-light">{entry.product_name || '—'}</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                                                    {offenseLabels[entry.offense_code] || entry.offense_code}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground font-light">
                                                {new Date(entry.created_at).toLocaleDateString('en-IN', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric',
                                                })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="mt-10 p-6 rounded-lg bg-foreground/5 border border-border/30 text-sm text-muted-foreground">
                        <p>
                            Think this is a mistake? Appeals are reviewed within 72 hours:{' '}
                            <a
                                href="mailto:support@blackindex.in?subject=Blacklist%20Appeal"
                                className="text-foreground underline underline-offset-4 hover:opacity-70"
                            >
                                support@blackindex.in
                            </a>
                        </p>
                    </div>
                </FadeInSection>
            </div>
        </div>
    )
}
