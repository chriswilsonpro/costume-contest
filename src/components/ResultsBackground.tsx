import { ResultsNightScene } from './ResultsNightScene';
import { useImageUrl } from '../lib/media';
import type { ResultsBackground as BackgroundKind } from '../lib/types';

type Props = {
  kind: BackgroundKind;
  imageKey?: string | null;
};

export function ResultsBackground({ kind, imageKey }: Props) {
  const customUrl = useImageUrl(kind === 'custom' ? imageKey : null);

  if (kind === 'custom' && customUrl) {
    return (
      <div className="results-custom-bg" aria-hidden="true">
        <img src={customUrl} alt="" className="results-custom-bg-image" />
        <div className="results-custom-bg-overlay" />
      </div>
    );
  }

  return <ResultsNightScene />;
}
