// SPDX-License-Identifier: AGPL-3.0-only

import {
  FLIXO_ATTRIBUTION_TEXT,
  FLIXO_REPOSITORY_URL,
  FLIXO_SOURCE_TEXT,
} from './flixo-attribution';

export function FlixoAttributionFooter() {
  return (
    <footer className="flixo-attribution" data-testid="flixo-attribution">
      <a href={FLIXO_REPOSITORY_URL} aria-label={FLIXO_ATTRIBUTION_TEXT}>
        {FLIXO_ATTRIBUTION_TEXT}
      </a>
      <a href={FLIXO_REPOSITORY_URL} aria-label={FLIXO_SOURCE_TEXT}>
        {FLIXO_SOURCE_TEXT}
      </a>
    </footer>
  );
}
