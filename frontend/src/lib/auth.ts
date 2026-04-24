import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./db";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    // Google OAuth — one-click Gmail login
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),

    // Email/Password credentials
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Name", type: "text" },
        action: { label: "Action", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const isSignUp = credentials.action === "signup";

        if (isSignUp) {
          const existing = await prisma.user.findUnique({
            where: { email: credentials.email },
          });
          if (existing) throw new Error("Email already registered");

          const hashed = await bcrypt.hash(credentials.password, 10);
          const user = await prisma.user.create({
            data: {
              email: credentials.email,
              password: hashed,
              name: credentials.name || undefined,
            },
          });
          return { id: user.id, email: user.email, name: user.name, tier: user.tier };
        }

        // Login
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user || !user.password) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, tier: user.tier };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    // Auto-create DB user on first Google sign-in
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
        });
        if (!existing) {
          await prisma.user.create({
            data: {
              email: user.email,
              name: user.name ?? undefined,
            },
          });
        }
      }
      return true;
    },

    // Store id + tier in JWT (refreshed from DB on update trigger)
    async jwt({ token, user, trigger }) {
      if (user) {
        // Look up DB record to get our internal id and tier
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.tier = dbUser.tier;
        } else {
          token.id = user.id;
          token.tier = "free";
        }
      }

      // Refresh tier after Stripe payment (call update() on client to trigger this)
      if (trigger === "update" && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.tier = dbUser.tier;
        }
      }

      return token;
    },

    // Expose id + tier on session.user
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string; tier?: string }).id = token.id as string;
        (session.user as { id?: string; tier?: string }).tier = (token.tier as string) ?? "free";
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
};
