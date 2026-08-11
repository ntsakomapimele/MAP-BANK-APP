import { useState, useEffect, useCallback } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  RefreshCw,
  LogOut,
  Plus,
  Loader2,
  Wallet,
  Landmark,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
} from 'lucide-react';
import { getAccounts, createAccount, getAccountTransactions, deposit, withdraw, transfer } from './api';
import { useAuth } from './AuthContext';
import AnimatedNumber from './AnimatedNumber';

function extractErrorMessage(err) {
  const data = err?.response?.data;
  if (!data) return 'Action failed. Please try again.';
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  const messages = [];
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (Array.isArray(val)) messages.push(...val);
    else if (typeof val === 'string') messages.push(val);
  }
  return messages.length > 0 ? messages.join(' ') : 'Action failed. Please try again.';
}

const TABS = [
  { key: 'deposit', label: 'Deposit', icon: ArrowDownLeft },
  { key: 'withdraw', label: 'Withdraw', icon: ArrowUpRight },
  { key: 'transfer', label: 'Transfer', icon: Send },
];

// Floating banner for errors / success messages. Re-keyed by its message so
// the slide-in animation replays every time a new notice arrives.
function Toast({ type, message, onDismiss }) {
  if (!message) return null;
  const isError = type === 'error';
  return (
    <div
      key={`${type}-${message}`}
      role="status"
      className={`animate-fade-slide-down flex items-start gap-2.5 p-4 rounded-xl border shadow-sm ${
        isError ? 'bg-red-50 border-red-100 text-red-700' : 'bg-mint-50 border-mint-100 text-mint-600'
      }`}
    >
      {isError ? (
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      ) : (
        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
      )}
      <span className="flex-1 text-sm">{message}</span>
      <button onClick={onDismiss} className="text-current opacity-60 hover:opacity-100 transition-opacity">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function SkeletonBlock({ className = '' }) {
  return <div className={`bg-gray-200/80 rounded-lg animate-skeleton ${className}`} />;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [newAccountType, setNewAccountType] = useState('CHECKING');

  // Form state
  const [amount, setAmount] = useState('');
  const [targetAccount, setTargetAccount] = useState('');
  const [actionType, setActionType] = useState('deposit'); // deposit, withdraw, transfer

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getAccounts();
      const list = response.data.results ?? response.data;
      setAccounts(list);
      setSelectedAccount((prev) => {
        if (prev) {
          const stillThere = list.find((a) => a.id === prev.id);
          if (stillThere) return stillThere;
        }
        return list.length > 0 ? list[0] : null;
      });
      return list;
    } catch {
      setError('Failed to fetch accounts. Ensure the backend is running.');
      return [];
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  const fetchTransactions = useCallback(async (accountId) => {
    if (!accountId) {
      setTransactions([]);
      return;
    }
    try {
      setTxLoading(true);
      const response = await getAccountTransactions(accountId);
      setTransactions(response.data.results ?? response.data);
    } catch {
      console.error('Failed to load transaction history');
    } finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    fetchTransactions(selectedAccount?.id);
  }, [selectedAccount, fetchTransactions]);

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      setCreatingAccount(true);
      const res = await createAccount(newAccountType);
      setSuccess(`Account ${res.data.account_number} created.`);
      const list = await fetchAccounts();
      const created = list.find((a) => a.id === res.data.id);
      if (created) setSelectedAccount(created);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!selectedAccount) {
      setError('Select an account first.');
      return;
    }

    const formattedAmount = parsedAmount.toFixed(2);

    try {
      setSubmitting(true);
      if (actionType === 'deposit') {
        await deposit(selectedAccount.id, formattedAmount);
        setSuccess(`Successfully deposited R${formattedAmount}`);
      } else if (actionType === 'withdraw') {
        await withdraw(selectedAccount.id, formattedAmount);
        setSuccess(`Successfully withdrew R${formattedAmount}`);
      } else if (actionType === 'transfer') {
        if (!targetAccount) {
          setError('Recipient account number is required for transfers.');
          setSubmitting(false);
          return;
        }
        await transfer(selectedAccount.id, targetAccount, formattedAmount);
        setSuccess(`Transferred R${formattedAmount} to ${targetAccount}`);
      }

      setAmount('');
      setTargetAccount('');
      const list = await fetchAccounts();
      const refreshed = list.find((a) => a.id === selectedAccount.id) || selectedAccount;
      fetchTransactions(refreshed.id);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username;

  const activeTabIndex = TABS.findIndex((t) => t.key === actionType);
  const ActiveIcon = TABS[activeTabIndex]?.icon ?? ArrowDownLeft;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm animate-fade-slide-down">
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex bg-gradient-to-br from-brand-600 to-mint-600 text-white p-2.5 rounded-xl">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-gray-800">MAP Bank</h1>
              <p className="text-sm text-gray-500">
                Welcome back{displayName ? `, ${displayName}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAccounts}
              className="p-2 text-gray-600 hover:bg-gray-100 hover:text-brand-600 rounded-lg transition-all duration-300 hover:rotate-180"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={logout}
              className="group flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-red-600 rounded-lg transition-colors"
              title="Log out"
            >
              <LogOut className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              Log out
            </button>
          </div>
        </header>

        {/* Notifications */}
        <div className="space-y-2">
          <Toast type="error" message={error} onDismiss={() => setError('')} />
          <Toast type="success" message={success} onDismiss={() => setSuccess('')} />
        </div>

        {initialLoad ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-4">
              <SkeletonBlock className="h-48 rounded-xl" />
              <SkeletonBlock className="h-14 rounded-xl" />
            </div>
            <div className="md:col-span-2">
              <SkeletonBlock className="h-64 rounded-xl" />
            </div>
          </div>
        ) : !loading && accounts.length === 0 ? (
          /* No accounts yet: onboarding card */
          <div className="bg-white p-8 rounded-xl shadow-sm text-center space-y-4 animate-scale-in">
            <div className="mx-auto w-14 h-14 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center animate-gentle-bounce">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Open your first account</h2>
              <p className="text-sm text-gray-500">You don't have any accounts yet. Create one to get started.</p>
            </div>
            <form onSubmit={handleCreateAccount} className="flex items-center justify-center gap-2 max-w-sm mx-auto">
              <select
                value={newAccountType}
                onChange={(e) => setNewAccountType(e.target.value)}
                className="p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none transition-shadow"
              >
                <option value="CHECKING">Current</option>
                <option value="SAVINGS">Savings</option>
              </select>
              <button
                type="submit"
                disabled={creatingAccount}
                className="px-4 py-2.5 bg-gradient-to-r from-brand-600 to-mint-600 hover:brightness-110 disabled:opacity-60 text-white font-medium rounded-lg transition-all flex items-center gap-2 active:scale-95"
              >
                {creatingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create account
              </button>
            </form>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Account Selector & Balance Card */}
            <div className="md:col-span-1 space-y-4">
              <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-600 to-mint-600 animate-aurora text-white p-6 rounded-xl shadow-lg shadow-brand-600/20 animate-fade-slide-up">
                <div className="shimmer-overlay" />
                <Wallet className="absolute -bottom-4 -right-4 w-28 h-28 text-white/10 animate-gentle-bounce" style={{ '--tilt': '-8deg' }} />

                <div className="relative z-10">
                  <span className="text-sm opacity-80">Selected Account</span>
                  <select
                    className="w-full mt-2 p-2 bg-white/10 text-white rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 transition-shadow"
                    value={selectedAccount?.id ?? ''}
                    onChange={(e) => {
                      const acc = accounts.find((a) => String(a.id) === e.target.value);
                      setSelectedAccount(acc);
                    }}
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id} className="text-gray-900">
                        {acc.account_number} ({acc.account_type})
                      </option>
                    ))}
                  </select>

                  <div className="mt-6">
                    <p className="text-xs opacity-75 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Available Balance
                    </p>
                    <p className="font-display text-3xl font-extrabold mt-1 tabular-nums">
                      <AnimatedNumber
                        value={selectedAccount ? parseFloat(selectedAccount.balance) : 0}
                        prefix="R"
                      />
                    </p>
                  </div>
                </div>
              </div>

              <form
                onSubmit={handleCreateAccount}
                className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-2 animate-fade-slide-up"
                style={{ animationDelay: '80ms' }}
              >
                <select
                  value={newAccountType}
                  onChange={(e) => setNewAccountType(e.target.value)}
                  className="flex-1 p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none transition-shadow"
                >
                  <option value="CHECKING">Current</option>
                  <option value="SAVINGS">Savings</option>
                </select>
                <button
                  type="submit"
                  disabled={creatingAccount}
                  className="group px-3 py-2 text-sm bg-gray-100 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-60 text-gray-700 font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                >
                  {creatingAccount ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                  )}
                  New account
                </button>
              </form>
            </div>

            {/* Quick Actions Form */}
            <div
              className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm space-y-4 animate-fade-slide-up"
              style={{ animationDelay: '40ms' }}
            >
              <h2 className="text-lg font-semibold text-gray-800">Account Operations</h2>

              <div className="relative flex border-b pb-4">
                <div className="relative grid grid-cols-3 gap-2 w-full">
                  <div
                    className="absolute inset-y-0 w-1/3 bg-brand-600 rounded-lg transition-transform duration-300 ease-out"
                    style={{ transform: `translateX(${activeTabIndex * 100}%)` }}
                  />
                  {TABS.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActionType(key)}
                      className={`relative z-10 px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                        actionType === key ? 'text-white' : 'text-gray-600 hover:text-brand-600'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {actionType === 'transfer' && (
                  <div className="animate-fade-slide-up">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Account Number</label>
                    <input
                      type="text"
                      required
                      value={targetAccount}
                      onChange={(e) => setTargetAccount(e.target.value)}
                      placeholder="Enter account number"
                      className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all focus:-translate-y-0.5"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (R)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all focus:-translate-y-0.5"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !selectedAccount}
                  className="w-full py-3 bg-gradient-to-r from-brand-600 to-mint-600 bg-[length:180%_100%] bg-left hover:bg-right disabled:from-brand-300 disabled:to-brand-300 text-white font-medium rounded-lg transition-all duration-500 flex items-center justify-center gap-2 capitalize active:scale-[0.98] shadow-lg shadow-brand-600/20"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ActiveIcon key={actionType} className="w-4 h-4 animate-pop-in" />
                  )}
                  Execute {actionType}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Transaction History */}
        {!initialLoad && accounts.length > 0 && (
          <div
            className="bg-white p-6 rounded-xl shadow-sm animate-fade-slide-up"
            style={{ animationDelay: '120ms' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                Transaction History
                {selectedAccount ? ` · ${selectedAccount.account_number}` : ''}
              </h2>
              {txLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            </div>
            {transactions.length === 0 ? (
              <p className="text-sm text-gray-500">No recent transactions for this account.</p>
            ) : (
              <div className="divide-y">
                {transactions.map((tx, i) => {
                  const isCredit = tx.transaction_type === 'DEPOSIT' || tx.transaction_type === 'TRANSFER_IN';
                  return (
                    <div
                      key={tx.id}
                      className="py-3 flex justify-between items-center rounded-lg transition-colors hover:bg-gray-50 px-2 -mx-2 animate-ticker-in"
                      style={{ animationDelay: `${Math.min(i * 45, 400)}ms` }}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`p-2 rounded-full transition-transform duration-200 hover:scale-110 ${
                            isCredit ? 'bg-mint-50 text-mint-600' : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {isCredit ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {tx.description || tx.transaction_type}
                          </p>
                          <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${isCredit ? 'text-mint-600' : 'text-gray-800'}`}>
                        {isCredit ? '+' : '-'}R{parseFloat(tx.amount).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
