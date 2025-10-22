# Landing Page & Customer Onboarding System

## Overview

A comprehensive landing page and customer onboarding system has been built for the Huron PMO platform, enabling customers to discover, signup, and configure their workspace with ease.

## Features Built

### 1. Landing Page (`/`)
**Location:** `apps/web/src/pages/LandingPage.tsx`

A modern, professional landing page featuring:

**Hero Section:**
- Eye-catching gradient background
- Clear value proposition
- Call-to-action buttons (Get Started, Learn More)
- Trust indicators (14-day free trial, no credit card, cancel anytime)

**Statistics Section:**
- 98% customer satisfaction
- 50K+ projects completed
- 500+ organizations
- 24/7 support available

**Features Section:**
Six key features with icons:
- Project Management (FolderOpen icon)
- Task Management (CheckSquare icon)
- Business Units (Building2 icon)
- Team Collaboration (Users icon)
- Enterprise Security (Shield icon)
- Analytics & Reports (BarChart3 icon)

**Pricing Section:**
Three pricing tiers:
- Starter ($29/month) - 5 projects, 50 tasks, 5 team members
- Professional ($99/month) - Unlimited projects/tasks, 25 members (Most Popular)
- Enterprise (Custom pricing) - Unlimited everything + dedicated support

**Testimonials Section:**
Real customer testimonials from:
- Sarah Thompson (Thompson Family Residence)
- David Chen (The Chen Estate)
- Jennifer Walsh (Square One Shopping Centre)

**Call-to-Action Section:**
Gradient background with final conversion opportunity

**Footer:**
- Company information
- Product links
- Support resources
- Copyright notice

### 2. Signup Page (`/signup`)
**Location:** `apps/web/src/pages/SignupPage.tsx`

**Left Panel - Registration Form:**
- Full Name / Organization Name field
- Email address field
- Customer Type selection (4 types):
  - Residential - Individual homeowners and families
  - Commercial - Businesses and retail establishments
  - Municipal - Government and public sector
  - Industrial - Manufacturing and industrial facilities
- Password field (minimum 8 characters)
- Confirm Password field
- Terms & Conditions checkbox
- Eye icons for password visibility toggle

**Right Panel - Marketing Content:**
- Feature highlights
- Customer testimonial
- Professional gradient background

**Form Validation:**
- Email format validation
- Password strength (8+ characters)
- Password matching verification
- Terms acceptance requirement

**API Integration:**
- Endpoint: `POST /api/v1/auth/customer/signup`
- Auto-generates customer number (APP-0001, APP-0002, etc.)
- Stores hashed password using bcrypt
- Returns JWT token for immediate authentication
- Redirects to onboarding page after success

### 3. Onboarding/Configuration Page (`/onboarding`)
**Location:** `apps/web/src/pages/OnboardingPage.tsx`

**Entity Configuration Wizard:**

Users can select which modules they want to enable in their workspace:

**Core Operations (5 modules):**
- ✅ Projects (Recommended)
- ✅ Tasks (Recommended)
- ✅ Business Units (Recommended)
- Offices
- Worksites

**People Management (4 modules):**
- ✅ Employees (Recommended)
- Roles
- Positions
- Customers

**Content & Documentation (3 modules):**
- Wiki
- Forms
- Artifacts

**Commerce & Operations (5 modules):**
- Products
- Inventory
- Orders
- Invoices
- Shipments

**Marketing & Communication (1 module):**
- Marketing (Email campaigns)

**Quick Actions:**
- "Select Recommended" - Pre-selects the 4 recommended modules
- "Select All" - Enables all 18 modules
- "Clear All" - Deselects everything

**Features:**
- Visual card-based selection
- Icon representation for each module
- "Recommended" badges on key modules
- Selection count indicator
- Error handling for empty selection
- Skip option to configure later
- Info box explaining modules can be changed anytime

**API Integration:**
- Endpoint: `PUT /api/v1/auth/customer/configure`
- Stores selected entities in customer profile
- Redirects to main dashboard (/project) after configuration

### 4. Backend API Support

**Customer Signup Endpoint:**
```typescript
POST /api/v1/auth/customer/signup
Body: {
  name: string,
  primary_email: string,
  password: string,
  cust_type?: string
}
Response: {
  token: string,
  customer: {
    id: string,
    name: string,
    email: string,
    entities: string[]
  }
}
```

**Customer Signin Endpoint:**
```typescript
POST /api/v1/auth/customer/signin
Body: {
  email: string,
  password: string
}
Response: {
  token: string,
  customer: {
    id: string,
    name: string,
    email: string,
    entities: string[]
  }
}
```

**Configuration Endpoint:**
```typescript
PUT /api/v1/auth/customer/configure
Headers: { Authorization: "Bearer <token>" }
Body: {
  entities: string[]
}
Response: {
  id: string,
  name: string,
  email: string,
  entities: string[],
  cust_type: string
}
```

**Customer Profile Endpoint:**
```typescript
GET /api/v1/auth/customer/me
Headers: { Authorization: "Bearer <token>" }
Response: {
  id: string,
  name: string,
  email: string,
  entities: string[],
  cust_type: string
}
```

### 5. Database Schema

**Customer Table (`d_cust`):**
```sql
CREATE TABLE app.d_cust (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  cust_number text NOT NULL,
  cust_type text NOT NULL,
  cust_status text NOT NULL,
  primary_email text,
  password_hash text,
  entities text[] DEFAULT ARRAY[]::text[],
  last_login_ts timestamptz,
  failed_login_attempts int DEFAULT 0,
  account_locked_until timestamptz,
  -- ... other fields
);
```

**Key Fields:**
- `password_hash` - bcrypt hashed password for authentication
- `entities` - Array of activated entity types (e.g., ['project', 'task', 'wiki'])
- `last_login_ts` - Session tracking
- `failed_login_attempts` - Security lockout mechanism
- `cust_type` - Customer classification (residential, commercial, municipal, industrial)

### 6. Frontend Integration

**Updated Files:**
1. `apps/web/src/lib/api.ts` - Added customer auth API methods
2. `apps/web/src/App.tsx` - Added routes for landing, signup, onboarding
3. `apps/web/src/pages/LandingPage.tsx` - New landing page component
4. `apps/web/src/pages/SignupPage.tsx` - New signup form component
5. `apps/web/src/pages/OnboardingPage.tsx` - New onboarding wizard component

**Routes Added:**
```typescript
/ → LandingPage (public)
/signup → SignupPage (public)
/onboarding → OnboardingPage (protected, requires auth)
```

**Navigation Flow:**
```
Landing Page → Signup → Login (auto) → Onboarding → Dashboard
     ↓                                                    ↓
  Features                                          Entity Config
  Pricing                                          (Select modules)
  Testimonials
```

## User Journey

### New Customer Journey:

1. **Discovery**: Visit landing page (`/`)
   - View features, pricing, testimonials
   - Click "Get Started" or "Start Free Trial"

2. **Registration**: Signup page (`/signup`)
   - Enter name, email, password
   - Select customer type (residential/commercial/municipal/industrial)
   - Accept terms and conditions
   - Submit form

3. **Auto-Login**: Immediate authentication
   - JWT token stored in localStorage
   - User automatically logged in

4. **Onboarding**: Configuration wizard (`/onboarding`)
   - Select desired modules (projects, tasks, etc.)
   - Use quick actions (recommended, all, clear)
   - Submit configuration

5. **Main Application**: Dashboard (`/project`)
   - Access only configured entities
   - Full PMO platform features
   - Can reconfigure modules later in settings

### Returning Customer Journey:

1. Visit landing page (`/`)
2. Click "Sign In" → Login page (`/login`)
3. Enter credentials
4. Redirect to dashboard with previously configured modules

## Testing

### Backend API Testing:

**Test Signup:**
```bash
curl -X POST http://localhost:4000/api/v1/auth/customer/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Company",
    "primary_email": "test@example.com",
    "password": "password123",
    "cust_type": "commercial"
  }'
```

**Test Configuration:**
```bash
curl -X PUT http://localhost:4000/api/v1/auth/customer/configure \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "entities": ["project", "task", "biz", "employee"]
  }'
```

**Test Profile:**
```bash
curl -X GET http://localhost:4000/api/v1/auth/customer/me \
  -H "Authorization: Bearer <token>"
```

### Frontend Testing:

1. Start platform: `./tools/start-all.sh`
2. Open browser: `http://localhost:5173`
3. Navigate through:
   - Landing page features
   - Signup form validation
   - Customer type selection
   - Onboarding module selection
   - Dashboard access

## Design Philosophy

**Professional, Low-Glare Appearance:**
- Slate/gray color scheme instead of bright blue
- Subtle gradients for depth
- Shadow-based elevation
- Rounded corners (rounded-lg, rounded-xl)
- Smooth transitions (150ms)

**Color Palette:**
- Primary: Slate gradient (from-slate-600 to-slate-700)
- Secondary: White with subtle gray borders
- Success: Emerald green (for checkmarks, indicators)
- Danger: Soft red (for errors)
- Backgrounds: Gray-50, Gray-100

**Typography:**
- Font: Open Sans (Google Fonts)
- Headings: Bold (font-bold)
- Body: Normal weight
- Labels: Medium weight (font-medium)

**Icons:**
- Library: Lucide React
- Consistent icon sizing (h-5 w-5, h-6 w-6)
- Icon-text alignment with flex utilities

## Security Features

**Password Security:**
- Minimum 8 characters required
- bcrypt hashing (10 rounds)
- Password confirmation on signup
- Visibility toggle (eye icon)

**Authentication:**
- JWT token-based auth
- Token expiry (configured in JWT_EXPIRES_IN)
- Stored in localStorage
- Included in all authenticated requests

**Account Protection:**
- Failed login attempt tracking
- Account lockout after 5 failed attempts (30 minutes)
- Email uniqueness validation
- SQL injection protection (parameterized queries)

## Future Enhancements

### Potential Additions:

1. **Email Verification:**
   - Send confirmation email after signup
   - Verify email before full account activation

2. **Social Login:**
   - Google OAuth integration
   - Microsoft/LinkedIn login options

3. **Multi-step Onboarding:**
   - Step 1: Basic info
   - Step 2: Entity selection
   - Step 3: Team invites
   - Step 4: Workspace customization

4. **Progress Indicators:**
   - Show completion percentage
   - Guide users through required steps

5. **Interactive Demo:**
   - Guided tour of platform features
   - Sample projects/tasks for exploration

6. **A/B Testing:**
   - Test different landing page variations
   - Optimize conversion rates

7. **Analytics:**
   - Track signup funnel
   - Identify drop-off points
   - Measure feature adoption

8. **Customer Segmentation:**
   - Industry-specific templates
   - Pre-configured entity sets by customer type
   - Customized onboarding flows

## Support & Documentation

**Access:**
- Landing Page: http://localhost:5173
- Signup Page: http://localhost:5173/signup
- Onboarding: http://localhost:5173/onboarding (requires auth)

**Related Documentation:**
- [Main README](./README.md) - Project overview
- [Frontend Guide](./apps/web/README.md) - UI/UX documentation
- [Backend API](./apps/api/README.md) - API reference
- [Database Schema](./db/README.md) - Database structure
- [Customer DDL](./db/14_d_cust.ddl) - Customer table definition

**Management Tools:**
- Start platform: `./tools/start-all.sh`
- Stop platform: `./tools/stop-all.sh`
- View logs: `./tools/logs-web.sh`, `./tools/logs-api.sh`
- Test API: `./tools/test-api.sh`

---

**Status:** ✅ Fully Implemented and Tested
**Version:** 1.0
**Last Updated:** 2025-10-21
