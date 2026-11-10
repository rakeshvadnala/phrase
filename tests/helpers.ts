import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyChanges } from '../src/engine/changes';
import { createGrammarChecker, type GrammarChecker } from '../src/engine/grammarEngine';
import { analyzeText } from '../src/engine/toneEngine';
import type { GrammarIssue, PhraseRule, ToneId } from '../src/types';

/** Runs the rule engines (no grammar checker) and applies the default selection. */
export function improve(text: string, tone: ToneId, customRules: PhraseRule[] = [], issues: GrammarIssue[] = []): string {
  const changes = analyzeText({ text, tone, customRules, issues });
  return applyChanges(text, changes).text;
}

let checker: Promise<GrammarChecker> | undefined;

/**
 * Real Harper instance for integration tests. The WebAssembly binary is
 * handed over as a data: URL because harper.js cannot resolve file:// URLs
 * on Windows under Node.
 */
export function getTestChecker(): Promise<GrammarChecker> {
  checker ??= (async () => {
    const { createBinaryModuleFromUrl } = await import('harper.js');
    const wasm = readFileSync(join(process.cwd(), 'node_modules', 'harper.js', 'dist', 'harper_wasm_slim_bg.wasm'));
    const binary = createBinaryModuleFromUrl(`data:application/wasm;base64,${wasm.toString('base64')}`, 'slim');
    return createGrammarChecker({ binary, useWorker: false });
  })();
  return checker;
}
