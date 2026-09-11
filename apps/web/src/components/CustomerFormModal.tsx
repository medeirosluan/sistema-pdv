import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../lib/api';
import { customersApi, type Customer, type CustomerInput } from '../lib/customers';
import { Modal } from './Modal';

interface CustomerFormModalProps {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  document: string;
  phone: string;
  email: string;
}

const emptyForm: FormState = {
  name: '',
  document: '',
  phone: '',
  email: '',
};

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

export function CustomerFormModal({
  open,
  customer,
  onClose,
  onSaved,
}: CustomerFormModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    if (customer) {
      setForm({
        name: customer.name,
        document: customer.document ?? '',
        phone: customer.phone ?? '',
        email: customer.email ?? '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, customer]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const payload: CustomerInput = {
      name: form.name.trim(),
      document: form.document.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
    };

    try {
      if (customer) {
        await customersApi.update(customer.id, payload);
      } else {
        await customersApi.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Não foi possível salvar',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={customer ? 'Editar cliente' : 'Novo cliente'}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="customer-form"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Nome *
          </span>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            required
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Documento (CPF/CNPJ)
            </span>
            <input
              className={inputClass}
              value={form.document}
              onChange={(e) => update('document', e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Telefone
            </span>
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            E-mail
          </span>
          <input
            type="email"
            className={inputClass}
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
          />
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
