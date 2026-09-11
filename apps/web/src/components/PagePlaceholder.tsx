import type { LucideIcon } from 'lucide-react';

interface PagePlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function PagePlaceholder({
  title,
  description,
  icon: Icon,
}: PagePlaceholderProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
      <span className="mt-6 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
        Em desenvolvimento
      </span>
    </div>
  );
}
