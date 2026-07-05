// app/api/session/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing session identification key' }, { status: 400 });

  try {
    const session = await prisma.investigationSession.findUnique({
      where: { id },
      include: { incidents: { orderBy: { timestamp: 'asc' } } }
    });
    return NextResponse.json(session || { id, mode: 'NORMAL', incidents: [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id, mode, role, content } = await req.json();
    const updatedSession = await prisma.investigationSession.upsert({
      where: { id },
      update: { mode },
      create: { id, mode }
    });

    const newLog = await prisma.incidentLog.create({
      data: { sessionId: updatedSession.id, role, content }
    });

    return NextResponse.json({ success: true, log: newLog });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}