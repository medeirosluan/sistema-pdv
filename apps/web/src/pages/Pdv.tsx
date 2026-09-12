import {
  CheckCircle2,
  Keyboard,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { CustomerPicker } from '../components/CustomerPicker';
import { Modal } from '../components/Modal';
import { useConfirm } from '../components/ui/useConfirm';
import { PaymentModal } from '../components/PaymentModal';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/useAuth';
import { productDisplayName, productsApi, type Product } from '../lib/catalog';
import type { Customer } from '../lib/customers';
import { formatBRL } from '../lib/format';
import { addPendingSale } from '../lib/offline/salesQueue';
import { printReceipt } from '../lib/receipt';
import { searchCachedProducts } from '../lib/offline/catalogCache';
import { useKiosk } from '../lib/useKiosk';
import { useHotkeys } from '../lib/useHotkeys';
import {
  newPaymentLine,
  salesApi,
  type CreateSaleInput,
  type PaymentLine,
  type Sale,
} from '../lib/sales';

interface CartLine {
  product: Product;
  quantity: number;
}

interface HeldSale {
  id: string;
  cart: CartLine[];
  customer: Customer | null;
  discountInput: string;
}

function parseNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function Pdv() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const { kiosk, toggle: toggleKiosk } = useKiosk();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [discountInput, setDiscountInput] = useState('');
  const [payments, setPayments] = useState<PaymentLine[]>([
    newPaymentLine(user?.tenant.settings?.defaultPaymentMethod ?? 'CASH'),
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [lastSaleOffline, setLastSaleOffline] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [highlightedResult, setHighlightedResult] = useState(-1);
  const [prevHighlightDeps, setPrevHighlightDeps] = useState<{
    debounced: string;
    results: Product[];
  } | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [consult, setConsult] = useState<{
    product: Product | null;
    term: string;
  } | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [holdOpen, setHoldOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const discountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const tenantId = user?.tenant.id ?? '';
    let active = true;

    async function run() {
      if (!debounced) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      if (!navigator.onLine) {
        const cached = await searchCachedProducts(tenantId, debounced);
        if (active) {
          setResults(cached);
          setLoading(false);
        }
        return;
      }
      try {
        const data = await productsApi.list({
          search: debounced,
          active: true,
          pageSize: 24,
        });
        if (active) {
          setResults(data.items);
        }
      } catch {
        const cached = await searchCachedProducts(tenantId, debounced);
        if (active) {
          setResults(cached);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void run();

    return () => {
      active = false;
    };
  }, [debounced, user?.tenant.id]);

  if (
    !prevHighlightDeps ||
    prevHighlightDeps.debounced !== debounced ||
    prevHighlightDeps.results !== results
  ) {
    setPrevHighlightDeps({ debounced, results });
    setHighlightedResult(-1);
  }

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, line) => sum + Number(line.product.price) * line.quantity,
        0,
      ),
    [cart],
  );
  const discount = parseNumber(discountInput);
  const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
  const paid = Math.round(
    payments.reduce((sum, payment) => sum + parseNumber(payment.amount), 0) *
      100,
  ) / 100;
  const remaining = Math.round((total - paid) * 100) / 100;
  const change = paid > total ? Math.round((paid - total) * 100) / 100 : 0;

  function clearSearch() {
    setSearch('');
    setDebounced('');
  }

  function addToCart(product: Product, quantity = multiplier) {
    setLastSale(null);
    setError(null);
    setCart((prev) => {
      const existing = prev.find((line) => line.product.id === product.id);
      if (existing) {
        return prev.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: line.quantity + quantity }
            : line,
        );
      }
      return [...prev, { product, quantity }];
    });
    setMultiplier(1);
    setLastAddedId(product.id);
    window.setTimeout(() => setLastAddedId(null), 700);
  }

  async function handleSearchKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedResult((index) =>
        Math.min(results.length - 1, index + 1),
      );
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedResult((index) => Math.max(-1, index - 1));
      return;
    }
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    const raw = search.trim();
    if (!raw) {
      return;
    }

    let code = raw;
    let quantity = multiplier;
    const multiplierMatch = raw.match(/^(\d+)\*(.*)$/);
    if (multiplierMatch) {
      quantity = Number(multiplierMatch[1]);
      code = multiplierMatch[2].trim();
      if (!code) {
        setMultiplier(quantity);
        clearSearch();
        return;
      }
    }

    // Um código escaneado (leitor de código de barras) que bate exatamente
    // com um produto sempre tem prioridade sobre um item destacado via
    // setas: sem isso, uma navegação por setas feita antes (ainda "presa"
    // por causa do debounce da busca) faria um scan adicionar o produto
    // errado ao carrinho.
    const local = results.find(
      (product) => product.barcode === code || product.sku === code,
    );
    if (local) {
      addToCart(local, quantity);
      clearSearch();
      return;
    }

    const highlighted =
      highlightedResult >= 0 ? results[highlightedResult] : undefined;
    if (highlighted) {
      addToCart(highlighted, quantity);
      clearSearch();
      return;
    }

    try {
      const data = await productsApi.list({
        search: code,
        active: true,
        pageSize: 5,
      });
      const match =
        data.items.find(
          (product) => product.barcode === code || product.sku === code,
        ) ?? (data.items.length === 1 ? data.items[0] : undefined);
      if (match) {
        addToCart(match, quantity);
        clearSearch();
      }
    } catch {
      // busca falhou; mantém o texto para o operador tentar de novo
    }
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((line) =>
          line.product.id === productId
            ? { ...line, quantity: line.quantity + delta }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((line) => line.product.id !== productId));
    setSelectedLineId((prev) => (prev === productId ? null : prev));
  }

  function moveCartSelection(delta: number) {
    if (cart.length === 0) {
      return;
    }
    const currentIndex = cart.findIndex(
      (line) => line.product.id === selectedLineId,
    );
    let next = currentIndex + delta;
    if (currentIndex === -1) {
      next = delta > 0 ? 0 : cart.length - 1;
    }
    next = Math.max(0, Math.min(cart.length - 1, next));
    setSelectedLineId(cart[next].product.id);
  }

  function removeSelectedLine() {
    if (selectedLineId) {
      removeLine(selectedLineId);
    }
  }

  async function cancelSale() {
    if (cart.length === 0) {
      return;
    }
    const ok = await confirm({
      title: 'Cancelar venda',
      message: 'Cancelar/limpar a venda atual?',
      confirmLabel: 'Cancelar venda',
      danger: true,
    });
    if (!ok) {
      return;
    }
    resetSale();
    clearSearch();
    setError(null);
  }

  function holdSale() {
    if (cart.length === 0) {
      return;
    }
    setHeldSales((prev) => [
      ...prev,
      { id: crypto.randomUUID(), cart, customer, discountInput },
    ]);
    resetSale();
    clearSearch();
    setError(null);
  }

  function resumeHeld(id: string) {
    const held = heldSales.find((sale) => sale.id === id);
    if (!held) {
      return;
    }
    const remaining = heldSales.filter((sale) => sale.id !== id);
    if (cart.length > 0) {
      remaining.push({
        id: crypto.randomUUID(),
        cart,
        customer,
        discountInput,
      });
    }
    setHeldSales(remaining);
    setCart(held.cart);
    setCustomer(held.customer);
    setDiscountInput(held.discountInput);
    setPayments([newPaymentLine()]);
    setLastSale(null);
    clearSearch();
  }

  async function consultPrice() {
    const term = search.trim();
    if (!term) {
      searchRef.current?.focus();
      setError('Digite o código ou nome do produto para consultar (F3)');
      return;
    }
    const local =
      results.find(
        (product) =>
          product.barcode === term ||
          product.sku === term ||
          product.name.toLowerCase() === term.toLowerCase(),
      ) ?? results[0];
    if (local) {
      setConsult({ product: local, term });
      return;
    }
    try {
      const data = await productsApi.list({
        search: term,
        active: true,
        pageSize: 1,
      });
      setConsult({ product: data.items[0] ?? null, term });
    } catch {
      setConsult({ product: null, term });
    }
  }

  function resetSale() {
    setCart([]);
    setCustomer(null);
    setDiscountInput('');
    setPayments([newPaymentLine()]);
  }

  async function finalize() {
    if (cart.length === 0) {
      return;
    }
    const settings = user?.tenant.settings ?? {};
    if (settings.requireCustomer && !customer) {
      setError('É necessário identificar o cliente para esta venda');
      return;
    }
    if (settings.maxDiscount && discount > settings.maxDiscount) {
      setError(
        `Desconto máximo permitido: ${formatBRL(settings.maxDiscount)}`,
      );
      return;
    }
    const validPayments = payments.filter(
      (payment) => parseNumber(payment.amount) > 0,
    );
    if (validPayments.length === 0) {
      setError('Informe ao menos uma forma de pagamento');
      return;
    }
    if (paid < total) {
      setError('O valor pago é menor que o total da venda');
      return;
    }
    setSubmitting(true);
    setError(null);
    let completed = false;

    const clientId = crypto.randomUUID();
    const now = new Date().toISOString();
    const payload: CreateSaleInput = {
      clientId,
      createdAt: now,
      customerId: customer?.id ?? undefined,
      discount: discount || undefined,
      items: cart.map((line) => ({
        productId: line.product.id,
        description: productDisplayName(line.product),
        unitPrice: Number(line.product.price),
        quantity: line.quantity,
      })),
      payments: validPayments.map((payment) => ({
        method: payment.method,
        amount: parseNumber(payment.amount),
      })),
    };

    const localSale: Sale = {
      id: clientId,
      number: 0,
      status: 'FINISHED',
      subtotal,
      discount,
      total,
      customer: customer ? { id: customer.id, name: customer.name } : null,
      createdBy: { id: user?.id ?? 'local', name: user?.name ?? 'Operador' },
      items: cart.map((line, index) => ({
        id: `${clientId}-${index}`,
        productId: line.product.id,
        description: productDisplayName(line.product),
        quantity: line.quantity,
        unitPrice: line.product.price,
        discount: 0,
        total: Number(line.product.price) * line.quantity,
      })),
      payments: validPayments.map((payment, index) => ({
        id: `${clientId}-p${index}`,
        method: payment.method,
        amount: parseNumber(payment.amount),
        installments: 1,
      })),
      createdAt: now,
    };

    try {
      if (!navigator.onLine) {
        throw new TypeError('offline');
      }
      const sale = await salesApi.create(payload);
      setLastSale(sale);
      setLastSaleOffline(false);
      completed = true;
      if (user?.tenant.settings?.autoPrint) {
        printReceipt(sale, receiptOptions());
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        await addPendingSale({
          clientId,
          tenantId: user?.tenant.id ?? '',
          createdAt: now,
          payload,
          sale: localSale,
        });
        setLastSale(localSale);
        setLastSaleOffline(true);
        completed = true;
        if (user?.tenant.settings?.autoPrint) {
          printReceipt(localSale, receiptOptions());
        }
      }
    } finally {
      setSubmitting(false);
      if (completed) {
        resetSale();
        clearSearch();
        setPaymentOpen(false);
      }
    }
  }

  function receiptOptions() {
    const tenant = user?.tenant;
    return {
      storeName: tenant?.name ?? 'Loja',
      document: tenant?.document,
      address: tenant?.address,
      footer: tenant?.settings?.receiptFooter,
      paperWidth: tenant?.settings?.receiptWidth,
    };
  }

  function printLastReceipt() {
    if (!lastSale) {
      return;
    }
    printReceipt(lastSale, receiptOptions());
  }

  useHotkeys({
    F2: (event) => {
      event.preventDefault();
      searchRef.current?.focus();
    },
    F3: (event) => {
      event.preventDefault();
      void consultPrice();
    },
    F4: (event) => {
      event.preventDefault();
      discountRef.current?.focus();
    },
    F6: (event) => {
      event.preventDefault();
      void cancelSale();
    },
    F7: (event) => {
      event.preventDefault();
      if (cart.length > 0) {
        holdSale();
      } else if (heldSales.length > 0) {
        resumeHeld(heldSales[heldSales.length - 1].id);
      }
    },
    F8: (event) => {
      event.preventDefault();
      setPaymentOpen(true);
    },
    F9: (event) => {
      event.preventDefault();
      void finalize();
    },
    F10: (event) => {
      event.preventDefault();
      void toggleKiosk();
    },
    Delete: (event) => {
      event.preventDefault();
      removeSelectedLine();
    },
    ArrowDown: (event) => {
      if (document.activeElement === searchRef.current) {
        return;
      }
      event.preventDefault();
      moveCartSelection(1);
    },
    ArrowUp: (event) => {
      if (document.activeElement === searchRef.current) {
        return;
      }
      event.preventDefault();
      moveCartSelection(-1);
    },
    p: (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        printLastReceipt();
      }
    },
    Escape: () => {
      setSearch('');
      setDebounced('');
      setMultiplier(1);
      searchRef.current?.blur();
    },
    '?': (event) => {
      event.preventDefault();
      setHelpOpen(true);
    },
  });

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Buscar ou bipar código de barras — F2"
              autoFocus
              className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          {multiplier > 1 && (
            <span className="flex shrink-0 items-center rounded-lg bg-brand-100 px-3 text-sm font-semibold text-brand-700">
              × {multiplier}
            </span>
          )}
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            title="Atalhos (?)"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <Keyboard className="h-4 w-4" />
            Atalhos
          </button>
          <button
            type="button"
            onClick={() => void toggleKiosk()}
            title={kiosk ? 'Sair da tela cheia' : 'Tela cheia (kiosk)'}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            {kiosk ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {loading && (
            <p className="py-10 text-center text-sm text-slate-400">
              Carregando...
            </p>
          )}
          {!loading && !debounced && (
            <p className="py-10 text-center text-sm text-slate-400">
              Digite o nome ou o código para buscar produtos.
            </p>
          )}
          {!loading && debounced && results.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-400">
              Nenhum produto encontrado.
            </p>
          )}
          {!loading && results.length > 0 && (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Produto</th>
                  <th className="px-4 py-2">Categoria</th>
                  <th className="px-4 py-2 text-right">Estoque</th>
                  <th className="px-4 py-2 text-right">Preço</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((product, index) => {
                  const outOfStock = Number(product.stock) <= 0;
                  const highlighted = index === highlightedResult;
                  return (
                    <tr
                      key={product.id}
                      onClick={() => {
                        if (!outOfStock) {
                          addToCart(product);
                        }
                      }}
                      className={`transition ${
                        highlighted
                          ? 'bg-brand-50'
                          : index % 2 === 1
                            ? 'bg-slate-50/60'
                            : ''
                      } ${
                        outOfStock
                          ? 'cursor-not-allowed opacity-50'
                          : 'cursor-pointer hover:bg-slate-100'
                      }`}
                    >
                      <td className="px-4 py-2">
                        <p className="font-medium text-slate-900">
                          {productDisplayName(product)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {product.barcode || product.sku || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-2 text-slate-500">
                        {product.category?.name ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right text-slate-500">
                        {Number(product.stock)} {product.unit}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right font-semibold text-brand-600">
                        {formatBRL(product.price)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="lg:sticky lg:top-0 lg:h-fit">
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
            <ShoppingCart className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">Carrinho</h2>
            {heldSales.length > 0 && (
              <button
                type="button"
                onClick={() => setHoldOpen(true)}
                className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 transition hover:bg-amber-200"
              >
                {heldSales.length} em espera
              </button>
            )}
            <span className="ml-auto text-xs text-slate-400">
              {cart.length} item(ns)
            </span>
          </div>

          {lastSale && (
            <div className="flex items-center gap-2 border-b border-brand-100 bg-brand-50 px-5 py-3 text-sm text-brand-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="flex-1">
                {lastSaleOffline
                  ? `Venda registrada offline — ${formatBRL(lastSale.total)} (será sincronizada)`
                  : `Venda #${lastSale.number} finalizada — ${formatBRL(lastSale.total)}`}
              </span>
              <button
                type="button"
                onClick={printLastReceipt}
                className="flex items-center gap-1 rounded-lg border border-brand-300 px-2 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
              >
                <Printer className="h-3.5 w-3.5" />
                Cupom
              </button>
            </div>
          )}

          <div className="max-h-64 flex-1 overflow-y-auto px-5 py-3">
            {cart.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                Adicione produtos ao carrinho.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {cart.map((line) => {
                  const selected = line.product.id === selectedLineId;
                  return (
                    <li
                      key={line.product.id}
                      onClick={() => setSelectedLineId(line.product.id)}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-3 ${
                        selected ? 'bg-brand-50 ring-1 ring-brand-300' : ''
                      } ${lastAddedId === line.product.id ? 'animate-flash' : ''}`}
                    >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {productDisplayName(line.product)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatBRL(line.product.price)} × {line.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => changeQuantity(line.product.id, -1)}
                        className="rounded-md border border-slate-200 p-1 text-slate-500 transition hover:bg-slate-50"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium text-slate-700">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeQuantity(line.product.id, 1)}
                        className="rounded-md border border-slate-200 p-1 text-slate-500 transition hover:bg-slate-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="w-16 text-right text-sm font-semibold text-slate-900">
                      {formatBRL(Number(line.product.price) * line.quantity)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(line.product.id)}
                      className="rounded-md p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-3 border-t border-slate-200 px-5 py-4">
            <CustomerPicker value={customer} onChange={setCustomer} />
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-700">
                {formatBRL(subtotal)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-500">Desconto</span>
              <input
                ref={discountRef}
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm outline-none focus:border-brand-500"
              />
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-sm font-medium text-slate-700">Total</span>
              <span className="text-2xl font-bold text-slate-900">
                {formatBRL(total)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setPaymentOpen(true)}
              className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Pagamento (F8)
            </button>

            <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Pago</span>
                <span className="font-medium text-slate-700">
                  {formatBRL(paid)}
                </span>
              </div>
              {remaining > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Falta</span>
                  <span className="font-semibold text-red-600">
                    {formatBRL(remaining)}
                  </span>
                </div>
              )}
              {change > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Troco</span>
                  <span className="font-semibold text-slate-900">
                    {formatBRL(change)}
                  </span>
                </div>
              )}
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            {cart.length > 0 && (
              <button
                type="button"
                onClick={holdSale}
                className="w-full rounded-lg border border-slate-300 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Suspender venda (F7)
              </button>
            )}

            <button
              type="button"
              onClick={finalize}
              disabled={
                cart.length === 0 || submitting || (total > 0 && remaining > 0)
              }
              className="w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Finalizando...' : 'Finalizar venda (F9)'}
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={helpOpen}
        title="Atalhos do PDV"
        onClose={() => setHelpOpen(false)}
      >
        <ul className="space-y-2 text-sm">
          {[
            ['F2', 'Focar a busca de produtos'],
            ['Enter', 'Adicionar produto (ou o item destacado)'],
            ['3*', 'Multiplicar quantidade (ex.: 3* + código)'],
            ['↑ / ↓', 'Navegar nos resultados / itens do carrinho'],
            ['F3', 'Consultar preço e estoque'],
            ['F4', 'Focar o campo de desconto'],
            ['F6', 'Cancelar/limpar a venda'],
            ['F7', 'Suspender/retomar venda'],
            ['Delete', 'Remover o item selecionado'],
            ['F8', 'Abrir o pagamento (escolha 1-4 e o valor)'],
            ['F9', 'Finalizar a venda'],
            ['F10', 'Tela cheia (kiosk)'],
            ['Ctrl+P', 'Reimprimir o último cupom'],
            ['Esc', 'Limpar a busca'],
            ['?', 'Mostrar esta ajuda'],
          ].map(([key, description]) => (
            <li key={key} className="flex items-center gap-4">
              <kbd className="w-16 shrink-0 rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-center font-mono text-xs text-slate-700">
                {key}
              </kbd>
              <span className="text-slate-600">{description}</span>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={consult !== null}
        title="Consulta de preço"
        onClose={() => setConsult(null)}
      >
        {consult && !consult.product && (
          <p className="text-sm text-slate-500">
            Nenhum produto encontrado para{' '}
            <strong className="text-slate-700">{consult.term}</strong>.
          </p>
        )}
        {consult?.product && (
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-lg font-semibold text-slate-900">
                {productDisplayName(consult.product)}
              </p>
              <p className="text-xs text-slate-400">
                {consult.product.barcode || consult.product.sku || '—'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Preço</p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatBRL(consult.product.price)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Estoque</p>
                <p className="text-lg font-semibold text-slate-900">
                  {Number(consult.product.stock)} {consult.product.unit}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Categoria</p>
                <p className="text-sm font-medium text-slate-800">
                  {consult.product.category?.name ?? '—'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Estoque mínimo</p>
                <p className="text-sm font-medium text-slate-800">
                  {Number(consult.product.minStock)} {consult.product.unit}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                addToCart(consult.product as Product);
                setConsult(null);
                clearSearch();
              }}
              className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Adicionar ao carrinho
            </button>
          </div>
        )}
      </Modal>

      <Modal
        open={holdOpen}
        title="Vendas em espera"
        onClose={() => setHoldOpen(false)}
      >
        {heldSales.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma venda em espera.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {heldSales.map((held) => {
              const heldTotal = held.cart.reduce(
                (sum, line) => sum + Number(line.product.price) * line.quantity,
                0,
              );
              return (
                <li
                  key={held.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {held.cart.length} item(ns)
                    </p>
                    <p className="text-xs text-slate-400">
                      {held.customer?.name ?? 'Consumidor'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-900">
                      {formatBRL(heldTotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        resumeHeld(held.id);
                        setHoldOpen(false);
                      }}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
                    >
                      Retomar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      <PaymentModal
        open={paymentOpen}
        total={total}
        payments={payments}
        submitting={submitting}
        error={error}
        onChange={setPayments}
        onClose={() => setPaymentOpen(false)}
        onConfirm={() => {
          void finalize();
        }}
      />
    </div>
  );
}
