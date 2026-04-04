import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      alerts: { include: { stock: true }, orderBy: { createdAt: "desc" } },
    },
  });

  return NextResponse.json(user?.alerts ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticker, metric, condition, threshold } = await req.json();

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { alerts: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Tier check
  if (user.tier === "free") {
    return NextResponse.json(
      { error: "Alerts require Pro or Premium plan" },
      { status: 403 }
    );
  }

  const alertLimits: Record<string, number> = { pro: 5, premium: 9999 };
  const limit = alertLimits[user.tier] || 0;

  if (user.alerts.length >= limit) {
    return NextResponse.json(
      { error: `Alert limit reached for ${user.tier} plan` },
      { status: 403 }
    );
  }

  // Ensure stock exists in watchlist
  let stock = await prisma.stock.findFirst({
    where: { userId: user.id, ticker: ticker.toUpperCase() },
  });

  if (!stock) {
    stock = await prisma.stock.create({
      data: { ticker: ticker.toUpperCase(), userId: user.id },
    });
  }

  const alert = await prisma.alert.create({
    data: {
      userId: user.id,
      stockId: stock.id,
      metric,
      condition,
      threshold: parseFloat(threshold),
    },
  });

  return NextResponse.json(alert);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { alertId } = await req.json();

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.alert.deleteMany({
    where: { id: alertId, userId: user.id },
  });

  return NextResponse.json({ success: true });
}
