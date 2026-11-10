import { useMemo } from 'react';
import { countCharacters, countSentences, countWords } from '../engine/textUtils';

export function TextStatistics({ text }: { text: string }) {
  const stats = useMemo(
    () => ({ characters: countCharacters(text), words: countWords(text), sentences: countSentences(text) }),
    [text],
  );
  const item = (value: number, singular: string, plural: string) => (
    <span>
      <span className="font-semibold tabular-nums text-ink">{value.toLocaleString()}</span> {value === 1 ? singular : plural}
    </span>
  );
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted" aria-label="Text statistics">
      {item(stats.characters, 'character', 'characters')}
      {item(stats.words, 'word', 'words')}
      {item(stats.sentences, 'sentence', 'sentences')}
    </p>
  );
}
