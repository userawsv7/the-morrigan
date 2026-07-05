// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { UniversalPluginEngine, AdditiveRiskEngine, EngineFindingManifest, CompiledMorriganPayload } from '@/lib/morrigan-core';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId, files, mode = 'STANDARD' } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message payload is required' }, { status: 400 });
    }

    const calculatedManifests: EngineFindingManifest[] = files 
      ? UniversalPluginEngine.parse(files) 
      : [];
    
    const globalRiskProfile = AdditiveRiskEngine.evaluate(mode, calculatedManifests);

    const compactEvidenceContext = calculatedManifests.map((m: EngineFindingManifest) => ({
      file: m.filename,
      domain: m.domain,
      metaAbstract: m.abstract,
    }));

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages: [
          {
            role: 'system',
            content: `You are The Morrigan Engineering Intelligence Core. Active Manifest Context: ${JSON.stringify(compactEvidenceContext)}. Calculated Additive Risk Level: ${globalRiskProfile.severity}.`,
          },
          { role: 'user', content: message },
        ],
        temperature: 0.2,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      throw new Error(`Groq Upstream Exception: ${errorText}`);
    }

    const groqData = await groqResponse.json();
    const aiContent = groqData.choices[0]?.message?.content || 'No processing response returned.';

    return NextResponse.json({
      analysis: aiContent,
      riskAssessment: globalRiskProfile,
      manifests: calculatedManifests,
    } as CompiledMorriganPayload);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}