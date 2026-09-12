import React, { useEffect, useState } from 'react';
import { 
  DollarSign, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Receipt, 
  Send, 
  Building2, 
  ShieldAlert, 
  Calendar, 
  ChevronDown,
  ArrowUpRight,
  Filter,
  Trash2
} from 'lucide-react';
import { ClientProfile, CurrencyCode, InvoiceItem, UserProfile } from '../types';
import { formatCurrency, CURRENCIES } from '../utils/currency';
import { authFetch } from '../lib/authFetch';

interface InvoiceManagementViewProps {
  clients: ClientProfile[];
  currentUser: UserProfile;
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  onUpdateClients: (updatedClients: ClientProfile[]) => void;
}

export const InvoiceManagementView: React.FC<InvoiceManagementViewProps> = ({
  clients,
  currentUser,
  currency,
  setCurrency,
  onUpdateClients,
}) => {
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'outstanding' | 'overdue'>('all');
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || '');
  const [invoiceAmount, setInvoiceAmount] = useState(15000);
  const [invoiceDueDate, setInvoiceDueDate] = useState('2026-08-15');
  const [invoiceDescription, setInvoiceDescription] = useState('Monthly Retainer - AI Social Growth Engine & Campaign Management');
  const [invoiceEmail, setInvoiceEmail] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [serverInvoices, setServerInvoices] = useState<InvoiceItem[]>([]);
  const [emailConfigured, setEmailConfigured] = useState(false);

  useEffect(() => {
    void authFetch('/api/invoices')
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) return;
        setEmailConfigured(Boolean(data.emailConfigured));
        setServerInvoices(
          (data.invoices || []).map((row: any) => ({
            id: row.id,
            invoiceNumber: row.invoice_number,
            clientId: row.client_id,
            clientName: row.client_name,
            amount: Number(row.amount),
            currency: row.currency,
            date: String(row.issued_at || '').slice(0, 10),
            dueDate: row.due_date || '',
            status: row.status,
            description: row.description || '',
            paidAt: row.paid_at ? String(row.paid_at).slice(0, 10) : undefined,
          }))
        );
      })
      .catch(() => undefined);
  }, []);

  // Check Privilege
  if (!currentUser.privileges.can_invoice_management) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center max-w-xl mx-auto my-12 space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-white">Access Restricted: Invoice Management Right Required</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Your current account role (<span className="text-cyan-300 font-bold uppercase">{currentUser.role}</span>) does not have the <code className="text-amber-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">can_invoice_management</code> privilege assigned.
        </p>
        <p className="text-[11px] text-slate-500">
          Please contact an Administrator to update your privilege checkboxes in Team & Access Rights.
        </p>
      </div>
    );
  }

  // Gather all invoices across clients, preferring the invoices table when present
  const localInvoices: InvoiceItem[] = clients.flatMap((c) => c.invoices || []);
  const allInvoices: InvoiceItem[] = [
    ...serverInvoices,
    ...localInvoices.filter(
      (inv) =>
        !serverInvoices.some(
          (row) => row.id === inv.id || row.invoiceNumber === inv.invoiceNumber
        )
    ),
  ];

  const filteredInvoices = allInvoices.filter((inv) => {
    if (filterStatus === 'all') return true;
    return inv.status === filterStatus;
  });

  // Global calculations
  const totalOutstanding = clients.reduce((acc, c) => acc + (c.outstandingAmount || 0), 0);
  const totalPaidInvoices = allInvoices.filter((i) => i.status === 'paid').reduce((acc, i) => acc + i.amount, 0);
  const overdueCount = clients.filter((c) => c.paymentStatus === 'overdue').length;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1-Click Clear Outstanding / Mark Paid
  const handleClearOutstanding = (clientId: string, invoiceId?: string) => {
    const updated = clients.map((client) => {
      if (client.id === clientId) {
        const updatedInvoices = (client.invoices || []).map((inv) => {
          if (!invoiceId || inv.id === invoiceId) {
            return {
              ...inv,
              status: 'paid' as const,
              paidAt: new Date().toISOString().split('T')[0],
            };
          }
          return inv;
        });

        const hasRemainingOutstanding = updatedInvoices.some((i) => i.status !== 'paid');

        return {
          ...client,
          paymentStatus: hasRemainingOutstanding ? ('outstanding' as const) : ('paid' as const),
          outstandingAmount: hasRemainingOutstanding ? client.outstandingAmount : 0,
          lastPaymentDate: new Date().toISOString().split('T')[0],
          invoices: updatedInvoices,
        };
      }
      return client;
    });

    onUpdateClients(updated);
    if (invoiceId) {
      void authFetch(`/api/invoices/${encodeURIComponent(invoiceId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'paid' }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setServerInvoices((prev) =>
              prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: 'paid', paidAt: new Date().toISOString().slice(0, 10) } : inv))
            );
          }
        })
        .catch(() => undefined);
    }
    showToast('Payment cleared and invoice marked as PAID!');
  };

  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);

  // Delete Invoice
  const handleDeleteInvoice = (clientId: string, invoiceId: string) => {
    const updated = clients.map((client) => {
      if (client.id === clientId) {
        const updatedInvoices = (client.invoices || []).filter((inv) => inv.id !== invoiceId);
        const hasRemainingOutstanding = updatedInvoices.some((i) => i.status !== 'paid');
        const newOutstandingAmount = updatedInvoices
          .filter((i) => i.status !== 'paid')
          .reduce((sum, i) => sum + i.amount, 0);

        return {
          ...client,
          paymentStatus: hasRemainingOutstanding ? ('outstanding' as const) : ('paid' as const),
          outstandingAmount: newOutstandingAmount,
          invoices: updatedInvoices,
        };
      }
      return client;
    });

    onUpdateClients(updated);
    setDeletingInvoiceId(null);
    void authFetch(`/api/invoices/${encodeURIComponent(invoiceId)}`, { method: 'DELETE' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setServerInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
        }
      })
      .catch(() => undefined);
    showToast('Invoice deleted successfully');
  };
  const handleRaiseInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetClient = clients.find((c) => c.id === selectedClientId);
    if (!targetClient) return;

    let emailed = false;
    let invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    try {
      const res = await authFetch('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          clientId: targetClient.id,
          clientName: targetClient.name,
          clientEmail: invoiceEmail || undefined,
          amount: Number(invoiceAmount),
          currency,
          description: invoiceDescription,
          dueDate: invoiceDueDate,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      emailed = Boolean(data.emailSent);
      invoiceNumber = data.invoice?.invoice_number || invoiceNumber;
      if (data.invoice) {
        setServerInvoices((prev) => [
          {
            id: data.invoice.id,
            invoiceNumber,
            clientId: targetClient.id,
            clientName: targetClient.name,
            amount: Number(invoiceAmount),
            currency,
            date: new Date().toISOString().split('T')[0],
            dueDate: invoiceDueDate,
            status: 'outstanding',
            description: invoiceDescription,
          },
          ...prev,
        ]);
      }
    } catch (err: any) {
      showToast(err.message || 'Could not create invoice');
      return;
    }

    const newInvoice: InvoiceItem = {
      id: `inv-${Date.now()}`,
      invoiceNumber,
      clientId: targetClient.id,
      clientName: targetClient.name,
      amount: Number(invoiceAmount),
      currency: currency,
      date: new Date().toISOString().split('T')[0],
      dueDate: invoiceDueDate,
      status: 'outstanding',
      description: invoiceDescription,
    };

    const updated = clients.map((client) => {
      if (client.id === targetClient.id) {
        return {
          ...client,
          paymentStatus: 'outstanding' as const,
          outstandingAmount: (client.outstandingAmount || 0) + Number(invoiceAmount),
          nextPaymentDate: invoiceDueDate,
          invoices: [newInvoice, ...(client.invoices || [])],
        };
      }
      return client;
    });

    onUpdateClients(updated);
    setShowRaiseModal(false);
    showToast(
      emailed
        ? `Invoice ${newInvoice.invoiceNumber} created and emailed. Payments stay off.`
        : invoiceEmail
          ? `Invoice ${newInvoice.invoiceNumber} saved. Email was not sent — set RESEND_API_KEY and EMAIL_FROM on the server.`
          : `Invoice ${newInvoice.invoiceNumber} saved. Payments stay off.`
    );
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner & Currency Control */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Receipt className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-extrabold text-white">Invoice & Payment Management</h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Granted Privilege Active
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Invoices are workspace records. Card payments stay off. Email is sent only when Resend is configured on the server.
          </p>
          {!emailConfigured && (
            <p className="mt-2 text-[11px] text-amber-300">
              Email delivery is off until RESEND_API_KEY and EMAIL_FROM are set. Creating an invoice still saves the record.
            </p>
          )}
        </div>

        {/* Global Currency Selector (Only Appears Here for Invoice Privilege) */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Platform Currency</label>
            <button
              onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
              className="flex items-center gap-2 bg-slate-950 hover:bg-slate-800 text-emerald-400 border border-emerald-500/40 px-3 py-2 rounded-xl text-xs font-bold shadow-inner transition-all"
            >
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>{CURRENCIES[currency]?.symbol} {currency} ({CURRENCIES[currency]?.name})</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>

            {currencyDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  Select Display Currency
                </div>
                {Object.values(CURRENCIES).map((c) => (
                  <button
                    key={c.code}
                    onClick={() => {
                      setCurrency(c.code);
                      setCurrencyDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-800/80 text-xs transition-all ${
                      currency === c.code ? 'bg-emerald-500/15 text-emerald-300 font-bold border-l-2 border-emerald-500' : 'text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-emerald-400 font-bold">{c.symbol}</span>
                      <span>{c.code}</span>
                    </span>
                    <span className="text-[10px] text-slate-400">{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowRaiseModal(true)}
            className="mt-4 lg:mt-0 flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 text-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Raise New Invoice</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Total Outstanding Balance</span>
          <div className="text-xl font-black text-amber-400 font-mono">
            {formatCurrency(totalOutstanding, currency)}
          </div>
          <span className="text-[10px] text-slate-500">Across {clients.length} Active Client Accounts</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Total Collected / Paid</span>
          <div className="text-xl font-black text-emerald-400 font-mono">
            {formatCurrency(totalPaidInvoices, currency)}
          </div>
          <span className="text-[10px] text-emerald-500/80">Verified Bank & Gateways</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Overdue Client Accounts</span>
          <div className="text-xl font-black text-rose-400 font-mono">
            {overdueCount} Accounts
          </div>
          <span className="text-[10px] text-rose-400/80">Requires Manager Follow-Up</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Next Major Billing Cycle</span>
          <div className="text-lg font-bold text-cyan-300 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span>2026-08-01</span>
          </div>
          <span className="text-[10px] text-slate-500">Automated Retainer Generation</span>
        </div>
      </div>

      {/* Client Payment Status Cards Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cyan-400" />
            Client Accounts & Payment Schedules
          </h3>
          <span className="text-xs text-slate-400">{clients.length} Client Profiles Managed</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {clients.map((client) => (
            <div key={client.id} className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img src={client.logo} alt={client.name} className="w-8 h-8 rounded-lg object-cover border border-slate-700" />
                  <div>
                    <h4 className="text-xs font-bold text-white truncate max-w-[140px]">{client.name}</h4>
                    <p className="text-[10px] text-slate-400">{client.industryLabel}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize border ${
                  client.paymentStatus === 'paid' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                  client.paymentStatus === 'outstanding' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                  'bg-rose-500/15 text-rose-400 border-rose-500/30'
                }`}>
                  {client.paymentStatus}
                </span>
              </div>

              <div className="space-y-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>Monthly Retainer:</span>
                  <span className="font-bold text-white font-mono">{formatCurrency(client.monthlyBudget, currency)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Last Payment Date:</span>
                  <span className="text-slate-200">{client.lastPaymentDate || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Next Payment Due:</span>
                  <span className="font-bold text-cyan-300">{client.nextPaymentDate || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>Outstanding Balance:</span>
                  <span className="font-bold text-amber-400 font-mono">
                    {formatCurrency(client.outstandingAmount || 0, currency)}
                  </span>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-end gap-2">
                {client.outstandingAmount > 0 && (
                  <button
                    onClick={() => handleClearOutstanding(client.id)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow cursor-pointer transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Clear Outstanding ({formatCurrency(client.outstandingAmount, currency)})</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invoices List Table & Filter */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-400" />
              Raised Client Invoices
            </h3>
            <p className="text-xs text-slate-400">All generated billing statements for client growth management</p>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex text-[11px]">
              {(['all', 'paid', 'outstanding', 'overdue'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-all ${
                    filterStatus === st ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Invoice Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
              <tr>
                <th className="p-3">Invoice #</th>
                <th className="p-3">Client</th>
                <th className="p-3">Description</th>
                <th className="p-3">Issue / Due Date</th>
                <th className="p-3">Amount ({currency})</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No invoices matching filter <span className="font-bold text-slate-400">"{filterStatus}"</span>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-mono font-bold text-indigo-300">{inv.invoiceNumber}</td>
                    <td className="p-3 font-semibold text-white">{inv.clientName}</td>
                    <td className="p-3 text-slate-400 max-w-xs truncate">{inv.description}</td>
                    <td className="p-3 text-slate-300 font-mono">
                      <div>Issued: {inv.date}</div>
                      <div className="text-[10px] text-cyan-400">Due: {inv.dueDate}</div>
                    </td>
                    <td className="p-3 font-bold text-white font-mono">{formatCurrency(inv.amount, currency)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        inv.status === 'paid' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                        inv.status === 'outstanding' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                        'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {inv.status !== 'paid' ? (
                          <button
                            onClick={() => handleClearOutstanding(inv.clientId, inv.id)}
                            className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                          >
                            Mark Paid
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Paid</span>
                          </span>
                        )}

                        {deletingInvoiceId === inv.id ? (
                          <button
                            onClick={() => handleDeleteInvoice(inv.clientId, inv.id)}
                            className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] rounded-lg cursor-pointer"
                          >
                            Confirm Delete
                          </button>
                        ) : (
                          <button
                            onClick={() => setDeletingInvoiceId(inv.id)}
                            className="p-1.5 bg-slate-950 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 rounded-lg cursor-pointer transition-all"
                            title="Delete Invoice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raise Invoice Modal */}
      {showRaiseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-400" />
                Raise Official Client Invoice
              </h3>
              <button onClick={() => setShowRaiseModal(false)} className="text-slate-400 hover:text-white font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleRaiseInvoice} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select Client Account</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.industryLabel})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Invoice Amount ({currency})</label>
                <input
                  type="number"
                  required
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Payment Due Date</label>
                <input
                  type="date"
                  required
                  value={invoiceDueDate}
                  onChange={(e) => setInvoiceDueDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Client email (for send)</label>
                <input
                  type="email"
                  value={invoiceEmail}
                  onChange={(e) => setInvoiceEmail(e.target.value)}
                  placeholder="finance@client.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Service Line / Description</label>
                <textarea
                  rows={2}
                  value={invoiceDescription}
                  onChange={(e) => setInvoiceDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRaiseModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg cursor-pointer"
                >
                  Raise & Send Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
