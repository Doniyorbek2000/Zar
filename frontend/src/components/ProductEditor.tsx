import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Category, Ingredient, Product } from '../api/types';
import { money } from '../lib/format';

const UNIT_LABEL: Record<string, string> = {
  GRAM: 'g',
  KILOGRAM: 'kg',
  MILLILITER: 'ml',
  LITER: 'l',
  PIECE: 'dona',
};

interface ProductFull extends Product {
  recipeItems: { ingredientId: string; quantity: string; ingredient: Ingredient }[];
}

export function ProductEditor({
  productId,
  categories,
  onClose,
}: {
  productId: string | null; // null => yangi taom
  categories: Category[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!productId;

  const { data: product } = useQuery({
    queryKey: ['product-full', productId],
    enabled: isEdit,
    queryFn: () => api.get<ProductFull>(`/catalog/products/${productId}`),
  });
  const { data: ingredients } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => api.get<Ingredient[]>('/inventory/ingredients'),
  });

  const [form, setForm] = useState({
    name: '',
    categoryId: categories[0]?.id ?? '',
    price: '',
    unit: 'porsiya',
    type: 'DISH' as Product['type'],
    description: '',
    imageUrl: '',
  });
  const [recipe, setRecipe] = useState<{ ingredientId: string; quantity: string }[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Mavjud taom ma'lumotini formaga yuklaymiz (bir marta)
  if (product && !initialized) {
    setForm({
      name: product.name,
      categoryId: product.categoryId,
      price: String(product.price),
      unit: product.unit,
      type: product.type,
      description: product.description ?? '',
      imageUrl: product.imageUrl ?? '',
    });
    setRecipe(product.recipeItems.map((r) => ({ ingredientId: r.ingredientId, quantity: String(r.quantity) })));
    setInitialized(true);
  }

  const ingMap = useMemo(() => new Map((ingredients ?? []).map((i) => [i.id, i])), [ingredients]);
  const cost = recipe.reduce((s, r) => {
    const ing = ingMap.get(r.ingredientId);
    return s + (ing ? Number(ing.costPerUnit) * Number(r.quantity || 0) : 0);
  }, 0);
  const price = Number(form.price) || 0;
  const margin = price > 0 ? ((price - cost) / price) * 100 : 0;

  const saveProduct = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        categoryId: form.categoryId,
        price: Number(form.price),
        unit: form.unit,
        type: form.type,
        description: form.description || undefined,
        imageUrl: form.imageUrl || undefined,
      };
      const saved = isEdit
        ? await api.patch<Product>(`/catalog/products/${productId}`, body)
        : await api.post<Product>('/catalog/products', body);
      // Texkartani saqlaymiz
      const validRecipe = recipe.filter((r) => r.ingredientId && Number(r.quantity) > 0);
      await api.put(`/catalog/products/${saved.id}/recipe`, {
        items: validRecipe.map((r) => ({ ingredientId: r.ingredientId, quantity: Number(r.quantity) })),
      });
      return saved;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products-admin'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
  });

  const onImage = async (file: File) => {
    if (file.size > 3 * 1024 * 1024) {
      alert('Rasm 3MB dan katta');
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await api.post<{ url: string }>('/uploads/image', { dataUrl });
      setForm((f) => ({ ...f, imageUrl: res.url }));
    } catch {
      alert('Rasm yuklashda xatolik');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4" onClick={onClose}>
      <div
        className="card w-full max-w-3xl p-6 max-h-[92vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{isEdit ? 'Taomni tahrirlash' : 'Yangi taom'}</h2>
          <button onClick={onClose} className="text-slate-400 text-xl">
            ✕
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Chap: asosiy ma'lumot */}
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-24 h-24 rounded-xl bg-slate-100 overflow-hidden grid place-items-center text-3xl shrink-0">
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  '🍽'
                )}
              </div>
              <div className="flex-1 flex flex-col justify-center gap-2">
                <label className="btn-ghost cursor-pointer text-sm">
                  {uploading ? 'Yuklanmoqda...' : '📷 Rasm yuklash'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])}
                  />
                </label>
                {form.imageUrl && (
                  <button className="text-xs text-red-500" onClick={() => setForm({ ...form, imageUrl: '' })}>
                    Rasmni o'chirish
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="label">Nomi</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Kategoriya</label>
                <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Turi</label>
                <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Product['type'] })}>
                  <option value="DISH">Taom</option>
                  <option value="GOODS">Tovar</option>
                  <option value="PREPARATION">Yarim tayyor</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Narx (so'm)</label>
                <input type="number" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div>
                <label className="label">Birlik</label>
                <input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Tavsif</label>
              <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>

          {/* O'ng: texkarta (retsept) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">🧪 Texnologik karta</h3>
              <button
                className="text-sm text-brand-600 font-semibold"
                onClick={() => setRecipe([...recipe, { ingredientId: '', quantity: '' }])}
              >
                + Ingredient
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-auto pr-1">
              {recipe.map((r, i) => {
                const ing = ingMap.get(r.ingredientId);
                return (
                  <div key={i} className="flex gap-2 items-center">
                    <select
                      className="input flex-1 text-sm"
                      value={r.ingredientId}
                      onChange={(e) => {
                        const next = [...recipe];
                        next[i].ingredientId = e.target.value;
                        setRecipe(next);
                      }}
                    >
                      <option value="">Ingredient...</option>
                      {ingredients?.map((ig) => (
                        <option key={ig.id} value={ig.id}>
                          {ig.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="input w-20 text-sm"
                      placeholder="0"
                      value={r.quantity}
                      onChange={(e) => {
                        const next = [...recipe];
                        next[i].quantity = e.target.value;
                        setRecipe(next);
                      }}
                    />
                    <span className="text-xs text-slate-400 w-8">{ing ? UNIT_LABEL[ing.unit] : ''}</span>
                    <button className="text-red-400 text-lg" onClick={() => setRecipe(recipe.filter((_, j) => j !== i))}>
                      ×
                    </button>
                  </div>
                );
              })}
              {!recipe.length && (
                <div className="text-sm text-slate-400 text-center py-4">
                  Texkarta bo'sh. Ingredient qo'shsangiz, tannarx avtomatik hisoblanadi.
                </div>
              )}
            </div>

            <div className="bg-slate-50 rounded-lg p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Tannarx</span>
                <span className="font-bold">{money(cost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sotuv narxi</span>
                <span className="font-bold">{money(price)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="text-slate-500">Foyda / margin</span>
                <span className={`font-extrabold ${margin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {money(price - cost)} · {margin.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button className="btn-ghost flex-1" onClick={onClose}>
            Bekor qilish
          </button>
          <button
            className="btn-primary flex-1"
            disabled={!form.name || !form.price || saveProduct.isPending}
            onClick={() => saveProduct.mutate()}
          >
            {saveProduct.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}
