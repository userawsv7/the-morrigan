// app/api/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client/edge';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const session = await prisma.investigationSession.findUnique({
        where: { id },
        include: { logs: true },
      });
      return NextResponse.json(session);
    }

    const sessions = await prisma.investigationSession.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(sessions);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, mode } = body;

    const session = await prisma.investigationSession.create({
      data: {
        title: title || 'New SRE Investigation',
        mode: mode || 'STANDARD',
      },
    });

    return NextResponse.json(session);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}