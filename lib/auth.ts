import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"

export const { handlers, auth, signIn, signOut, } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string
          },
          include: {
            employee: {
              include: {
                department: true
              }
            }
          }
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          employeeId: user.employee?.id,
          departmentId: user.employee?.departmentId,
          isActive: user.isActive
        }
      }
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours for security
    updateAge: 60 * 60, // 1 hour
  },
  jwt: {
    maxAge: 8 * 60 * 60, // 8 hours
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        // For OAuth providers, check if user exists and is active
        if (account?.provider !== "credentials") {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
            include: { 
              employee: {
                include: {
                  department: true
                }
              }
            }
          })

          if (!existingUser) {
            // For OAuth, only allow sign-in if user already exists in system
            // This prevents unauthorized access from OAuth providers
            console.log(`OAuth sign-in attempted for non-existent user: ${user.email}`)
            return false
          }

          if (!existingUser.isActive) {
            console.log(`Sign-in attempted for inactive user: ${user.email}`)
            return false
          }

          // Update user info from OAuth provider if needed
          if (profile?.name && profile.name !== existingUser.name) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { 
                name: profile.name,
                image: profile.image || user.image,
                lastLoginAt: new Date()
              }
            })
          }

          // Set user properties for JWT
          user.role = existingUser.role
          user.employeeId = existingUser.employee?.id
          user.departmentId = existingUser.employee?.departmentId
          user.isActive = existingUser.isActive
        } else {
          // For credentials provider, update last login
          if (user.id) {
            await prisma.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() }
            })
          }
        }

        return true
      } catch (error) {
        console.error("Sign-in error:", error)
        return false
      }
    },
    async jwt({ token, user, account, trigger }) {
      try {
        // Initial sign in
        if (user) {
          token.role = user.role
          token.employeeId = user.employeeId
          token.departmentId = user.departmentId
          token.isActive = user.isActive
          token.provider = account?.provider
        }

        // Check if user is still active on each token refresh or update
        if (token.sub && (trigger === "update" || !token.role)) {
          const currentUser = await prisma.user.findUnique({
            where: { id: token.sub },
            include: { 
              employee: {
                include: {
                  department: true
                }
              }
            }
          })

          if (!currentUser || !currentUser.isActive) {
            console.log(`Token refresh failed for user: ${token.sub} - User inactive or not found`)
            return null // This will force a sign out
          }

          // Update token with latest user data
          token.role = currentUser.role
          token.employeeId = currentUser.employee?.id
          token.departmentId = currentUser.employee?.departmentId
          token.isActive = currentUser.isActive
          token.name = currentUser.name
          token.email = currentUser.email
        }

        return token
      } catch (error) {
        console.error("JWT callback error:", error)
        return null // Force sign out on error
      }
    },
    async session({ session, token }) {
      if (token && token.isActive) {
        session.user.id = token.sub!
        session.user.role = token.role as UserRole
        session.user.employeeId = token.employeeId as string | undefined
        session.user.departmentId = token.departmentId as string | undefined
        session.user.isActive = token.isActive as boolean
        session.user.provider = token.provider as string | undefined
        session.user.name = token.name as string | null
        session.user.email = token.email as string
      }
      return session
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  events: {
    async signIn({ user, account }) {
      // Log successful sign-ins for audit
      if (user.id) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: "LOGIN",
            resource: "AUTH",
            newValues: {
              provider: account?.provider,
              method: account?.provider || "credentials"
            },
            timestamp: new Date()
          }
        }).catch(console.error) // Don't fail auth if audit log fails
      }
    },
    async signOut(message) {
      // Log sign-outs for audit
      if ("token" in message && message.token?.sub) {
        await prisma.auditLog.create({
          data: {
            userId: message.token.sub,
            action: "LOGOUT",
            resource: "AUTH",
            timestamp: new Date()
          }
        }).catch(console.error) // Don't fail auth if audit log fails
      }
    }
  },
})