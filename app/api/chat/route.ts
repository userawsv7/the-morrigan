// app/api/chat/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { UniversalPluginEngine, AdditiveRiskEngine, EngineFindingManifest, CompiledMorriganPayload } from '@/lib/morrigan-core';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { message, history, mode = 'NORMAL', evidence = [] } = await req.json();

    const calculatedManifests: EngineFindingManifest[] = evidence.map((file: { name: string; rawContent: string }) => 
      UniversalPluginEngine.runPipeline(file.name, file.rawContent)
    );

    const globalRiskProfile = AdditiveRiskEngine.evaluate(mode, calculatedManifests);

    const compactEvidenceContext = calculatedManifests.map((m: EngineFindingManifest) => ({
      file: m.filename,
      domain: m.domain,
      metaAbstract: m.abstract,
      violationsFound: m.findings.map(f => `[${f.category}] ${f.title}`)
    }));

    const systemInstructionMatrix = `You are the central core processing node of The Morrigan Engineering Platform.
You assist developers, SREs, and AI engineers across 30 technology dimensions with troubleshooting, script reviews, configurations, query updates, and catastrophic error mitigation.

Active System Metadata Matrix:
Deployment Operational Track Mode: ${mode}
Pre-Evaluated Configuration Context: ${JSON.stringify(compactEvidenceContext)}
Calculated Platform Threat Profile: ${JSON.stringify(globalRiskProfile)}

Strict Output Instruction:
Analyze the user message or codebase issue. Return a clean, standalone JSON structure matching the following layout interface template. Do not include markdown wraps or trailing commentary blocks:
{
  "context": {
    "mode": "${mode}",
    "detectedDomains": ["kubernetes"],
    "urgencyScore": 0.9,
    "investigationDepth": "FORENSIC"
  },
  "summary": "Step-by-step structural explanation or architectural root-cause layout explaining why the failure happened or what adjustments are required.",
  "remediation": {
    "recommendedAction": "Production-ready automated scripts, clean terraform resources, optimized queries, fixed actions yaml code blocks, or debug commands.",
    "verificationChecklist": ["Step 1 to check if fix is up", "Step 2 metric query check"],
    "monitoringDurationMinutes": 15,
    "preventionStrategy": "Long term architecture remediation, monitoring configuration improvements, and architectural health-check targets to prevent recurrence."
  }
}`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        messages: [
          { role: 'system', content: systemInstructionMatrix },
          ...history.slice(-6),
          { role: 'user', content: message }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }),
    });

    if (!groqResponse.ok) return NextResponse.json({ error: 'Upstream AI engine timeout allocation failure' }, { status: 500 });

    const payloadText = await groqResponse.json();
    return NextResponse.json(JSON.parse(payloadText.choices[0].message.content) as CompiledMorriganPayload);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}