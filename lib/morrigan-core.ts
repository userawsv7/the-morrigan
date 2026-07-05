// lib/morrigan-core.ts

export type SeverityTier = '🟢 Safe' | '🟡 Moderate' | '🟠 High' | '🔴 Critical';
export type EngineeringDomain = 'kubernetes' | 'terraform' | 'ci_cd' | 'database' | 'mlops' | 'networking' | 'os_core';
export type OperatingMode = 'NORMAL' | 'PRODUCTION' | 'EMERGENCY';
export type FindingCategory = 'SECURITY' | 'AVAILABILITY' | 'OPERATIONAL' | 'COMPLIANCE' | 'COST';

export interface PlanContext {
  mode: OperatingMode;
  detectedDomains: EngineeringDomain[];
  urgencyScore: number;
  investigationDepth: 'SURFACE' | 'DEEP' | 'FORENSIC';
}

export interface NormalizedFinding {
  id: string;
  category: FindingCategory;
  severity: SeverityTier;
  title: string;
  description: string;
  remediationSnippet?: string;
}

export interface EngineFindingManifest {
  filename: string;
  domain: EngineeringDomain;
  findings: NormalizedFinding[];
  abstract: string;
}

export interface CalculatedRiskProfile {
  overallScore: SeverityTier;
  maintenanceWindowRequired: boolean;
  downtimeExpected: boolean;
  dimensions: Record<Lowercase<FindingCategory>, SeverityTier>;
}

export interface CompiledMorriganPayload {
  context: PlanContext;
  summary: string;
  remediation: {
    recommendedAction: string;
    verificationChecklist: string[];
    monitoringDurationMinutes: number;
    preventionStrategy: string;
  };
}

export class UniversalPluginEngine {
  public static runPipeline(filename: string, content: string): EngineFindingManifest {
    const lowerContent = content.toLowerCase();
    const lowerName = filename.toLowerCase();

    let domain: EngineeringDomain = 'os_core';
    let abstract = `Unstructured engineering stream payload parsed (${content.length} characters).`;
    const findings: NormalizedFinding[] = [];

    if (content.includes('apiVersion:') && content.includes('kind:')) {
      domain = 'kubernetes';
      const kind = content.split('\n').find(l => l.startsWith('kind:'))?.replace('kind:', '').trim() || 'Resource';
      abstract = `Kubernetes Infrastructure Target [Kind: ${kind}]`;

      if (!content.includes('limits:')) {
        findings.push({
          id: 'M-K8S-001',
          category: 'AVAILABILITY',
          severity: '🟡 Moderate',
          title: 'Missing Container Compute Hard Limits',
          description: 'No memory or CPU limits defined. Risk of worker node exhaustion crashes.',
          remediationSnippet: 'resources:\n  limits:\n    cpu: "500m"\n    memory: "512Mi"'
        });
      }
      if (content.includes('privileged: true')) {
        findings.push({
          id: 'M-K8S-002',
          category: 'SECURITY',
          severity: '🔴 Critical',
          title: 'Privileged Sandbox Escalation Vector',
          description: 'Container is configured to bypass daemon hypervisor boundaries with root rights.',
          remediationSnippet: 'securityContext:\n  privileged: false'
        });
      }
    }

    else if (lowerName.endsWith('.tf') || content.includes('resource "') || content.includes('provider "')) {
      domain = 'terraform';
      abstract = 'Terraform Infrastructure-as-Code Graph Module';

      if (content.includes('0.0.0.0/0') && (content.includes('ingress') || content.includes('security_group'))) {
        findings.push({
          id: 'M-TF-001',
          category: 'SECURITY',
          severity: '🔴 Critical',
          title: 'Unbounded Global Firewall Opening',
          description: 'Network access policy opens port tracks to all public internet networks.',
          remediationSnippet: 'cidr_blocks = ["10.0.0.0/16"]'
        });
      }
    }

    else if (lowerName.includes('dockerfile') || (content.includes('FROM ') && content.includes('RUN '))) {
      domain = 'os_core';
      abstract = 'Docker Container Image Layout Specification';

      if (!content.includes('USER ')) {
        findings.push({
          id: 'M-DKR-001',
          category: 'SECURITY',
          severity: '🔴 Critical',
          title: 'Implicit Root User Context Risk',
          description: 'Container runs binary steps as system root. Breaks compromise host node environments.',
          remediationSnippet: 'RUN useradd -u 10001 appuser\nUSER appuser'
        });
      }
    }

    if (lowerContent.includes('cuda') || lowerContent.includes('embedding') || lowerContent.includes('vllm') || lowerContent.includes('huggingface') || lowerContent.includes('gpu')) {
      domain = 'mlops';
      abstract = 'AI Runtime Metrics Layer / GPU Processing Cluster Trace Context';
      
      if (lowerContent.includes('out of memory') || lowerContent.includes('oom')) {
        findings.push({
          id: 'M-AI-001',
          category: 'AVAILABILITY',
          severity: '🔴 Critical',
          title: 'GPU VRAM Memory Pool Allocation Collapse',
          description: 'Inference limits or allocation parameters overallocated computing memory profiles.',
          remediationSnippet: 'gpu_memory_utilization = 0.85\nmax_model_len = 4096'
        });
      }
    }

    return { filename, domain, findings, abstract };
  }
}

export class AdditiveRiskEngine {
  public static evaluate(mode: OperatingMode, manifests: EngineFindingManifest[]): CalculatedRiskProfile {
    const weights: Record<SeverityTier, number> = { '🟢 Safe': 0, '🟡 Moderate': 10, '🟠 High': 25, '🔴 Critical': 50 };
    const multipliers: Record<OperatingMode, number> = { 'NORMAL': 1.0, 'PRODUCTION': 1.6, 'EMERGENCY': 2.2 };
    
    const scores: Record<FindingCategory, number> = { SECURITY: 0, AVAILABILITY: 0, OPERATIONAL: 0, COMPLIANCE: 0, COST: 0 };
    let totalScore = 0;
    let criticals = 0;

    manifests.forEach(m => {
      m.findings.forEach(f => {
        const value = weights[f.severity] * multipliers[mode];
        scores[f.category] += value;
        totalScore += value;
        if (f.severity === '🔴 Critical') criticals++;
      });
    });

    const getTier = (pts: number) => pts >= 60 ? '🔴 Critical' : pts >= 30 ? '🟠 High' : pts >= 10 ? '🟡 Moderate' : '🟢 Safe';

    return {
      overallScore: getTier(totalScore),
      maintenanceWindowRequired: mode === 'PRODUCTION' || criticals > 0,
      downtimeExpected: criticals > 0 && mode !== 'EMERGENCY',
      dimensions: {
        security: getTier(scores.SECURITY),
        availability: getTier(scores.AVAILABILITY),
        operational: getTier(scores.OPERATIONAL),
        compliance: getTier(scores.COMPLIANCE),
        cost: getTier(scores.COST)
      }
    };
  }
}