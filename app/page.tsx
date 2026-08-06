import { VerticalNav } from "@/components/vertical-nav"
import { HeroSection } from "@/components/sections/hero"
import { OverviewSection } from "@/components/sections/overview"
import { HowItWorksSection } from "@/components/sections/how-it-works"
import { TheMathsSection } from "@/components/sections/the-maths"
import { JoinSection } from "@/components/sections/join"
import { Footer } from "@/components/sections/footer"

export default function MainSitePage() {
    return (
        <div className="relative">
            <div className="hidden md:block">
                <VerticalNav />
            </div>

            <main className="md:ml-20 lg:ml-56">
                <HeroSection />
                <OverviewSection />
                <HowItWorksSection />
                <TheMathsSection />
                <JoinSection />
                <Footer />
            </main>
        </div>
    )
}
