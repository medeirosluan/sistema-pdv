import { Check, X } from 'lucide-react';
import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { useConfirm } from '../components/ui/useConfirm';
import { ApiError, type TenantInfo, type UserRole } from '../lib/api';
import { api } from '../lib/api';
import { useAuth } from '../lib/useAuth';
import {
  BRAND_KEYS,
  BRAND_LABELS,
  BRAND_PALETTES,
  applyBrandColor,
} from '../lib/brand';
import { formatBRL } from '../lib/format';
import { PERMISSIONS, PERMISSION_GROUPS, useCan } from '../lib/permissions';
import {
  subscriptionApi,
  subscriptionStatusLabels,
  type SubscriptionInfo,
} from '../lib/subscription';
import { PLANS, tenantApi, type PlanInfo, type PlanKey } from '../lib/tenant';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

const paymentOptions = [
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'PIX', label: 'Pix' },
  { value: 'CREDIT', label: 'Crédito' },
  { value: 'DEBIT', label: 'Débito' },
] as const;

export function Settings() {
  const { user, refresh } = useAuth();
  const confirm = useConfirm();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  const [receiptWidth, setReceiptWidth] = useState<'58mm' | '80mm'>('58mm');
  const [autoPrint, setAutoPrint] = useState(false);
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<
    'CASH' | 'PIX' | 'CREDIT' | 'DEBIT'
  >('CASH');
  const [maxDiscount, setMaxDiscount] = useState('0');
  const [requireCustomer, setRequireCustomer] = useState(false);
  const [receiptFooter, setReceiptFooter] = useState('');
  const [brandColor, setBrandColor] = useState('emerald');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorSetup, setTwoFactorSetup] = useState<{
    secret: string;
    qrDataUrl: string;
  } | null>(null);
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);

  const can = useCan();
  const canEdit = can('settings.manage');

  useEffect(() => {
    tenantApi
      .get()
      .then((data) => {
        setTenant(data);
        setName(data.name);
        setDocument(data.document ?? '');
        setPhone(data.phone ?? '');
        setEmail(data.email ?? '');
        setAddress(data.address ?? '');
        setReceiptWidth(data.settings?.receiptWidth ?? '58mm');
        setAutoPrint(data.settings?.autoPrint ?? false);
        setDefaultPaymentMethod(
          data.settings?.defaultPaymentMethod ?? 'CASH',
        );
        setMaxDiscount(String(data.settings?.maxDiscount ?? 0));
        setRequireCustomer(data.settings?.requireCustomer ?? false);
        setReceiptFooter(data.settings?.receiptFooter ?? '');
        setBrandColor(data.settings?.brandColor ?? 'emerald');
      })
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : 'Erro ao carregar dados',
        ),
      )
      .finally(() => setLoading(false));

    tenantApi
      .plan()
      .then(setPlanInfo)
      .catch(() => undefined);

    subscriptionApi
      .get()
      .then(setSubscription)
      .catch(() => undefined);
  }, []);

  async function loadSubscription() {
    try {
      setSubscription(await subscriptionApi.get());
    } catch {
      // ignore
    }
  }

  async function handleSubscribe(plan: PlanKey) {
    setError(null);
    setSaving(true);
    try {
      const result = await subscriptionApi.checkout(plan);
      if (result.provider === 'mock') {
        await subscriptionApi.confirm(plan);
        await refresh();
        await loadSubscription();
        flash('Assinatura ativada (simulação).');
      } else {
        window.open(result.checkoutUrl, '_blank', 'noopener');
        flash(
          'Abra a página de pagamento para concluir. A assinatura ativa após a confirmação.',
        );
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Erro ao iniciar assinatura',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelSubscription() {
    const ok = await confirm({
      title: 'Cancelar assinatura',
      message: 'Cancelar a assinatura da loja?',
      confirmLabel: 'Cancelar assinatura',
      danger: true,
    });
    if (!ok) {
      return;
    }
    setSaving(true);
    try {
      await subscriptionApi.cancel();
      await refresh();
      await loadSubscription();
      flash('Assinatura cancelada.');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Erro ao cancelar assinatura',
      );
    } finally {
      setSaving(false);
    }
  }

  async function selectPlan(plan: PlanKey) {
    const ok = await confirm({
      title: 'Mudar de plano',
      message: `Mudar para o plano ${plan}?`,
      confirmLabel: 'Mudar plano',
    });
    if (!ok) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await tenantApi.changePlan(plan);
      await refresh();
      setPlanInfo(await tenantApi.plan());
      flash('Plano alterado com sucesso.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao mudar de plano');
    } finally {
      setSaving(false);
    }
  }

  function flash(message: string) {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  }

  async function saveStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await tenantApi.update({
        name: name.trim(),
        document: document.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
      });
      setTenant(updated);
      await refresh();
      flash('Dados da loja salvos.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await tenantApi.update({
        settings: {
          receiptWidth,
          autoPrint,
          defaultPaymentMethod,
          maxDiscount: Number(maxDiscount.replace(',', '.')) || 0,
          requireCustomer,
          receiptFooter: receiptFooter.trim() || undefined,
          brandColor,
        },
      });
      setTenant(updated);
      await refresh();
      flash('Preferências salvas.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function startTwoFactor() {
    setError(null);
    setTwoFactorBusy(true);
    try {
      const data = await api.setupTwoFactor();
      setTwoFactorSetup({ secret: data.secret, qrDataUrl: data.qrDataUrl });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao iniciar 2FA');
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function confirmEnableTwoFactor() {
    setError(null);
    setTwoFactorBusy(true);
    try {
      await api.enableTwoFactor(twoFactorCode);
      await refresh();
      setTwoFactorSetup(null);
      setTwoFactorCode('');
      flash('2FA ativado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Código inválido');
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function confirmDisableTwoFactor() {
    setError(null);
    setTwoFactorBusy(true);
    try {
      await api.disableTwoFactor(twoFactorCode);
      await refresh();
      setTwoFactorCode('');
      flash('2FA desativado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Código inválido');
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('A nova senha e a confirmação não conferem');
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      flash('Senha alterada com sucesso.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao alterar senha');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Configurações</h2>
        <p className="mt-1 text-sm text-slate-500">
          Dados da loja, preferências do PDV e sua conta.
        </p>
      </div>

      {success && (
        <p className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          <Check className="h-4 w-4" />
          {success}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {planInfo && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-base font-semibold text-slate-900">
            Plano e uso
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Plano atual:{' '}
            <span className="font-medium text-slate-700">
              {planInfo.name}
            </span>
            {planInfo.price > 0 ? ` · ${formatBRL(planInfo.price)}/mês` : ''}
          </p>

          {subscription && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  subscription.status === 'ACTIVE'
                    ? 'bg-brand-100 text-brand-700'
                    : subscription.status === 'TRIAL'
                      ? 'bg-sky-100 text-sky-700'
                      : 'bg-amber-100 text-amber-700'
                }`}
              >
                {subscriptionStatusLabels[subscription.status]}
              </span>
              {subscription.status === 'TRIAL' &&
                subscription.trialDaysLeft !== null && (
                  <span className="text-slate-500">
                    Restam {subscription.trialDaysLeft} dia(s) de teste
                  </span>
                )}
              {subscription.currentPeriodEnd && (
                <span className="text-slate-500">
                  Próxima cobrança:{' '}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString(
                    'pt-BR',
                  )}
                </span>
              )}
              {subscription.status === 'ACTIVE' && user?.role === 'OWNER' && (
                <button
                  type="button"
                  onClick={handleCancelSubscription}
                  className="text-xs font-medium text-red-600 transition hover:text-red-700"
                >
                  Cancelar assinatura
                </button>
              )}
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <UsageBar
              label="Usuários"
              used={planInfo.usage.users}
              limit={planInfo.limits.maxUsers}
            />
            <UsageBar
              label="Produtos"
              used={planInfo.usage.products}
              limit={planInfo.limits.maxProducts}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {PLANS.map((plan) => {
              const current = plan.key === planInfo.plan;
              return (
                <div
                  key={plan.key}
                  className={`rounded-xl border p-4 ${
                    current
                      ? 'border-brand-500 ring-1 ring-brand-500/30'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">
                      {plan.name}
                    </span>
                    {current && (
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                        Atual
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {plan.price === 0
                      ? 'Grátis'
                      : `${formatBRL(plan.price)}/mês`}
                  </p>
                  <ul className="mt-3 space-y-1 text-xs text-slate-500">
                    {plan.features.map((feature) => (
                      <li key={feature}>· {feature}</li>
                    ))}
                  </ul>
                  {user?.role === 'OWNER' && !current && (
                    <button
                      type="button"
                      onClick={() =>
                        plan.price > 0
                          ? handleSubscribe(plan.key)
                          : selectPlan(plan.key)
                      }
                      disabled={saving}
                      className="mt-4 w-full rounded-lg border border-brand-500 py-2 text-xs font-semibold text-brand-600 transition hover:bg-brand-50 disabled:opacity-60"
                    >
                      {plan.price > 0 ? 'Assinar' : 'Selecionar'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <form
        onSubmit={saveStore}
        className="rounded-2xl border border-slate-200 bg-white p-6"
      >
        <h3 className="text-base font-semibold text-slate-900">
          Dados da loja
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Aparecem no cupom e em documentos.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Nome
            </span>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              CNPJ / CPF
            </span>
            <input
              className={inputClass}
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              disabled={!canEdit}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Telefone
            </span>
            <input
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={!canEdit}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              E-mail
            </span>
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!canEdit}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Endereço
            </span>
            <input
              className={inputClass}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={!canEdit}
            />
          </label>
        </div>

        {canEdit && (
          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar dados'}
            </button>
          </div>
        )}
      </form>

      <form
        onSubmit={savePreferences}
        className="rounded-2xl border border-slate-200 bg-white p-6"
      >
        <h3 className="text-base font-semibold text-slate-900">
          Preferências do PDV
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Ajustam o comportamento das vendas e do cupom.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Largura do cupom
            </span>
            <select
              className={inputClass}
              value={receiptWidth}
              onChange={(e) =>
                setReceiptWidth(e.target.value as '58mm' | '80mm')
              }
              disabled={!canEdit}
            >
              <option value="58mm">58mm</option>
              <option value="80mm">80mm</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Forma de pagamento padrão
            </span>
            <select
              className={inputClass}
              value={defaultPaymentMethod}
              onChange={(e) =>
                setDefaultPaymentMethod(
                  e.target.value as 'CASH' | 'PIX' | 'CREDIT' | 'DEBIT',
                )
              }
              disabled={!canEdit}
            >
              {paymentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Desconto máximo por venda (R$)
            </span>
            <input
              className={inputClass}
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              inputMode="decimal"
              disabled={!canEdit}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Rodapé do cupom
            </span>
            <input
              className={inputClass}
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              placeholder="Ex.: Obrigado pela preferência!"
              disabled={!canEdit}
            />
          </label>
        </div>

        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoPrint}
              onChange={(e) => setAutoPrint(e.target.checked)}
              disabled={!canEdit}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-700">
              Imprimir cupom automaticamente ao finalizar a venda
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={requireCustomer}
              onChange={(e) => setRequireCustomer(e.target.checked)}
              disabled={!canEdit}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-700">
              Exigir cliente identificado na venda
            </span>
          </label>
        </div>

        <div className="mt-4">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Cor da marca
          </span>
          <div className="flex flex-wrap gap-2">
            {BRAND_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                disabled={!canEdit}
                onClick={() => {
                  setBrandColor(key);
                  applyBrandColor(key);
                }}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
                  brandColor === key
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: BRAND_PALETTES[key]['600'] }}
                />
                {BRAND_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        {canEdit && (
          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar preferências'}
            </button>
          </div>
        )}
      </form>

      <form
        onSubmit={changePassword}
        className="rounded-2xl border border-slate-200 bg-white p-6"
      >
        <h3 className="text-base font-semibold text-slate-900">Minha conta</h3>
        <p className="mt-1 text-sm text-slate-500">
          Alterar a senha de {user?.email}.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Senha atual
            </span>
            <input
              type="password"
              className={inputClass}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Nova senha
            </span>
            <input
              type="password"
              className={inputClass}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Confirmar nova senha
            </span>
            <input
              type="password"
              className={inputClass}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? 'Alterando...' : 'Alterar senha'}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900">
          Verificação em duas etapas (2FA)
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Protege o acesso com um código do app autenticador (Google
          Authenticator, Authy, etc.).
        </p>

        {user?.twoFactorEnabled ? (
          <div className="mt-4 space-y-3">
            <p className="flex items-center gap-2 text-sm text-brand-700">
              <Check className="h-4 w-4" /> 2FA ativado
            </p>
            <div className="flex max-w-xs items-end gap-2">
              <label className="flex-1">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Código
                </span>
                <input
                  className={inputClass}
                  value={twoFactorCode}
                  onChange={(e) =>
                    setTwoFactorCode(e.target.value.replace(/\D/g, ''))
                  }
                  maxLength={6}
                  inputMode="numeric"
                  placeholder="000000"
                />
              </label>
              <button
                type="button"
                onClick={confirmDisableTwoFactor}
                disabled={twoFactorBusy}
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
              >
                Desativar
              </button>
            </div>
          </div>
        ) : twoFactorSetup ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">
              1. Escaneie o QR no app autenticador:
            </p>
            <img
              src={twoFactorSetup.qrDataUrl}
              alt="QR Code 2FA"
              className="h-40 w-40 rounded-lg border border-slate-200"
            />
            <p className="text-xs text-slate-400">
              Ou informe o código manual:{' '}
              <code className="rounded bg-slate-100 px-1">
                {twoFactorSetup.secret}
              </code>
            </p>
            <p className="text-sm text-slate-600">
              2. Digite o código gerado para confirmar:
            </p>
            <div className="flex max-w-xs items-end gap-2">
              <input
                className={inputClass}
                value={twoFactorCode}
                onChange={(e) =>
                  setTwoFactorCode(e.target.value.replace(/\D/g, ''))
                }
                maxLength={6}
                inputMode="numeric"
                placeholder="000000"
              />
              <button
                type="button"
                onClick={confirmEnableTwoFactor}
                disabled={twoFactorBusy}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                Ativar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={startTwoFactor}
            disabled={twoFactorBusy}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            Ativar 2FA
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900">
          Permissões por papel
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          O que cada papel pode fazer no sistema.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Permissão</th>
                <th className="px-3 py-2 text-center">Proprietário</th>
                <th className="px-3 py-2 text-center">Gerente</th>
                <th className="px-3 py-2 text-center">Operador</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group) => (
                <Fragment key={group}>
                  <tr className="bg-slate-50">
                    <td
                      colSpan={4}
                      className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {group}
                    </td>
                  </tr>
                  {PERMISSIONS.filter(
                    (permission) => permission.group === group,
                  ).map((permission) => (
                    <tr
                      key={permission.key}
                      className="border-b border-slate-100"
                    >
                      <td className="px-3 py-2 text-slate-700">
                        {permission.label}
                      </td>
                      {(
                        ['OWNER', 'MANAGER', 'CASHIER'] as UserRole[]
                      ).map((role) => (
                        <td key={role} className="px-3 py-2 text-center">
                          {permission.roles.includes(role) ? (
                            <Check className="mx-auto h-4 w-4 text-brand-600" />
                          ) : (
                            <X className="mx-auto h-4 w-4 text-slate-300" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400">
        Loja: {tenant?.slug} · Plano: {tenant?.plan}
      </p>
    </div>
  );
}

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const percent =
    limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const near = limit > 0 && used / limit >= 0.8;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-slate-500">{label}</span>
        <span className={near ? 'font-medium text-amber-600' : 'text-slate-600'}>
          {used} / {limit}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${near ? 'bg-amber-500' : 'bg-brand-500'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
