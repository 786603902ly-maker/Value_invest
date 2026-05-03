import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { stripeId: true, tier: true },
  });

  if (!user?.stripeId) {
    return NextResponse.json(
      { error: "No active subscription found" },
      { status: 400 }
    );
  }

  const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || "";
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || origin).replace(/\/$/, "");

  const portalSession = await getStripe().billingPortal.sessions.create({
    customer: user.stripeId,
    return_url: `${baseUrl}/account`,
  });

  return NextResponse.json({ url: portalSession.url });
}
