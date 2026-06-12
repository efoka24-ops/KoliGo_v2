import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '../i18n/I18nContext.jsx';
import { Kpi, Pill, Skeleton } from '../components/ui.jsx';
import { IconFinance } from '../components/icons.jsx';
import { adminApi } from '../api.js';
import { transactions as mockTxs, withdrawalsData as mockWithdrawals } from '../data.js';

const TX_TONE = { CREDIT:'ok', DEBIT:'orange', COMMISSION:'b', WITHDRAWAL:'mut', REFUND:'warn' };

export default function Finance() {
  const { t } = useI18n();
  const qc    = useQueryClient();
  const [tab, setTab] = useState('transactions');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-finance'],
    queryFn:  adminApi.finance,
    refetchInterval: 30_000,
  });

  const payMut = useMutation({
    mutationFn: adminApi.payWithdrawal,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin-finance'] }),
  });

  const txs         = data?.transactions        ?? mockTxs;
  const withdrawals = data?.pendingWithdrawals   ?? mockWithdrawals;
  const balance     = data?.platformBalance      ?? 0;
  const totalWallet = data?.totalWallets         ?? 0;
  const pendingAmt  = data?.pendingAmount        ?? 0;
  const pendingCnt  = data?.pendingCount         ?? 0;

  return (
    <section className="content">
      <div className="grid" style={{ gridTemplateColumns:'repeat(3,1fr)' }}>
        <Kpi iconTone="g" icon={<IconFinance width={20} height={20}/>}
          label={t('platformBalance')}
          value={isLoading ? '…' : (balance/1000).toFixed(1)} unit="k XAF"
          delta="" spark={[]} />
        <Kpi iconTone="b" icon={<span style={{ fontWeight:700, fontSize:16 }}>₣</span>}
          label={t('totalWallets')}
          value={isLoading ? '…' : (totalWallet/1000).toFixed(1)} unit="k XAF"
          delta="" spark={[]} />
        <Kpi iconTone="o" icon={<span style={{ fontWeight:700, fontSize:14 }}>⏳</span>}
          label={t('pendingWithdrawals')}
          value={isLoading ? '…' : pendingCnt}
          delta={isLoading ? '' : `${(pendingAmt/1000).toFixed(0)}k XAF`}
          spark={[]} />
      </div>

      <div className="toolbar" style={{ marginTop:16, marginBottom:0 }}>
        <div className="chips">
          <span className={`chip ${tab==='transactions' ? 'on' : ''}`} onClick={() => setTab('transactions')}>{t('transactions')}</span>
          <span className={`chip ${tab==='withdrawals' ? 'on' : ''}`} onClick={() => setTab('withdrawals')}>{t('withdrawals')} {pendingCnt > 0 && <b style={{ marginLeft:4, color:'var(--orange)' }}>{pendingCnt}</b>}</span>
        </div>
        <div style={{ flex:1 }} />
        <button className="btn sm">{t('export')}</button>
      </div>

      {tab === 'transactions' && (
        <div className="card" style={{ overflow:'hidden', marginTop:12 }}>
          <table className="tbl">
            <thead>
              <tr><th>ID</th><th>{t('user')}</th><th>{t('type')}</th><th>{t('amount')}</th><th>Date</th></tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({length:5}).map((_,i) => (
                  <tr key={i}><td colSpan={5}><Skeleton h={18} /></td></tr>
                ))
              ) : txs.map((tx) => {
                const type = tx.type || tx.typeLabel || '—';
                const tone = TX_TONE[type] || 'mut';
                const amt  = tx.amount ?? tx.amt ?? 0;
                const sign = type === 'DEBIT' || type === 'WITHDRAWAL' ? '-' : '+';
                const date = tx.createdAt
                  ? new Date(tx.createdAt).toLocaleDateString('fr-FR')
                  : tx.date || '—';
                const userName = tx.user?.name || tx.user || '—';
                return (
                  <tr key={tx.id}>
                    <td className="id mono-sm">{tx.id}</td>
                    <td>{userName}</td>
                    <td><Pill tone={tone}>{type}</Pill></td>
                    <td className={`amt ${sign === '+' ? '' : 'danger'}`}>{sign}{Math.abs(amt).toLocaleString('fr-FR')} XAF</td>
                    <td className="muted">{date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'withdrawals' && (
        <div className="card" style={{ overflow:'hidden', marginTop:12 }}>
          <table className="tbl">
            <thead>
              <tr><th>ID</th><th>{t('user')}</th><th>{t('method')}</th><th>{t('amount')}</th><th>{t('status')}</th><th/></tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({length:4}).map((_,i) => (
                  <tr key={i}><td colSpan={6}><Skeleton h={18} /></td></tr>
                ))
              ) : withdrawals.map((w) => {
                const isPending = w.status === 'PENDING' || w.status === 'pending';
                const amt = w.amount ?? w.amt ?? 0;
                const userName = w.user?.name || w.user || '—';
                const method = w.method || w.paymentMethod || 'MTN MoMo';
                return (
                  <tr key={w.id}>
                    <td className="id mono-sm">{w.id}</td>
                    <td>{userName}</td>
                    <td className="muted">{method}</td>
                    <td className="amt">{amt.toLocaleString('fr-FR')} XAF</td>
                    <td><Pill tone={isPending ? 'warn' : 'ok'}>{isPending ? t('pending') : t('paid')}</Pill></td>
                    <td>
                      {isPending && (
                        <button className="btn sm pri"
                          disabled={payMut.isPending}
                          onClick={() => payMut.mutate(w.id)}>
                          {t('pay')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
