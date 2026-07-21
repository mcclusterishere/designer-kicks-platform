import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import type { Provider } from "next-auth/providers";
import { prisma } from "@/lib/db";

export const oauthProviders = {
  google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  facebook: Boolean(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET),
};

const providers: Provider[] = [
  Credentials({
    name: "Email & password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = String(credentials?.email ?? "").trim().toLowerCase();
      const password = String(credentials?.password ?? "");
      if (!email || !password) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.passwordHash) return null;
      if (!(await compare(password, user.passwordHash))) return null;

      return { id: user.id, email: user.email, name: user.name, image: user.image };
    },
  }),
];

// Credentials passed EXPLICITLY: Auth.js v5's zero-config providers read
// AUTH_GOOGLE_ID / AUTH_FACEBOOK_ID — different names from the vars our
// availability gate checks. Without this, the button renders and the
// OAuth flow 500s. One set of env names, end to end.
if (oauthProviders.google) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  );
}
if (oauthProviders.facebook) {
  providers.push(
    Facebook({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/signin" },
  providers,
  events: {
    // Stamp where the account came from — the first-touch campaign cookie
    // set when the visitor landed via a tagged link (?ref= / utm_source).
    // OAuth signups (Facebook/Google) get attribution here; password
    // signups get it in registerUser. Stamped once, never updated.
    async createUser({ user }) {
      try {
        const { cookies } = await import("next/headers");
        const src = (await cookies()).get("hc_src")?.value?.slice(0, 60);
        if (user.id && src) {
          await prisma.user.update({ where: { id: user.id }, data: { signupSource: src } });
        }
      } catch {
        /* attribution is best-effort — never block account creation */
      }
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.userId && session.user) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
