import { Search, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/useAuth';
import { customersApi, type Customer } from '../lib/customers';
import { searchCachedCustomers } from '../lib/offline/catalogCache';

interface CustomerPickerProps {
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
}

export function CustomerPicker({ value, onChange }: CustomerPickerProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [options, setOptions] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const tenantId = user?.tenant.id ?? '';
    let active = true;

    async function run() {
      if (!navigator.onLine) {
        const cached = await searchCachedCustomers(tenantId, debounced);
        if (active) {
          setOptions(cached);
        }
        return;
      }
      try {
        const data = await customersApi.list({
          search: debounced || undefined,
          pageSize: 8,
        });
        if (active) {
          setOptions(data.items);
        }
      } catch {
        const cached = await searchCachedCustomers(tenantId, debounced);
        if (active) {
          setOptions(cached);
        }
      }
    }
    void run();

    return () => {
      active = false;
    };
  }, [debounced, open, user?.tenant.id]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
        <span className="flex items-center gap-2 truncate text-slate-700">
          <User className="h-4 w-4 shrink-0 text-slate-400" />
          {value.name}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="shrink-0 text-slate-400 transition hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Cliente (opcional)"
        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
      />
      {open && options.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {options.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(customer);
                  setQuery('');
                  setOpen(false);
                }}
                className="flex w-full flex-col px-3 py-2 text-left text-sm transition hover:bg-slate-50"
              >
                <span className="font-medium text-slate-800">
                  {customer.name}
                </span>
                {(customer.phone || customer.document) && (
                  <span className="text-xs text-slate-400">
                    {customer.phone ?? customer.document}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
