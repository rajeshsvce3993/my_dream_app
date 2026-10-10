import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client';
import { money } from '../lib/format';

type Period = { gross: number; commission: number; net: number; orders: number };

type Earnings = {
  today: Period;
  thisWeek: Period;
  thisMonth: Period;
  total: Period;
};

export function EarningsPage() {
  const earnings = useQuery({
    queryKey: ['vendor-earnings'],
    queryFn: () => apiRequest<Earnings>('/vendor/me/earnings'),
  });

  const data = earnings.data;
  const rows = data
    ? ([
        { title: 'Today', row: data.today },
        { title: 'This week', row: data.thisWeek },
        { title: 'This month', row: data.thisMonth },
        { title: 'All time', row: data.total },
      ] as const)
    : [];

  return (
    <div>
      <div className="vendor-page-head">
        <div>
          <h1>Earnings</h1>
          <p>Shop payouts after the platform service charge, by period.</p>
        </div>
      </div>

      {earnings.isLoading && !data ? <p className="muted">Loading earnings…</p> : null}
      {earnings.isError && !data ? <p className="error">{(earnings.error as Error).message}</p> : null}

      {data ? (
        <>
          <div className="vendor-stats vendor-stats-4">
            <div className="vendor-stat">
              <span>Today earnings</span>
              <strong>{money(data.today.net)}</strong>
            </div>
            <div className="vendor-stat">
              <span>This week</span>
              <strong>{money(data.thisWeek.net)}</strong>
            </div>
            <div className="vendor-stat">
              <span>This month</span>
              <strong>{money(data.thisMonth.net)}</strong>
            </div>
            <div className="vendor-stat">
              <span>All time</span>
              <strong>{money(data.total.net)}</strong>
            </div>
          </div>

          <section className="vendor-panel data-panel">
            <div className="data-toolbar">
              <p className="data-toolbar-meta">
                Period breakdown · sales, orders, and net payout
              </p>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th className="num">Orders</th>
                    <th className="num">Sales</th>
                    <th className="num">Service charge</th>
                    <th className="num">Your earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((block) => (
                    <tr key={block.title}>
                      <td>
                        <strong className="table-period">{block.title}</strong>
                      </td>
                      <td className="num">{block.row.orders}</td>
                      <td className="num">{money(block.row.gross)}</td>
                      <td className="num muted-cell">{money(block.row.commission)}</td>
                      <td className="num money-cell">{money(block.row.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
