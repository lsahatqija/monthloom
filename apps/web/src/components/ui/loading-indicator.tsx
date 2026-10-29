export function LoadingIndicator({ label }: { label: string }) {
  return (
    <span className="loadingIndicator" role="status">
      {label}
    </span>
  );
}
