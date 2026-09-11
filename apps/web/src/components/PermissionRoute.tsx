import type { ReactNode } from 'react';
import { useCan, type Permission } from '../lib/permissions';

export function PermissionRoute({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const can = useCan();
  if (!can(permission)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <p className="text-sm text-slate-500">
          Você não tem acesso a esta área.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
