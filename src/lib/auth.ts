import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
// Import Role from Prisma Client
import { Role } from "@prisma/client";
import { logAuditEvent } from "@/lib/audit";

// Brute-force protection: in-memory map tracking failed logins per email/username
const LOGIN_ATTEMPTS = new Map<string, { count: number; lockUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email/Username dan password wajib diisi");
        }

        const identifier = credentials.email.toLowerCase().trim();
        const now = Date.now();
        const attempt = LOGIN_ATTEMPTS.get(identifier);

        if (attempt && attempt.lockUntil > now) {
          const remainingMin = Math.ceil((attempt.lockUntil - now) / 60000);
          throw new Error(`Terlalu banyak percobaan masuk. Akun terkunci sementara. Silakan coba lagi dalam ${remainingMin} menit.`);
        }

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: credentials.email },
              { username: credentials.email },
            ],
          },
        });

        if (!user) {
          await logAuditEvent({
            actionType: "LOGIN_FAILURE",
            description: `Failed login attempt for identifier: ${identifier} (User not found)`,
          });

          const currentAttempt = LOGIN_ATTEMPTS.get(identifier) || { count: 0, lockUntil: 0 };
          currentAttempt.count += 1;
          if (currentAttempt.count >= MAX_ATTEMPTS) {
            currentAttempt.lockUntil = now + LOCKOUT_DURATION;
            LOGIN_ATTEMPTS.set(identifier, currentAttempt);
            throw new Error("Terlalu banyak percobaan masuk. Akun Anda dikunci selama 15 menit.");
          } else {
            LOGIN_ATTEMPTS.set(identifier, currentAttempt);
            throw new Error(`Email/Username atau password salah. Sisa percobaan: ${MAX_ATTEMPTS - currentAttempt.count}`);
          }
        }

        if (!user.isActive) {
          await logAuditEvent({
            actionType: "LOGIN_FAILURE",
            description: `Failed login attempt: Account for ${user.name} (${identifier}) is inactive`,
            targetId: user.id,
            targetName: user.name,
          });
          throw new Error("Akun Anda tidak aktif. Hubungi administrator.");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          await logAuditEvent({
            actionType: "LOGIN_FAILURE",
            description: `Failed login attempt: Invalid password for user ${user.name} (${identifier})`,
            targetId: user.id,
            targetName: user.name,
          });

          const currentAttempt = LOGIN_ATTEMPTS.get(identifier) || { count: 0, lockUntil: 0 };
          currentAttempt.count += 1;
          if (currentAttempt.count >= MAX_ATTEMPTS) {
            currentAttempt.lockUntil = now + LOCKOUT_DURATION;
            LOGIN_ATTEMPTS.set(identifier, currentAttempt);
            throw new Error("Terlalu banyak percobaan masuk. Akun Anda dikunci selama 15 menit.");
          } else {
            LOGIN_ATTEMPTS.set(identifier, currentAttempt);
            throw new Error(`Email/Username atau password salah. Sisa percobaan: ${MAX_ATTEMPTS - currentAttempt.count}`);
          }
        }

        // Reset attempts on successful login
        LOGIN_ATTEMPTS.delete(identifier);

        await logAuditEvent({
          actionType: "LOGIN_SUCCESS",
          description: `User ${user.name} logged in successfully`,
          actorId: user.id,
          actorName: user.name,
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
        token.department = (user as { department: string | null }).department;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.department = token.department as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
