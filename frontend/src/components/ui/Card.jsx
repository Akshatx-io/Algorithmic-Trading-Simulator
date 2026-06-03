/**
 * Card — the base surface primitive for the whole app.
 * Composable: <Card><CardHeader title="…" action={…}/> …children… </Card>
 */
export function Card({ className = "", children, ...rest }) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className = "" }) {
  return (
    <div className={`flex items-start justify-between gap-3 px-5 pt-5 ${className}`}>
      <div className="min-w-0">
        {title && <h3 className="text-base font-semibold text-white">{title}</h3>}
        {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className = "", children }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export default Card;
