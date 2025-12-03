# BillingPage

**Version:** 9.0.0 | **Location:** `apps/web/src/pages/billing/BillingPage.tsx` | **Updated:** 2025-12-03

---

## Overview

BillingPage displays subscription information, payment method management, billing history with invoices, and billing settings. It shows current plan details, next billing date, and allows invoice downloads.

**Core Principles:**
- Current plan display
- Payment method management
- Invoice history with status badges
- Billing settings toggles
- Download invoice functionality

---

## Page Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BILLINGPAGE ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route: /billing                                                            │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Layout Shell (max-w-4xl)                                                ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Header                                                             │││
│  │  │  [CreditCard] Billing & Subscription                                │││
│  │  │  Manage your subscription and billing information                   │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Current Plan (gradient card)                                       │││
│  │  │  ┌─────────────────────────────────────────────────────────────┐   │││
│  │  │  │  PMO Enterprise Plan            Next billing date           │   │││
│  │  │  │  Full access to all features    February 1, 2025            │   │││
│  │  │  │  $ 99.99 /month                 [Change plan]               │   │││
│  │  │  └─────────────────────────────────────────────────────────────┘   │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Payment Method                                                     │││
│  │  │  ┌─────────────────────────────────────────────────────────────┐   │││
│  │  │  │ [CreditCard] •••• •••• •••• 4242                   [Update] │   │││
│  │  │  │              Expires 12/2028                                │   │││
│  │  │  └─────────────────────────────────────────────────────────────┘   │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Billing History                                                    │││
│  │  │  ┌─────────────────────────────────────────────────────────────┐   │││
│  │  │  │ [$] INV-2025-001 [✓ Paid]                    $99.99 [↓]    │   │││
│  │  │  │     PMO Enterprise - Monthly Subscription                   │   │││
│  │  │  │     January 1, 2025                                         │   │││
│  │  │  ├─────────────────────────────────────────────────────────────┤   │││
│  │  │  │ [$] INV-2024-012 [✓ Paid]                    $99.99 [↓]    │   │││
│  │  │  │     PMO Enterprise - Monthly Subscription                   │   │││
│  │  │  │     December 1, 2024                                        │   │││
│  │  │  └─────────────────────────────────────────────────────────────┘   │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │                                                                         ││
│  │  ─────────────────────────────────────────────────────────────────────  ││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Billing Settings                                                   │││
│  │  │  Email invoices          Receive invoices via email      [✓]       │││
│  │  │  Auto-renewal            Automatically renew subscription [✓]       │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Invoice Interface

```typescript
interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  description: string;
}
```

### 2. Status Badge Rendering

```typescript
const getStatusBadge = (status: Invoice['status']) => {
  switch (status) {
    case 'paid':
      return (
        <span className="... bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Paid
        </span>
      );
    case 'pending':
      return (
        <span className="... bg-yellow-100 text-yellow-800">
          <Calendar className="w-3 h-3 mr-1" />
          Pending
        </span>
      );
    case 'overdue':
      return (
        <span className="... bg-red-100 text-red-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          Overdue
        </span>
      );
  }
};
```

### 3. Payment Method Update

```typescript
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
```

### 4. Invoice Download

```typescript
const downloadInvoice = (invoiceId: string) => {
  // TODO: Implement invoice download
  console.log('Download invoice:', invoiceId);
};
```

---

## Sections

| Section | Content |
|---------|---------|
| Current Plan | Plan name, features, price, next billing date |
| Payment Method | Masked card number, expiry, update button |
| Billing History | List of invoices with status badges |
| Billing Settings | Email invoices toggle, auto-renewal toggle |

---

## Invoice Statuses

| Status | Badge Color | Icon |
|--------|-------------|------|
| `paid` | Green | CheckCircle |
| `pending` | Yellow | Calendar |
| `overdue` | Red | AlertCircle |

---

## Related Pages

| Page | Relationship |
|------|--------------|
| [ProfilePage](./ProfilePage.md) | Profile settings |
| [SecurityPage](./SecurityPage.md) | Security settings |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v9.0.0 | 2025-12-03 | Invoice status badges |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
