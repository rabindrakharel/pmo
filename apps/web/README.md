# PMO Task Management Platform - Web Application

A modern React-based frontend for the PMO Enterprise Task Management Platform.

## Features

✅ **Authentication System**
- JWT-based login/logout
- Secure token management
- Protected routes
- Auto-refresh user session

✅ **User Interface Pages**
- **Login Page**: Secure authentication with form validation
- **Dashboard**: Overview of projects, tasks, and recent activity
- **Profile**: User profile management and editing
- **Settings**: Application preferences and notifications
- **Security**: Password management and 2FA settings
- **Billing**: Subscription management and invoice history

✅ **Modern Tech Stack**
- React 19 with TypeScript
- Tailwind CSS for styling
- React Hook Form with Zod validation
- React Router for navigation
- Axios for API communication
- Lucide React icons

## Getting Started

### Prerequisites

- Node.js 18+ (compatible with current setup)
- pnpm package manager
- PMO API server running on http://localhost:4000

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Start development server:
```bash
pnpm dev
```

The application will be available at http://localhost:3000

### Demo Login Credentials

Use these credentials to test the application:

- **Email**: james.miller@huronhome.ca
- **Password**: password123

## Available Scripts

- `pnpm dev` - Start development server on port 3000
- `pnpm build` - Build for production
- `pnpm lint` - Run ESLint
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm preview` - Preview production build

## API Integration

The application is configured to work with the PMO API backend:

- **Base URL**: http://localhost:4000
- **Authentication**: JWT Bearer tokens
- **Endpoints Used**:
  - `POST /api/v1/auth/login` - User authentication
  - `POST /api/v1/auth/logout` - User logout
  - `GET /api/v1/auth/profile` - Get user profile
  - `GET /api/v1/auth/permissions` - Get user permissions

## Architecture

### Authentication Flow
1. User submits login form
2. API returns JWT token and user data
3. Token stored in localStorage
4. All subsequent requests include Authorization header
5. Protected routes check authentication status

### Component Structure
```
src/
├── components/
│   ├── auth/
│   │   └── LoginForm.tsx
│   └── layout/
│       └── Layout.tsx
├── contexts/
│   └── AuthContext.tsx
├── lib/
│   └── api.ts
├── pages/
│   ├── DashboardPage.tsx
│   ├── ProfilePage.tsx
│   ├── SettingsPage.tsx
│   ├── SecurityPage.tsx
│   └── BillingPage.tsx
└── App.tsx
```

### State Management
- **AuthContext**: Manages authentication state globally
- **React Hook Form**: Handles form state and validation
- **Local Storage**: Persists JWT tokens between sessions

## Security Features

- Input validation with Zod schemas
- XSS protection through React's built-in escaping
- JWT token expiration handling
- Secure password input fields
- Protected route enforcement

## Styling

The application uses Tailwind CSS for styling with:
- Responsive design (mobile-first)
- Consistent color scheme (blue primary)
- Form styling with @tailwindcss/forms
- Loading states and animations
- Accessible UI components

## Production Deployment

1. Build the application:
```bash
pnpm build
```

2. Serve the built files:
```bash
pnpm preview
```

For production deployment, ensure:
- Environment variables are properly configured
- API base URL points to production API
- HTTPS is enabled
- Proper CORS configuration on API

## Future Enhancements

- Two-factor authentication UI
- Real-time notifications
- Dark mode support
- Offline support with service workers
- Advanced role-based UI permissions
- File upload capabilities
- Advanced data tables and filtering
