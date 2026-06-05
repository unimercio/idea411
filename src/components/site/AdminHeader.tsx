export function AdminHeader({ label = "Admin" }: { label?: string }) {
  return (
    <div className="pt-24">
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-end">
          <span className="text-xs uppercase tracking-[0.2em] text-ember">{label}</span>
        </div>
      </div>
    </div>
  );
}
