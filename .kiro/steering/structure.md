# Project Structure & Organization

## Root Directory Structure

```
pekka-hr/
├── app/                    # Next.js 15 App Router
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Main dashboard and modules
│   ├── globals.css        # Global styles with Tailwind
│   ├── layout.tsx         # Root layout with providers
│   └── page.tsx           # Landing/login page
├── components/            # React components
│   ├── ui/               # shadcn/ui base components
│   ├── providers/        # Context providers
│   └── [feature]/       # Feature-specific components
├── lib/                  # Utility libraries
│   ├── auth.ts           # NextAuth configuration
│   ├── prisma.ts         # Prisma client instance
│   ├── utils.ts          # Utility functions
│   └── validations/      # Zod schemas
├── prisma/               # Database schema and migrations
│   ├── schema.prisma     # Database schema
│   ├── seed.ts           # Database seeding
│   └── migrations/       # Migration files
├── types/                # TypeScript type definitions
├── public/               # Static assets
└── middleware.ts         # Next.js middleware for auth
```

## App Router Organization

### Route Structure
```
app/
├── (auth)/               # Route group for auth pages
│   ├── signin/
│   └── signup/
├── dashboard/            # Protected dashboard routes
│   ├── employees/        # Employee management
│   ├── attendance/       # Attendance tracking
│   ├── leave/           # Leave management
│   ├── payroll/         # Payroll processing
│   ├── expenses/        # Expense management
│   ├── performance/     # Performance reviews
│   ├── documents/       # Document management
│   └── settings/        # System settings
├── api/                 # API routes
│   ├── auth/           # NextAuth endpoints
│   ├── employees/      # Employee CRUD operations
│   ├── attendance/     # Attendance operations
│   ├── payroll/        # Payroll operations
│   └── expenses/       # Expense operations
└── globals.css         # Global styles
```

## Component Organization

### UI Components (`components/ui/`)
- Base components from shadcn/ui
- Consistent styling with design system
- Reusable across all features
- Examples: Button, Card, Input, Dialog, Table

### Feature Components (`components/[feature]/`)
```
components/
├── employees/
│   ├── employee-form.tsx
│   ├── employee-list.tsx
│   └── employee-card.tsx
├── attendance/
│   ├── attendance-tracker.tsx
│   ├── check-in-out.tsx
│   └── attendance-calendar.tsx
├── payroll/
│   ├── payroll-calculator.tsx
│   ├── salary-slip.tsx
│   └── payroll-reports.tsx
└── shared/
    ├── data-table.tsx
    ├── status-badge.tsx
    └── date-picker.tsx
```

## Database Schema Organization

### Core Models
- **Authentication**: User, Account, Session, Role, Permission
- **Employee Management**: Employee, Department
- **Attendance**: AttendanceRecord, CheckInOut, Location
- **Leave Management**: LeavePolicy, LeaveRequest
- **Payroll**: PayrollRun, PayrollRecord
- **Expenses**: ExpenseClaim
- **Performance**: PerformanceReview
- **Documents**: Document
- **Audit**: AuditLog

### Naming Conventions
- **Models**: PascalCase (e.g., `Employee`, `AttendanceRecord`)
- **Fields**: camelCase (e.g., `firstName`, `employeeCode`)
- **Tables**: snake_case mapping (e.g., `employees`, `attendance_records`)
- **Enums**: UPPER_CASE values (e.g., `ACTIVE`, `PENDING`)

## File Naming Conventions

### Pages and Layouts
- `page.tsx` - Route page component
- `layout.tsx` - Layout component
- `loading.tsx` - Loading UI
- `error.tsx` - Error UI
- `not-found.tsx` - 404 page

### Components
- `kebab-case.tsx` - Component files
- `PascalCase` - Component names
- `index.ts` - Barrel exports

### API Routes
- `route.ts` - API route handlers
- Use HTTP method names (GET, POST, PUT, DELETE)

## Module Organization

### HR Management Module
```
dashboard/employees/
├── page.tsx              # Employee list
├── [id]/
│   ├── page.tsx         # Employee details
│   └── edit/page.tsx    # Employee edit form
├── new/page.tsx         # New employee form
└── components/
    ├── employee-form.tsx
    ├── employee-table.tsx
    └── employee-filters.tsx
```

### Payroll Module
```
dashboard/payroll/
├── page.tsx              # Payroll dashboard
├── runs/
│   ├── page.tsx         # Payroll runs list
│   ├── [id]/page.tsx    # Run details
│   └── new/page.tsx     # New payroll run
├── salary-structure/
└── reports/
```

## State Management

### Server State
- Use React Server Components for data fetching
- Implement proper caching strategies
- Use Prisma for database operations

### Client State
- Minimal client state with React hooks
- Use Context for global UI state
- Form state with controlled components

## Security Patterns

### Authentication Flow
- NextAuth.js v5 with database sessions
- Role-based access control middleware
- Protected routes with proper redirects

### Data Access
- Server-side data fetching in RSCs
- Proper authorization checks
- Audit logging for sensitive operations

## Performance Considerations

### Code Splitting
- Automatic with Next.js App Router
- Dynamic imports for heavy components
- Lazy loading for non-critical features

### Database Optimization
- Proper indexing in Prisma schema
- Efficient queries with select/include
- Connection pooling and caching