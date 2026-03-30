export function PrivacyBadge() {
  return (
    <div className="bg-shield-card border border-shield-accent/15 card-glow rounded p-4">
      <div className="flex items-start gap-3">
        <div className="w-2 h-2 rounded-full bg-shield-accent mt-1 shrink-0 animate-pulse-green" />
        <div>
          <p className="font-mono text-xs tracking-wider uppercase text-shield-accent font-bold">
            MEV Protected
          </p>
          <p className="text-xs text-shield-muted mt-1 leading-relaxed">
            Orders encrypted with FHE on Fhenix CoFHE. Clearing price computed
            over ciphertext. Individual orders never revealed.
          </p>
        </div>
      </div>
    </div>
  );
}
