// Jumping dots (Uiverse, by EddyBel): used between page changes
export function DotsLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="dots-loader" role="status" aria-label={label}>
      <div className="dots-loader__circle" />
      <div className="dots-loader__circle" />
      <div className="dots-loader__circle" />
    </div>
  );
}

// Moving squares (Uiverse, by Nawsome): used while signing in
export function SquareLoader({ label = "Signing in" }: { label?: string }) {
  return (
    <div className="sq-loader" role="status" aria-label={label}>
      <div className="sq1" />
      <div className="sq2" />
      <div className="sq3" />
      <div className="sq4" />
      <div className="sq5" />
    </div>
  );
}