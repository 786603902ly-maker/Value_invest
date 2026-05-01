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

  if (plan !== "pro") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const planConfig = PLANS[plan as keyof typeof PLANS];
  if (!planConfig.priceId) {
    return NextResponse.json(
      { error: "Stripe not configured. Set STRIPE_PRO_PRICE_ID in your environment variables." },
      { status: 500 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  // Determine the base URL — prefer env var, fall back to request origin
  const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || "";
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || origin).replace(/\/$/, "");

  const checkoutSession = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer_email: user?.stripeId ? undefined : session.user.email,
    customer: user?.stripeId || undefined,
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    billing_address_collection: "auto",
    success_url: `${baseUrl}/dashboard?upgraded=true`,
    cancel_url: `${baseUrl}/pricing`,
    metadata: { userId: user?.id || "", plan },
    allow_promotion_codes: true,
    custom_text: {
      submit: {
        message: "订阅后即可解锁全部 Pro 功能。您可随时取消。",
      },
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
