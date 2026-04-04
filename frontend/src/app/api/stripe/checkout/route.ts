import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripe, PLANS } from "@/lib/stripe";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan } = await req.json();

  if (plan !== "pro" && plan !== "premium") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const planConfig = PLANS[plan as keyof typeof PLANS];
  if (!planConfig.priceId) {
    return NextResponse.json(
      { error: "Stripe not configured. Set STRIPE_PRO_PRICE_ID and STRIPE_PREMIUM_PRICE_ID." },
      { status: 500 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  const checkoutSession = await getStripe().checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: user?.stripeId ? undefined : session.user.email,
    customer: user?.stripeId || undefined,
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    metadata: { userId: user?.id || "", plan },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
