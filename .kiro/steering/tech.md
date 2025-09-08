# Technology Stack & Development Guidelines

## Core Technologies

### Frontend
- **Framework**: Next.js 15 with App Router
- **React**: Version 19.1.0 with React Server Components (RSC)
- **TypeScript**: Strict mode enabled for type safety
- **Styling**: Tailwind CSS v4 with CSS variables and custom design tokens
- **UI Components**: shadcn/ui with Radix UI primitives (New York style)
- **Icons**: Lucide React for consistent iconography
- **Colors**: use light pastel colors theme asthetically pleasing 
- **UX**: Use Proper layout and best component placements and everything for best user experience 

### Backend
- **API**: Next.js API Routes with App Router
- **Authentication**: NextAuth.js v5 (beta) with Prisma adapter
- **Database**: PostgreSQL with Prisma ORM
- **Validation**: Zod for runtime type validation
- **Password Hashing**: bcryptjs for secure authentication

### Development Tools
- **Package Manager**: npm
- **Linting**: ESLint with Next.js config
- **Build Tool**: Turbopack for faster development builds
- **Database Tools**: Prisma Studio for database management

## Common Commands

### Development
```bash
# Start development server with Turbopack
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

### Database Operations
```bash
# Generate Prisma client
npm run db:generate

# Push schema changes to database
npm run db:push

# Run database migrations
npm run db:migrate

# Seed database with sample data
npm run db:seed

# Open Prisma Studio
npm run db:studio
```

## Architecture Patterns

### File Structure Conventions
- Use App Router structure (`app/` directory)
- Group related routes in folders
- Use `page.tsx` for route components
- Use `layout.tsx` for shared layouts
- Place API routes in `app/api/`

### Component Organization
- **UI Components**: `components/ui/` (shadcn/ui components)
- **Feature Components**: `components/[feature]/`
- **Providers**: `components/providers/`
- **Utilities**: `lib/` directory

### Database Patterns
- Use Prisma schema with comprehensive models
- Implement audit logging for all critical operations
- Use enums for status fields and categories
- Follow naming conventions: camelCase for fields, PascalCase for models

### Authentication & Authorization
- NextAuth.js v5 with database sessions
- Role-based access control (RBAC) with permissions
- Audit logging for security tracking
- Password hashing with bcryptjs

## Code Style Guidelines

### TypeScript
- Use strict mode
- Define proper interfaces and types
- Use Zod for runtime validation
- Leverage type inference where possible

### React Components
- Use React Server Components by default
- Add 'use client' only when necessary
- Follow shadcn/ui patterns for consistency
- Use forwardRef for component composition

### Styling
- Use Tailwind CSS with design tokens
- Follow shadcn/ui color system
- Use CSS variables for theming
- Implement dark mode support

### Database
- Use Prisma for all database operations
- Implement proper relations and constraints
- Use transactions for complex operations
- Follow audit logging patterns