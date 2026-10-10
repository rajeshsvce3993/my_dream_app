import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { money } from '../lib/format';
import { Modal } from './Modal';

type Row = {
  id: string;
  name: string;
  sellingPrice: number;
  mrp?: number;
  isActive: boolean;
  imageUrl?: string;
  variantName?: string;
};

type Props = {
  id: string;
  onClose: () => void;
};

export function ProductDetailModal({ id, onClose }: Props) {
  const qc = useQueryClient();
  const [priceText, setPriceText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['vendor-products'],
    queryFn: () => apiRequest<Row[]>('/vendor/products'),
  });

  const product = list.data?.find((row) => row.id === id);

  useEffect(() => {
    if (product) setPriceText(String(product.sellingPrice));
  }, [product?.id, product?.sellingPrice]);

  const save = useMutation({
    mutationFn: (body: { sellingPrice?: number; isActive?: boolean }) =>
      apiRequest(`/vendor/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: (_data, variables) => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['vendor-products'] });
      if (variables.sellingPrice != null) onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Modal title={product?.name ?? 'Product'} onClose={onClose}>
      {list.isLoading && !product ? <p className="muted">Loading product…</p> : null}
      {!list.isLoading && !product ? <p className="error">Product not found</p> : null}

      {product ? (
        <div className="modal-detail">
          <div className="modal-product-hero">
            <div className="product-thumb" style={{ width: 88, height: 88 }}>
              {product.imageUrl ? <img src={product.imageUrl} alt="" /> : 'Food'}
            </div>
            <div>
              <p className="product-name">{product.name}</p>
              {product.variantName ? <p className="product-variant">{product.variantName}</p> : null}
              {product.mrp ? <p className="muted">Actual price {money(product.mrp)}</p> : null}
              <span className={`pill ${product.isActive ? '' : 'off'}`}>
                {product.isActive ? 'On menu' : 'Hidden'}
              </span>
            </div>
          </div>

          <form
            className="form-grid modal-form"
            onSubmit={(e) => {
              e.preventDefault();
              const sellingPrice = Number(priceText);
              if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
                setError('Enter a valid price');
                return;
              }
              save.mutate({ sellingPrice });
            }}
          >
            <label>
              Selling price
              <input value={priceText} onChange={(e) => setPriceText(e.target.value)} inputMode="decimal" />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <div className="order-actions">
              <button className="vendor-btn" type="submit" disabled={save.isPending}>
                Save price
              </button>
              <button
                className="vendor-btn secondary"
                type="button"
                disabled={save.isPending}
                onClick={() => save.mutate({ isActive: !product.isActive })}
              >
                {product.isActive ? 'Hide from menu' : 'Show on menu'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </Modal>
  );
}
