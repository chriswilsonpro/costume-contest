import { useEffect } from 'react';
import { getDataStore } from '../lib/dataStore';

const DEFAULT_TITLE = 'Costume Contest';
const DEFAULT_DESCRIPTION =
  'Vote for the best costumes across multiple categories.';

function setMetaDescription(content: string) {
  let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = 'description';
    document.head.appendChild(tag);
  }
  tag.content = content;
}

/** Keeps the document title and meta description in sync with the active contest. */
export function ContestHead() {
  useEffect(() => {
    const unsubscribe = getDataStore().subscribeActiveContest((bundle) => {
      document.title = bundle?.contest.name.trim() || DEFAULT_TITLE;
      setMetaDescription(bundle?.contest.description.trim() || DEFAULT_DESCRIPTION);
    });
    return unsubscribe;
  }, []);

  return null;
}
