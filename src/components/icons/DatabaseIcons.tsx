interface IconProps {
  className?: string;
}

export function PostgresIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
}

export function DatabaseEngineIcon({
  engine,
  className,
}: {
  engine: string;
  className?: string;
}) {
  switch (engine) {
    case "postgres":
      return <PostgresIcon className={className} />;
    default:
      return <PostgresIcon className={className} />;
  }
}
