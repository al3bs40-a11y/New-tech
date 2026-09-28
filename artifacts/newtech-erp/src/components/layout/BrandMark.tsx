export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-lockup">
      <div className={compact ? 'brand-mark compact' : 'brand-mark'}>
        <span>N</span>
      </div>
      <div className="brand-copy">
        <strong>NEWTECH</strong>
        <span>الأفضل لبيتك</span>
      </div>
    </div>
  );
}
