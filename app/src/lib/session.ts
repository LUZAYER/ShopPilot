import { getServerSession } from "next-auth";
import { authOptions, type SessionUser } from "./auth";
import { prisma } from "./db";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as SessionUser;
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("UNAUTHENTICATED");
  return u;
}

export async function getCurrentBusiness() {
  const user = await getCurrentUser();
  if (!user) return null;
  // Resolve business: for OWNER, ownerId = userId; for STAFF, staffOfId = userId
  const business = await prisma.business.findFirst({
    where: { OR: [{ ownerId: user.id }, { staff: { some: { id: user.id } } }] }
  });
  return business;
}

export async function requireBusiness() {
  const b = await getCurrentBusiness();
  if (!b) throw new Error("NO_BUSINESS");
  // Pages often destructure { businessId }; expose it as an alias.
  return { ...b, businessId: b.id };
}
