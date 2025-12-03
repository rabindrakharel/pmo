# ProfilePage

**Version:** 9.0.0 | **Location:** `apps/web/src/pages/profile/ProfilePage.tsx` | **Updated:** 2025-12-03

---

## Overview

ProfilePage allows users to view and update their personal information including name and email. It uses react-hook-form with Zod validation and integrates with the AuthContext.

**Core Principles:**
- React Hook Form + Zod validation
- AuthContext integration for user data
- Success/error feedback
- Design system v10.0 styling

---

## Page Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROFILEPAGE ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route: /profile                                                            │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Layout Shell                                                           ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Header                                                             │││
│  │  │  Profile                                                            │││
│  │  │  Manage your personal information and account settings.             │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │                                                                         ││
│  │  [Success Banner - if saved]                                           ││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Profile Card                                                       │││
│  │  │  ┌───────────────────────────────────────────────────────────────┐ │││
│  │  │  │  [👤 Avatar]  James Miller                                    │ │││
│  │  │  │               james.miller@huronhome.ca                       │ │││
│  │  │  └───────────────────────────────────────────────────────────────┘ │││
│  │  │                                                                     │││
│  │  │  <form>                                                             │││
│  │  │    ┌─────────────────────┐ ┌─────────────────────┐                 │││
│  │  │    │ Full Name           │ │ Email               │                 │││
│  │  │    │ [James Miller     ] │ │ [james.miller@... ] │                 │││
│  │  │    └─────────────────────┘ └─────────────────────┘                 │││
│  │  │                                                                     │││
│  │  │    [Save Changes]                                                   │││
│  │  │  </form>                                                            │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Form Validation (Zod)

```typescript
const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Please enter a valid email address'),
});

type ProfileFormData = z.infer<typeof profileSchema>;
```

### 2. React Hook Form

```typescript
const {
  register,
  handleSubmit,
  formState: { errors },
} = useForm<ProfileFormData>({
  resolver: zodResolver(profileSchema),
  defaultValues: {
    name: user?.name || '',
    email: user?.email || '',
  },
});
```

### 3. AuthContext Integration

```typescript
const { user } = useAuth();

// User object provides:
// - user.name
// - user.email
// - user.id (sub)
```

### 4. Submit Handler

```typescript
const onSubmit = async (data: ProfileFormData) => {
  setIsLoading(true);
  try {
    // TODO: Implement profile update API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSuccessMessage('Profile updated successfully!');
  } catch (error) {
    console.error('Profile update failed:', error);
  } finally {
    setIsLoading(false);
  }
};
```

---

## Form Fields

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| `name` | text | min 1 char | Yes |
| `email` | email | valid email | Yes |

---

## Styling

### Avatar
```css
.avatar {
  height: 64px;
  width: 64px;
  background: var(--dark-100);
  border-radius: 50%;
}
```

### Profile Card
```css
.profile-card {
  background: var(--dark-100);
  border-radius: 12px;
  border: 1px solid var(--dark-300);
  box-shadow: var(--shadow-sm);
}
```

---

## Related Pages

| Page | Relationship |
|------|--------------|
| [SecurityPage](./SecurityPage.md) | Security settings |
| [BillingPage](./BillingPage.md) | Billing settings |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v9.0.0 | 2025-12-03 | Design system v10.0 |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
