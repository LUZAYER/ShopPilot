import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { protectRoute, Schemas, audit } from "@/lib/security";
import bcrypt from "bcryptjs";
import { emit } from "@/lib/automation";
import { safeAsync } from "@/lib/reliability";

export async function POST(req: NextRequest) {
  const g = await protectRoute(
    req,
    "reseller.invite",
    Schemas.resellerInvite,
    { rlMax: 20 }
  );
  if (!g.ok) return g.res;
  const { businessId, userId, cleaned } = g;

  const existing = await prisma.user.findUnique({
    where: { email: cleaned.email }
  });
  if (existing) {
    return NextResponse.json(
      { error: "user_already_exists", email: cleaned.email },
      { status: 409 }
    );
  }

  // Generate a temporary, copy-pasteable password (the reseller changes it
  // on first login — onboarding flow lives at /resellers).
  const tempPassword =
    "SP" + Math.random().toString(36).slice(2, 8).toUpperCase() + "!1";
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const user = await prisma.user.create({
    data: {
      email: cleaned.email,
      name: cleaned.name,
      phone: cleaned.phone ?? null,
      passwordHash,
      role: "RESELLER",
      staffOfId: businessId
    }
  });

  // Referral code must be unique — retry a few times on the (rare) collision
  let referralCode = "";
  for (let i = 0; i < 5; i++) {
    const candidate =
      "REF" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const clash = await prisma.reseller.findUnique({
      where: { referralCode: candidate }
    });
    if (!clash) {
      referralCode = candidate;
      break;
    }
  }
  if (!referralCode) {
    return NextResponse.json(
      { error: "referral_collision", message: "Please try again" },
      { status: 500 }
    );
  }

  const commissionValue =
    cleaned.commissionValue ?? cleaned.commissionRate ?? 10;

  const reseller = await prisma.reseller.create({
    data: {
      businessId,
      userId: user.id,
      name: cleaned.name,
      phone: cleaned.phone ?? "",
      email: cleaned.email,
      city: cleaned.city ?? null,
      tier: cleaned.tier ?? "bronze",
      referralCode,
      commissionType: cleaned.commissionType ?? "percentage",
      commissionValue,
      commissionRate: commissionValue
    }
  });

  await audit({
    businessId,
    userId,
    action: "reseller.invite",
    meta: {
      resellerId: reseller.id,
      email: cleaned.email,
      tier: reseller.tier
    }
  });

  // Fire automation event (Phase 8)
  safeAsync(
    () =>
      emit({
        type: "reseller.invited",
        businessId,
        resellerId: reseller.id,
        name: reseller.name,
        email: reseller.email ?? cleaned.email
      }),
    "emit:reseller.invited"
  );

  return NextResponse.json({
    reseller,
    tempPassword,
    loginHint: "Share the temp password once. Reseller should change it on first login."
  });
}
