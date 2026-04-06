import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/portfolio — list all portfolios for current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      portfolios: {
        include: { items: { orderBy: { addedAt: "desc" } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json(user.portfolios);
}

// POST /api/portfolio — create portfolio or add/remove item
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json();
  const { action, portfolioId, name, ticker, note } = body;

  if (action === "create") {
    // Create a new portfolio
    const count = await prisma.portfolio.count({ where: { userId: user.id } });
    const maxPortfolios = user.tier === "premium" ? 10 : user.tier === "pro" ? 3 : 1;
    if (count >= maxPortfolios) {
      return NextResponse.json(
        { error: `Your plan allows up to ${maxPortfolios} portfolio(s)` },
        { status: 403 }
      );
    }
    const portfolio = await prisma.portfolio.create({
      data: { userId: user.id, name: name || "我的投资组合" },
      include: { items: true },
    });
    return NextResponse.json(portfolio);
  }

  if (action === "rename" && portfolioId && name) {
    const portfolio = await prisma.portfolio.findFirst({
      where: { id: portfolioId, userId: user.id },
    });
    if (!portfolio) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const updated = await prisma.portfolio.update({
      where: { id: portfolioId },
      data: { name },
      include: { items: true },
    });
    return NextResponse.json(updated);
  }

  if (action === "addTicker" && portfolioId && ticker) {
    const portfolio = await prisma.portfolio.findFirst({
      where: { id: portfolioId, userId: user.id },
      include: { items: true },
    });
    if (!portfolio) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const maxItems = user.tier === "premium" ? 50 : user.tier === "pro" ? 20 : 10;
    if (portfolio.items.length >= maxItems) {
      return NextResponse.json(
        { error: `Your plan allows up to ${maxItems} stocks per portfolio` },
        { status: 403 }
      );
    }

    const item = await prisma.portfolioItem.upsert({
      where: { portfolioId_ticker: { portfolioId, ticker: ticker.toUpperCase() } },
      create: { portfolioId, ticker: ticker.toUpperCase(), note },
      update: { note },
    });
    return NextResponse.json(item);
  }

  if (action === "removeTicker" && portfolioId && ticker) {
    const portfolio = await prisma.portfolio.findFirst({
      where: { id: portfolioId, userId: user.id },
    });
    if (!portfolio) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.portfolioItem.deleteMany({
      where: { portfolioId, ticker: ticker.toUpperCase() },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// DELETE /api/portfolio?id= — delete a portfolio
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Portfolio id required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.portfolio.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
