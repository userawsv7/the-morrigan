// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { UniversalPluginEngine, AdditiveRiskEngine } from '@/lib/morrigan-core';

import type { 
  EngineFindingManifest, 
  CompiledMorriganPayload,
  OperatingMode 
} from '@/lib/morrigan-core';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, files, mode } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message payload is required' }, { status: 400 });
    }

    // Fix: Map array elements to runPipeline method signature
    const calculatedManifests: EngineFindingManifest[] = (files && Array.isArray(files))
      ? files.map((f: { name?: string; filename?: string; content: string }) => 
          UniversalPluginEngine.runPipeline(f.name || f.filename || 'unnamed_stream.txt', f.content)
        )
      : [];
    
    // Fix: Explicitly normalize and cast OperatingMode strings
    let parsedMode: OperatingMode = 'NORMAL';
    if (mode === 'PRODUCTION') parsedMode = 'PRODUCTION';
    if (mode === 'EMERGENCY') parsedMode = 'EMERGENCY';

    const globalRiskProfile = AdditiveRiskEngine.evaluate(parsedMode, calculatedManifests);

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
            content: `You are The Morrigan Engineering Intelligence Core. Active Manifest Context: ${JSON.stringify(compactEvidenceContext)}. Calculated Additive Risk Level: ${globalRiskProfile.overallScore}.`,
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

    // Fix: Map properties exactly to compliance specifications of CompiledMorriganPayload interface
    return NextResponse.json({
      context: {
        mode: parsedMode,
        detectedDomains: calculatedManifests.map(m => m.domain),
        urgencyScore: calculatedManifests.reduce((acc, curr) => acc + curr.findings.length, 0) * 15,
        investigationDepth: calculatedManifests.reduce((acc, curr) => acc + curr.findings.length, 0) > 2 ? 'DEEP' : 'SURFACE'
      },
      summary: aiContent,
      remediation: {
        recommendedAction: globalRiskProfile.overallScore !== '🟢 Safe' 
          ? "Isolate affected configurations and run cluster verification playbooks immediately." 
          : "Maintain regular observation metrics across baseline paths.",
        verificationChecklist: [
          "Validate container compute isolation configurations",
          "Audit open internet ingress security group ranges",
          "Ensure static structural integrity scanning hooks are operational"
        ],
        monitoringDurationMinutes: globalRiskProfile.overallScore === '🔴 Critical' ? 60 : 15,
        preventionStrategy: "Enforce static infrastructure testing workflows inside primary pull pipelines."
      }
    } as CompiledMorriganPayload);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}