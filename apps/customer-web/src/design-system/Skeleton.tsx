type Props = { className?: string; style?: React.CSSProperties };

export function Skeleton({ className = '', style }: Props) {
  return <div className={`qc-skeleton ${className}`} style={style} aria-hidden />;
}

export function ProductCardSkeleton() {
  return (
    <div className="qc-product-card qc-product-card--skeleton">
      <Skeleton className="qc-product-card__img" />
      <div className="qc-product-card__body">
        <Skeleton style={{ height: 12, width: '40%', marginBottom: 8 }} />
        <Skeleton style={{ height: 16, width: '85%', marginBottom: 8 }} />
        <Skeleton style={{ height: 14, width: '50%' }} />
      </div>
    </div>
  );
}

export function HomeFeedSkeleton() {
  return (
    <div className="qc-home-skeleton">
      <Skeleton style={{ height: 48, borderRadius: 12, marginBottom: 16 }} />
      <Skeleton style={{ height: 160, borderRadius: 16, marginBottom: 20 }} />
      <div className="qc-grid qc-grid--categories">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 72, borderRadius: 14 }} />
        ))}
      </div>
      <div className="qc-grid qc-grid--products" style={{ marginTop: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
