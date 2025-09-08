# Pekka HR - HRMS + Payroll + Travel Management System

A comprehensive enterprise solution that integrates human resource management, payroll processing, and travel/expense tracking into a unified platform.

## Features

- **Employee Management**: Complete employee lifecycle management with profiles, onboarding, and organizational hierarchy
- **Attendance Tracking**: Multi-method attendance recording (biometric, GPS, web, mobile)
- **Leave Management**: Comprehensive leave policies, requests, and approval workflows
- **Payroll Processing**: Automated salary calculations with statutory compliance
- **Expense Management**: Travel and expense claim processing with GPS verification
- **Performance Management**: OKRs, 360-degree feedback, and performance reviews
- **Document Management**: Secure document storage with workflows and approvals
- **Role-Based Access**: Admin, HR, Manager, Finance, and Employee roles
- **Mobile Support**: Progressive Web App with offline capabilities

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, NextAuth.js v5
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with multiple providers
- **UI Components**: Radix UI primitives with shadcn/ui
- **Styling**: Tailwind CSS with custom design system

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pekka-hr
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your database URL and other configuration:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/pekka_hr?schema=public"
   NEXTAUTH_SECRET="your-secret-key-here"
   NEXTAUTH_URL="http://localhost:3000"
   ```

4. **Set up the database**
   ```bash
   # Push the schema to your database
   npm run db:push
   
   # Generate Prisma client
   npm run db:generate
   
   # Seed the database with sample data
   npm run db:seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Test Credentials

After seeding the database, you can use these test accounts:

- **Admin**: admin@pekka-hr.com / admin123
- **HR Manager**: hr@pekka-hr.com / hr123  
- **Employee**: john.doe@pekka-hr.com / emp123

## Project Structure

```
pekka-hr/
├── app/                    # Next.js 15 App Router
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Main dashboard
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # Base UI components
│   └── providers/        # Context providers
├── lib/                  # Utility libraries
│   ├── auth.ts           # NextAuth configuration
│   ├── prisma.ts         # Prisma client
│   └── utils.ts          # Utility functions
├── prisma/               # Database schema and migrations
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Database seeding
├── types/                # TypeScript type definitions
└── middleware.ts         # Next.js middleware
```

## Database Schema

The system includes comprehensive models for:

- **User Management**: Users, accounts, sessions
- **Employee Data**: Employees, departments, hierarchies
- **Attendance**: Records, methods, status tracking
- **Leave Management**: Policies, requests, approvals
- **Payroll**: Runs, records, salary structures
- **Expenses**: Claims, categories, approvals
- **Performance**: Reviews, ratings, feedback
- **Documents**: Storage, versioning, workflows

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data
- `npm run db:studio` - Open Prisma Studio

### Database Management

```bash
# View and edit data in Prisma Studio
npm run db:studio

# Reset database and reseed
npm run db:push --force-reset
npm run db:seed
```

## Deployment

The application is ready for deployment on platforms like Vercel, Netlify, or any Node.js hosting service.

### Environment Variables for Production

Make sure to set these environment variables in your production environment:

- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Random secret for NextAuth.js
- `NEXTAUTH_URL` - Your production URL
- OAuth provider credentials (if using)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team or create an issue in the repository.