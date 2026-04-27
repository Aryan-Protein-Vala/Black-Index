export function Footer() {
  return (
    <footer className="py-12 px-6 lg:px-12 border-t border-border/30 bg-background/50">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-6">
            <a href="/protocol" className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors">What is Black Index?</a>
          </div>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="text-xs font-light text-muted-foreground/70 hover:text-foreground transition-colors">Privacy</a>
            <a href="/terms" className="text-xs font-light text-muted-foreground/70 hover:text-foreground transition-colors">Terms</a>
            <a href="/refunds" className="text-xs font-light text-muted-foreground/70 hover:text-foreground transition-colors">Refunds</a>
            <a href="/disclaimer" className="text-xs font-light text-muted-foreground/70 hover:text-foreground transition-colors">Disclaimer</a>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border/10 pt-8">
          <span className="text-xs font-light text-muted-foreground/50 tracking-wider">© 2025 Black Index</span>
          <span className="text-xs font-light text-muted-foreground/30 tracking-widest uppercase">Stealth</span>
        </div>
      </div>
    </footer>
  )
}
