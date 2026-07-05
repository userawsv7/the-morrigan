// app/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UniversalPluginEngine, AdditiveRiskEngine, CompiledMorriganPayload } from '@/lib/morrigan-core';

interface MessageLog {
  role: 'user' | 'assistant';
  content: string;
}

export default function TerminalWorkspaceDashboard() {
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [sessionInput, setSessionInput] = useState<string>('');
  const [operatorPrompt, setOperatorPrompt] = useState<string>('');
  const [operatingMode, setOperatingMode] = useState<'NORMAL' | 'PRODUCTION' | 'EMERGENCY'>('NORMAL');
  
  const [stagedFiles, setStagedFiles] = useState<Array<{ name: string; rawContent: string }>>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [conversationHistory, setConversationHistory] = useState<MessageLog[]>([]);
  const [activeAnalysisReport, setActiveAnalysisReport] = useState<CompiledMorriganPayload | null>(null);
  const [voiceActive, setVoiceActive] = useState<boolean>(false);

  const bottomAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let storedId = localStorage.getItem('morrigan_active_token');
    if (!storedId) {
      storedId = `MRGN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      localStorage.setItem('morrigan_active_token', storedId);
    }
    setWorkspaceId(storedId);
    syncPlatformSessionHistory(storedId);
  }, []);

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, isProcessing]);

  const syncPlatformSessionHistory = async (id: string) => {
    try {
      const response = await fetch(`/api/session?id=${id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.incidents) {
          setConversationHistory(data.incidents.map((i: any) => ({ role: i.role, content: i.content })));
          if (data.incidents.length > 0) {
            const finalAssistantLog = [...data.incidents].reverse().find((i: any) => i.role === 'assistant');
            if (finalAssistantLog) setActiveAnalysisReport(JSON.parse(finalAssistantLog.content));
          } else {
            setActiveAnalysisReport(null);
          }
        }
      }
    } catch (err) {
      console.error('Failed syncing persistent storage context snapshots:', err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setStagedFiles(prev => [...prev, { name: file.name, rawContent: evt.target?.result as string || '' }]);
      };
      reader.readAsText(file);
    });
  };

  const runEngineeringAnalysisPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorPrompt.trim() && stagedFiles.length === 0) return;
    setIsProcessing(true);

    const userMessageString = operatorPrompt || 'Execute deep validation on attached file streams.';
    const updatedHistory: MessageLog[] = [...conversationHistory, { role: 'user', content: userMessageString }];
    setConversationHistory(updatedHistory);

    try {
      await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: workspaceId, mode: operatingMode, role: 'user', content: userMessageString })
      });

      const gatewayStreamResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessageString, history: conversationHistory, mode: operatingMode, evidence: stagedFiles })
      });

      if (!gatewayStreamResponse.ok) throw new Error('Analytical boundary loop processing failure.');
      
      const analysisData = await gatewayStreamResponse.json() as CompiledMorriganPayload;
      setActiveAnalysisReport(analysisData);
      
      const contentString = JSON.stringify(analysisData);
      setConversationHistory(prev => [...prev, { role: 'assistant', content: contentString }]);

      await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: workspaceId, mode: operatingMode, role: 'assistant', content: contentString })
      });

      setOperatorPrompt('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const loadTargetSessionToken = () => {
    if (!sessionInput.trim()) return;
    localStorage.setItem('morrigan_active_token', sessionInput);
    setWorkspaceId(sessionInput);
    syncPlatformSessionHistory(sessionInput);
  };

  const localizedManifests = stagedFiles.map(f => UniversalPluginEngine.runPipeline(f.name, f.rawContent));
  const activeLocalRisk = AdditiveRiskEngine.evaluate(operatingMode, localizedManifests);

  return (
    <div className="flex flex-col h-screen bg-black text-neutral-200 font-mono text-xs select-none">
      <header className="flex flex-wrap items-center justify-between border-b border-neutral-900 bg-neutral-950 p-4">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-purple-600 animate-pulse" />
          <span className="font-bold text-neutral-100 tracking-widest text-sm">THE MORRIGAN PLATFORM</span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-neutral-900 p-0.5 rounded border border-neutral-800">
            {(['NORMAL', 'PRODUCTION', 'EMERGENCY'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setOperatingMode(mode)}
                className={`px-3 py-1 font-bold transition-all ${
                  operatingMode === mode 
                    ? mode === 'EMERGENCY' ? 'bg-red-950 text-red-400 border border-red-800'
                    : mode === 'PRODUCTION' ? 'bg-amber-950 text-amber-400 border border-amber-800'
                    : 'bg-purple-950 text-purple-400 border border-purple-800'
                    : 'text-neutral-500 hover:text-neutral-400'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <input 
              type="text" 
              placeholder="Session ID" 
              value={sessionInput} 
              onChange={e => setSessionInput(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 px-2 py-1 rounded w-32 focus:outline-none focus:border-purple-600 text-[11px]" 
            />
            <button onClick={loadTargetSessionToken} className="bg-neutral-900 border border-neutral-800 px-2 py-1 rounded text-neutral-400 hover:text-white">Load</button>
          </div>

          <div className="bg-neutral-900 px-3 py-1 rounded border border-neutral-800 text-neutral-400">
            Workspace Token: <span className="text-purple-400 font-bold select-all">{workspaceId}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {stagedFiles.length > 0 && (
          <div className="space-y-3">
            <div className="text-neutral-400 font-bold tracking-wider uppercase text-[10px]">1. Instant Client Deterministic Analysis Grid</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {localizedManifests.map((manifest, index) => (
                <div key={index} className="bg-neutral-950 border border-neutral-900 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between items-center border-b border-neutral-900 pb-2">
                    <span className="font-bold text-purple-400">📄 {manifest.filename}</span>
                    <span className="text-neutral-500 text-[10px]">{manifest.domain.toUpperCase()}</span>
                  </div>
                  <p className="text-neutral-400 italic text-[11px]">{manifest.abstract}</p>
                  <div className="space-y-1">
                    {manifest.findings.length === 0 ? (
                      <div className="text-emerald-500 text-[11px]">✓ Clean verification tracking. Config matches design guidelines.</div>
                    ) : (
                      manifest.findings.map((finding, fIdx) => (
                        <div key={fIdx} className="flex justify-between items-start bg-black p-2 border border-neutral-900 rounded">
                          <span className="text-neutral-300"><span className="text-amber-500 font-bold">[{finding.category}]</span> {finding.title}</span>
                          <span className="text-[10px] font-mono px-1 rounded bg-neutral-900">{finding.severity}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-neutral-950 border border-neutral-900 rounded-lg flex flex-wrap justify-between items-center gap-4">
              <div>
                <span className="text-neutral-500 block uppercase text-[10px]">Aggregated Environmental Risk Score</span>
                <span className="font-bold text-sm tracking-wider">{activeLocalRisk.overallScore}</span>
              </div>
              <div className="flex gap-4 text-[11px]">
                <div>Security Risk: <span className="font-bold">{activeLocalRisk.dimensions.security}</span></div>
                <div>Availability Profile: <span className="font-bold">{activeLocalRisk.dimensions.availability}</span></div>
                <div>Operational Impact: <span className="font-bold">{activeLocalRisk.dimensions.operational}</span></div>
              </div>
            </div>
          </div>
        )}

        {activeAnalysisReport && (
          <div className="space-y-6">
            <div className="text-neutral-400 font-bold tracking-wider uppercase text-[10px]">2. Compiled AI Architecture & Remediation Directives</div>
            <div className="bg-neutral-950 border border-neutral-900 rounded-lg p-5 space-y-5">
              <div>
                <h2 className="text-purple-400 font-bold text-sm uppercase tracking-widest border-b border-neutral-900 pb-2">Investigation Diagnostics Synopsis</h2>
                <p className="mt-3 text-neutral-300 leading-relaxed text-xs whitespace-pre-wrap">{activeAnalysisReport.summary}</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                <div className="bg-black border border-neutral-900 p-4 rounded-lg space-y-3">
                  <h3 className="text-amber-500 font-bold text-xs uppercase tracking-wider">Mitigation Script Execution block</h3>
                  <pre className="bg-neutral-950 border border-neutral-900 p-3 rounded text-amber-400 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {activeAnalysisReport.remediation.recommendedAction}
                  </pre>
                </div>

                <div className="bg-black border border-neutral-900 p-4 rounded-lg space-y-3">
                  <h3 className="text-emerald-500 font-bold text-xs uppercase tracking-wider">Operational Verification Track</h3>
                  <ul className="space-y-2">
                    {activeAnalysisReport.remediation.verificationChecklist.map((item, idx) => (
                      <li key={idx} className="flex items-center space-x-2 text-neutral-300 text-[11px]">
                        <span className="text-emerald-500 font-bold">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-3 border-t border-neutral-900">
                    <span className="text-neutral-400 font-bold block text-[10px] uppercase text-purple-400 mb-1">Long Term System Prevention Layout</span>
                    <p className="text-neutral-400 text-[11px] leading-relaxed">{activeAnalysisReport.remediation.preventionStrategy}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomAnchorRef} />
      </main>

      <footer className="border-t border-neutral-900 bg-neutral-950 p-4">
        <form onSubmit={runEngineeringAnalysisPipeline} className="max-w-7xl mx-auto flex flex-col space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <label className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 px-3 py-1.5 rounded cursor-pointer font-bold tracking-wide transition-all text-[11px]">
                ➕ ATTACH INCIDENT LOGS / INFRASTRUCTURE MANIFESTS
                <input type="file" multiple className="hidden" onChange={handleFileUpload} />
              </label>

              <button
                type="button"
                onClick={() => setVoiceActive(!voiceActive)}
                className={`px-3 py-1.5 border rounded font-bold tracking-wide transition-all text-[11px] ${
                  voiceActive ? 'bg-red-950 border-red-800 text-red-400' : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                🎤 VOICE STREAMER: {voiceActive ? 'ON' : 'OFF'}
              </button>
            </div>

            {stagedFiles.length > 0 && (
              <button type="button" onClick={() => setStagedFiles([])} className="text-neutral-600 hover:text-red-400 text-[11px]">Clear Memory</button>
            )}
          </div>

          <textarea
            value={operatorPrompt}
            onChange={(e) => setOperatorPrompt(e.target.value)}
            placeholder="Paste logs, IaC parameters, or describe operational errors here..."
            rows={3}
            className="w-full bg-black border border-neutral-900 rounded-lg p-4 font-mono text-xs focus:outline-none focus:border-purple-600 text-neutral-100 placeholder-neutral-700 resize-none transition-all"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                runEngineeringAnalysisPipeline(e);
              }
            }}
          />

          <div className="flex justify-between items-center text-neutral-600 text-[11px]">
            <div>Telemetry strings are optimized dynamically to protect token limits.</div>
            <button
              type="submit"
              disabled={isProcessing}
              className={`px-6 py-2 rounded font-bold uppercase border tracking-wider transition-all ${
                isProcessing 
                  ? 'bg-neutral-950 border-neutral-900 text-neutral-600 cursor-not-allowed'
                  : 'bg-purple-950 hover:bg-purple-900 text-purple-300 border-purple-800'
              }`}
            >
              {isProcessing ? 'PARSING ENGINES...' : 'DISPATCH PROTOCOL'}
            </button>
          </div>
        </form>
      </footer>
    </div>
  );
}