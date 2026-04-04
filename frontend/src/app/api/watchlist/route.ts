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
    include: { watchlist: true },
  });

  return NextResponse.json(user?.watchlist ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticker } = await req.json();
  if (!ticker) {
    return NextResponse.json({ error: "Ticker required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { watchlist: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Tier limits
  const limits: Record<string, number> = { free: 3, pro: 20, premium: 9999 };
  const limit = limits[user.tier] || 3;

  if (user.watchlist.length >= limit) {
    return NextResponse.json(
      { error: `${user.tier} plan limited to ${limit} stocks. Upgrade for more.` },
      { status: 403 }
    );
  }

  const stock = await prisma.stock.upsert({
    where: { userId_ticker: { userId: user.id, ticker: ticker.toUpperCase() } },
    update: {},
    create: { ticker: ticker.toUpperCase(), userId: user.id },
  });

  return NextResponse.json(stock);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticker } = await req.json();
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.stock.deleteMany({
    where: { userId: user.id, ticker: ticker.toUpperCase() },
  });

  return NextResponse.json({ success: true });
}
