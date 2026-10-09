import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { apiRequest } from '../api/client';

type VendorRow = {
  vendorId: string;
  name: string;
  orders: number;
  sales: number;
  gst: number;
  serviceCharge: number;
  deliveryIncome: number;
  income: number;
  vendorEarnings: number;
  paid: number;
  due: number;
};

type PartnerRow = {
  partnerId: string;
  name: string;
  phone: string | null;
  orders: number;
  pay: number;
  paid: number;
  due: number;
};

type Finance = {
  orders: number;
  sales: number;
  gst: number;
  vendorEarnings: number;
  vendorPaid: number;
  vendorDue: number;
  serviceCharge: number;
  deliveryCharges: number;
  platformFee: number;
  partnerEarnings: number;
  partnerPaid: number;
  partnerDue: number;
  deliveryMargin: number;
  platformEarnings: number;
  customerPaid: number;
  vendors: VendorRow[];
  partners: PartnerRow[];
};

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All time' },
] as const;

function inr(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PaymentsPage() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('month');
  const [payoutTab, setPayoutTab] = useState<'restaurants' | 'partners'>('restaurants');
  const qc = useQueryClient();
  const report = useQuery({
    queryKey: ['finance', period],
    queryFn: () => apiRequest<Finance>(`/reports/finance?period=${period}`),
  });
  const mark = useMutation({
    mutationFn: (body: { kind: 'vendor' | 'partner'; partyId: string; paid: boolean }) =>
      apiRequest<Finance>('/reports/finance/payout', {
        method: 'POST',
        body: JSON.stringify({ ...body, period }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(['finance', period], data);
    },
  });

  const data = report.data;

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>Payments</h1>
          <p className="page-lead">Delivered orders for this period. GST to pay is tax owed, not income.</p>
        </div>
        <div className="pay-periods" role="tablist">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === period ? 'is-on' : ''}
              onClick={() => setPeriod(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {report.isLoading ? <p className="muted">Loading payments…</p> : null}
      {report.isError ? <p className="error">{(report.error as Error).message}</p> : null}
      {mark.isError ? <p className="error">{(mark.error as Error).message}</p> : null}

      {data ? (
        <>
          <section className="pay-sheet">
            <div className="pay-sheet-head">
              <h2>Our income</h2>
            </div>
            <div className="pay-stats">
              <div>
                <span>Total income</span>
                <strong>{inr(data.platformEarnings)}</strong>
              </div>
              <div>
                <span>Service charge</span>
                <strong>{inr(data.serviceCharge)}</strong>
              </div>
              <div>
                <span>Delivery income</span>
                <strong>{inr(data.deliveryMargin)}</strong>
              </div>
              <div className="pay-stat-tax">
                <span>GST to pay</span>
                <strong>{inr(data.gst)}</strong>
              </div>
            </div>
            {data.vendors.length === 0 ? (
              <p className="muted pay-empty">No delivered orders in this period.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Restaurant</th>
                    <th>Service charge income</th>
                    <th>Delivery charge income</th>
                    <th>Total income</th>
                    <th>GST to pay</th>
                  </tr>
                </thead>
                <tbody>
                  {data.vendors.map((vendor) => (
                    <tr key={vendor.vendorId}>
                      <td>
                        <Link to={`/vendors/${vendor.vendorId}`}>{vendor.name}</Link>
                      </td>
                      <td>{inr(vendor.serviceCharge)}</td>
                      <td>{inr(vendor.deliveryIncome)}</td>
                      <td className="pay-amount">{inr(vendor.income)}</td>
                      <td className="pay-tax">{inr(vendor.gst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="pay-sheet">
            <div className="pay-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={payoutTab === 'restaurants'}
                className={payoutTab === 'restaurants' ? 'is-on' : ''}
                onClick={() => setPayoutTab('restaurants')}
              >
                Pay restaurants
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={payoutTab === 'partners'}
                className={payoutTab === 'partners' ? 'is-on' : ''}
                onClick={() => setPayoutTab('partners')}
              >
                Pay delivery partners
              </button>
            </div>
            {payoutTab === 'restaurants' && data.vendors.length === 0 ? (
              <p className="muted pay-empty">No delivered orders in this period.</p>
            ) : null}
            {payoutTab === 'restaurants' && data.vendors.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Restaurant</th>
                    <th>Orders</th>
                    <th>Sales</th>
                    <th>Earnings</th>
                    <th>Paid</th>
                    <th>Still to pay</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.vendors.map((vendor) => (
                    <tr key={vendor.vendorId}>
                      <td>
                        <Link to={`/vendors/${vendor.vendorId}`}>{vendor.name}</Link>
                      </td>
                      <td>{vendor.orders}</td>
                      <td>{inr(vendor.sales)}</td>
                      <td className="pay-amount">{inr(vendor.vendorEarnings)}</td>
                      <td>{inr(vendor.paid)}</td>
                      <td className="pay-amount">{inr(vendor.due)}</td>
                      <td className="pay-actions">
                        {vendor.due > 0 ? (
                          <button
                            type="button"
                            className="pay-mark"
                            disabled={mark.isPending}
                            onClick={() => mark.mutate({ kind: 'vendor', partyId: vendor.vendorId, paid: true })}
                          >
                            Mark paid
                          </button>
                        ) : null}
                        {vendor.paid > 0 ? (
                          <button
                            type="button"
                            className="secondary pay-mark"
                            disabled={mark.isPending}
                            onClick={() => mark.mutate({ kind: 'vendor', partyId: vendor.vendorId, paid: false })}
                          >
                            Undo
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {payoutTab === 'partners' && data.partners.length === 0 ? (
              <p className="muted pay-empty">No delivered orders in this period.</p>
            ) : null}
            {payoutTab === 'partners' && data.partners.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th>Orders</th>
                    <th>Earnings</th>
                    <th>Paid</th>
                    <th>Still to pay</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.partners.map((partner) => (
                    <tr key={partner.partnerId}>
                      <td>
                        {partner.name}
                        {partner.phone ? <div className="muted">{partner.phone}</div> : null}
                      </td>
                      <td>{partner.orders}</td>
                      <td className="pay-amount">{inr(partner.pay)}</td>
                      <td>{inr(partner.paid)}</td>
                      <td className="pay-amount">{inr(partner.due)}</td>
                      <td className="pay-actions">
                        {partner.due > 0 ? (
                          <button
                            type="button"
                            className="pay-mark"
                            disabled={mark.isPending}
                            onClick={() => mark.mutate({ kind: 'partner', partyId: partner.partnerId, paid: true })}
                          >
                            Mark paid
                          </button>
                        ) : null}
                        {partner.paid > 0 ? (
                          <button
                            type="button"
                            className="secondary pay-mark"
                            disabled={mark.isPending}
                            onClick={() => mark.mutate({ kind: 'partner', partyId: partner.partnerId, paid: false })}
                          >
                            Undo
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
