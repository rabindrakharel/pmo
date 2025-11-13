import React, { useState } from 'react';
import { CreditCard, Download, Calendar, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Layout } from '../../components/shared';

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  description: string;
}

const mockInvoices: Invoice[] = [
  {
    id: 'INV-2025-001',
    date: '2025-01-01',
    amount: 99.99,
    status: 'paid',
    description: 'PMO Enterprise - Monthly Subscription',
  },
  {
    id: 'INV-2024-012',
    date: '2024-12-01',
    amount: 99.99,
    status: 'paid',
    description: 'PMO Enterprise - Monthly Subscription',
  },
  {
    id: 'INV-2024-011',
    date: '2024-11-01',
    amount: 99.99,
    status: 'paid',
    description: 'PMO Enterprise - Monthly Subscription',
  },
];

export function BillingPage() {
  const { user } = useAuth();
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);

  const handleUpdatePaymentMethod = async () => {
    setIsUpdatingPayment(true);
    try {
      // TODO: Integrate with payment provider (Stripe, etc.)
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Update payment method');
    } catch (error) {
      console.error('Payment method update failed:', error);
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  const downloadInvoice = (invoiceId: string) => {
    // TODO: Implement invoice download
    console.log('Download invoice:', invoiceId);
  };

  const getStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1 stroke-[1.5]" />
            Paid
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal bg-yellow-100 text-yellow-800">
            <Calendar className="w-3 h-3 mr-1 stroke-[1.5]" />
            Pending
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal bg-red-100 text-red-800">
            <AlertCircle className="w-3 h-3 mr-1 stroke-[1.5]" />
            Overdue
          </span>
        );
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-dark-100 shadow rounded-md">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center mb-6">
              <CreditCard className="h-5 w-5 text-dark-700 stroke-[1.5] mr-3" />
              <div className="flex-1">
                <h1 className="text-sm font-normal text-dark-600">Billing & Subscription</h1>
                <p className="text-sm text-dark-700">Manage your subscription and billing information</p>
              </div>
            </div>

            {/* Current Plan */}
            <div className="bg-gradient-to-r from-dark-100 to-indigo-900 border border-dark-400 rounded-md p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-normal text-dark-600">PMO Enterprise Plan</h3>
                  <p className="text-dark-700">Full access to all features and unlimited users</p>
                  <div className="flex items-center mt-2">
                    <DollarSign className="h-4 w-4 text-dark-700 stroke-[1.5] mr-1" />
                    <span className="text-sm font-normal text-dark-600">$99.99</span>
                    <span className="text-dark-700 ml-1">/month</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-dark-700">Next billing date</div>
                  <div className="font-normal text-dark-600">February 1, 2025</div>
                  <button className="mt-2 text-dark-700 hover:text-dark-700 text-sm font-normal">
                    Change plan
                  </button>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="mb-8">
              <h3 className="text-sm font-normal text-dark-600 mb-4">Payment Method</h3>
              <div className="bg-dark-100 border border-dark-300 rounded-md p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-10 w-10 bg-dark-100 rounded-md flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-dark-700 stroke-[1.5]" />
                    </div>
                    <div className="ml-4">
                      <div className="font-normal text-dark-600">•••• •••• •••• 4242</div>
                      <div className="text-sm text-dark-700">Expires 12/2028</div>
                    </div>
                  </div>
                  <button
                    onClick={handleUpdatePaymentMethod}
                    disabled={isUpdatingPayment}
                    className="text-dark-700 hover:text-dark-700 text-sm font-normal disabled:opacity-50"
                  >
                    {isUpdatingPayment ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </div>
            </div>

            {/* Billing History */}
            <div>
              <h3 className="text-sm font-normal text-dark-600 mb-4">Billing History</h3>
              <div className="bg-dark-100 shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-dark-400">
                  {mockInvoices.map((invoice) => (
                    <li key={invoice.id} className="px-4 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 bg-dark-100 rounded-md flex items-center justify-center">
                              <DollarSign className="h-5 w-5 text-dark-700 stroke-[1.5]" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center">
                              <div className="text-sm font-normal text-dark-600 mr-2">
                                {invoice.id}
                              </div>
                              {getStatusBadge(invoice.status)}
                            </div>
                            <div className="text-sm text-dark-700">{invoice.description}</div>
                            <div className="text-xs text-dark-600">
                              {new Date(invoice.date).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-sm font-normal text-dark-600">
                            ${invoice.amount.toFixed(2)}
                          </div>
                          <button
                            onClick={() => downloadInvoice(invoice.id)}
                            className="text-dark-600 hover:text-dark-700"
                          >
                            <Download className="h-4 w-4 stroke-[1.5]" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Billing Settings */}
            <div className="border-t border-dark-300 pt-8 mt-8">
              <h3 className="text-sm font-normal text-dark-600 mb-4">Billing Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-normal text-dark-600">Email invoices</div>
                    <div className="text-sm text-dark-700">Receive invoices via email</div>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4 text-dark-700 focus:ring-dark-7000 border-dark-400 rounded"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-normal text-dark-600">Auto-renewal</div>
                    <div className="text-sm text-dark-700">Automatically renew subscription</div>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4 text-dark-700 focus:ring-dark-7000 border-dark-400 rounded"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}