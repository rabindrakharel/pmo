# SignupPage

**Version:** 9.0.0 | **Location:** `apps/web/src/pages/SignupPage.tsx` | **Updated:** 2025-12-03

---

## Overview

SignupPage provides customer registration with multi-step form validation. It uses react-hook-form with Zod schema validation and includes customer type selection (residential, commercial, municipal, industrial).

**Core Principles:**
- React Hook Form + Zod validation
- Customer type selection (4 types)
- Password visibility toggle
- Marketing panel with testimonial
- Redirects to /onboarding after signup

---

## Page Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SIGNUPPAGE ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route: /signup                                                             │
│                                                                              │
│  ┌─────────────────────────────────┬───────────────────────────────────────┐│
│  │  Left Panel (Form)              │  Right Panel (Marketing)             ││
│  │                                 │                                       ││
│  │  ← Back to home                 │  Start managing your projects today  ││
│  │                                 │                                       ││
│  │  [Logo] Huron PMO               │  ✓ Full project and task management  ││
│  │                                 │  ✓ Team collaboration tools          ││
│  │  Create your account            │  ✓ Advanced analytics and reporting  ││
│  │                                 │  ✓ Enterprise-grade security         ││
│  │  Full Name / Organization:      │  ✓ 24/7 customer support             ││
│  │  [___________________________]  │                                       ││
│  │                                 │  ┌─────────────────────────────────┐ ││
│  │  Email address:                 │  │  "Huron PMO has transformed    │ ││
│  │  [___________________________]  │  │  how we manage our operations" │ ││
│  │                                 │  │  - Sarah Thompson              │ ││
│  │  Customer Type:                 │  │    Operations Director         │ ││
│  │  ┌────────────┐ ┌────────────┐  │  └─────────────────────────────────┘ ││
│  │  │ Residential│ │ Commercial │  │                                       ││
│  │  └────────────┘ └────────────┘  │                                       ││
│  │  ┌────────────┐ ┌────────────┐  │                                       ││
│  │  │ Municipal  │ │ Industrial │  │                                       ││
│  │  └────────────┘ └────────────┘  │                                       ││
│  │                                 │                                       ││
│  │  Password:                      │                                       ││
│  │  [___________________________]  │                                       ││
│  │                                 │                                       ││
│  │  Confirm Password:              │                                       ││
│  │  [___________________________]  │                                       ││
│  │                                 │                                       ││
│  │  [✓] I agree to Terms...        │                                       ││
│  │                                 │                                       ││
│  │  [Create Account]               │                                       ││
│  └─────────────────────────────────┴───────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Zod Validation Schema

```typescript
const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  custType: z.enum(['residential', 'commercial', 'municipal', 'industrial']),
  acceptTerms: z.boolean().refine(val => val === true, 'You must accept the terms'),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});
```

### 2. Customer Types

```typescript
const customerTypes = [
  { value: 'residential', label: 'Residential', description: 'Individual homeowners...' },
  { value: 'commercial', label: 'Commercial', description: 'Businesses and retail...' },
  { value: 'municipal', label: 'Municipal', description: 'Government and public...' },
  { value: 'industrial', label: 'Industrial', description: 'Manufacturing...' },
];
```

### 3. Signup Handler

```typescript
const onSubmit = async (data: SignupFormData) => {
  const response = await fetch('/api/v1/auth/customer/signup', {
    method: 'POST',
    body: JSON.stringify({
      name: data.name,
      primary_email: data.email,
      password: data.password,
      cust_type: data.custType,
    }),
  });

  // Store token and redirect to onboarding
  localStorage.setItem('auth_token', result.token);
  localStorage.setItem('user_type', 'customer');
  navigate('/onboarding');
};
```

---

## Form Fields

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| `name` | text | min 2 chars | Yes |
| `email` | email | valid email | Yes |
| `password` | password | min 8 chars | Yes |
| `confirmPassword` | password | must match | Yes |
| `custType` | radio | enum | Yes |
| `acceptTerms` | checkbox | must be true | Yes |

---

## API Endpoint

```
POST /api/v1/auth/customer/signup
Body: { name, primary_email, password, cust_type }
Response: { token, customer: { id, ... } }
```

---

## Related Pages

| Page | Relationship |
|------|--------------|
| [WelcomePage](./WelcomePage.md) | Login |
| [OnboardingPage](./OnboardingPage.md) | Post-signup |
| [LandingPage](./LandingPage.md) | Back link |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v9.0.0 | 2025-12-03 | Customer type selection |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
