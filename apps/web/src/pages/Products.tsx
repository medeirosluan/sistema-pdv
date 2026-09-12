import {
  Boxes,
  Download,
  Layers,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { CategoriesModal } from '../components/CategoriesModal';
import { ProductFormModal } from '../components/ProductFormModal';
import { StockModal } from '../components/StockModal';
import { VariantsModal } from '../components/VariantsModal';
import { useConfirm } from '../components/ui/useConfirm';
import { useToast } from '../components/ui/useToast';
import { ApiError } from '../lib/api';
import {
  categoriesApi,
  productsApi,
  type Category,
  type Product,
} from '../lib/catalog';
import { downloadTextFile } from '../lib/csv';
import { formatBRL } from '../lib/format';
import { useCan } from '../lib/permissions';

const PAGE_SIZE = 10;

export function Products() {
  const can = useCan();
  const confirm = useConfirm();
  const toast = useToast();
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [prevFilterKey, setPrevFilterKey] = useState('|');

  const [categories, setCategories] = useState<Category[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [variantsProduct, setVariantsProduct] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    try {
      const data = await productsApi.exportCsv();
      downloadTextFile(data.filename, data.csv);
      toast.success('CSV exportado.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao exportar');
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const result = await productsApi.importCsv(text);
      toast.success(
        `Importado: ${result.created} criado(s), ${result.updated} atualizado(s).`,
      );
      if (result.errors.length > 0) {
        toast.info(`${result.errors.length} linha(s) com problema.`);
      }
      loadProducts();
      loadCategories();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao importar');
    }
  }

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await categoriesApi.list());
    } catch {
      // silencioso: categorias são auxiliares
    }
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await productsApi.list({
        page,
        pageSize: PAGE_SIZE,
        search: debounced || undefined,
        categoryId: categoryFilter || undefined,
        topLevelOnly: true,
      });
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Erro ao carregar produtos',
      );
    } finally {
      setLoading(false);
    }
  }, [page, debounced, categoryFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const filterKey = `${debounced}|${categoryFilter}`;
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  useEffect(() => {
    void (async () => {
      await loadProducts();
    })();
  }, [loadProducts]);

  useEffect(() => {
    void (async () => {
      await loadCategories();
    })();
  }, [loadCategories]);

  async function handleDelete(product: Product) {
    const hasVariants = (product._count?.variants ?? 0) > 0;
    const ok = await confirm({
      title: 'Excluir produto',
      message: hasVariants
        ? `Excluir o produto "${product.name}"? Isso também exclui todas as suas ${product._count?.variants} variação(ões).`
        : `Excluir o produto "${product.name}"?`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) {
      return;
    }
    try {
      await productsApi.remove(product.id);
      toast.success('Produto excluído.');
      loadProducts();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao excluir');
    }
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setFormOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Produtos</h2>
          <p className="mt-1 text-sm text-slate-500">
            Gerencie o catálogo da sua loja.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('products.view') && (
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Exportar
            </button>
          )}
          {can('products.manage') && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Upload className="h-4 w-4" />
                Importar
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleImportFile}
              />
            </>
          )}
          {can('categories.manage') && (
            <button
              type="button"
              onClick={() => setCategoriesOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Tags className="h-4 w-4" />
              Categorias
            </button>
          )}
          {can('products.manage') && (
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              Novo produto
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, SKU ou código de barras"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-500"
        >
          <option value="">Todas as categorias</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3 text-right">Preço</th>
              <th className="px-4 py-3 text-right">Estoque</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
            {!loading &&
              items.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="flex items-center gap-2 font-medium text-slate-900">
                      {product.name}
                      {(product._count?.variants ?? 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => setVariantsProduct(product)}
                          className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 transition hover:bg-violet-200"
                        >
                          {product._count?.variants} variação(ões)
                        </button>
                      )}
                    </p>
                    <p className="text-xs text-slate-400">
                      {product.barcode || product.sku || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {product.category?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {formatBRL(product.price)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={
                        Number(product.stock) <= Number(product.minStock)
                          ? 'font-semibold text-amber-600'
                          : 'text-slate-600'
                      }
                    >
                      {Number(product.stock)} {product.unit}
                    </span>
                    {Number(product.stock) <= Number(product.minStock) && (
                      <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        baixo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        product.active
                          ? 'bg-brand-100 text-brand-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {product.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {can('stock.manage') && (
                        <button
                          type="button"
                          onClick={() => setStockProduct(product)}
                          title="Movimentar estoque"
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        >
                          <Boxes className="h-4 w-4" />
                        </button>
                      )}
                      {can('products.manage') && (
                        <>
                          <button
                            type="button"
                            onClick={() => setVariantsProduct(product)}
                            title="Variações (tamanho, cor etc.)"
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          >
                            <Layers className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(product)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(product)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {total} produto(s) · página {page} de {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>

      <ProductFormModal
        open={formOpen}
        product={editing}
        categories={categories}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          toast.success('Produto salvo.');
          loadProducts();
          loadCategories();
        }}
      />

      <CategoriesModal
        open={categoriesOpen}
        categories={categories}
        onClose={() => setCategoriesOpen(false)}
        onChanged={() => {
          loadCategories();
          loadProducts();
        }}
      />

      <StockModal
        open={stockProduct !== null}
        product={stockProduct}
        onClose={() => setStockProduct(null)}
        onChanged={() => loadProducts()}
      />

      <VariantsModal
        open={variantsProduct !== null}
        product={variantsProduct}
        categories={categories}
        onClose={() => setVariantsProduct(null)}
        onChanged={() => loadProducts()}
      />
    </div>
  );
}
