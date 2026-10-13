export function FormError({ children }: { children?: string | null }) {
  if (!children) return null;

  return (
    <p role="alert" className="text-body-md text-error">
      {children}
    </p>
  );
}
