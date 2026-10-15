// SPDX-License-Identifier: AGPL-3.0-only

import { useLocation } from '@tanstack/react-router';
import { LOCALES } from '../lib/i18n/config';
import { localizeToolUiValue } from '../lib/i18n/tool-ui-runtime-completeness';
import {
  FLIXO_ATTRIBUTION_TEXT,
  FLIXO_REPOSITORY_URL,
  FLIXO_SOURCE_TEXT,
} from './flixo-attribution';

export function FlixoAttributionFooter() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const prefix = pathname.split('/').filter(Boolean)[0];
  const locale = prefix && (LOCALES as readonly string[]).includes(prefix) ? prefix : 'en';
  const sourceText = localizeToolUiValue(locale, FLIXO_SOURCE_TEXT, '');
  return (
    <footer className="flixo-attribution" data-testid="flixo-attribution">
      <a href={FLIXO_REPOSITORY_URL} aria-label={FLIXO_ATTRIBUTION_TEXT}>
        {FLIXO_ATTRIBUTION_TEXT}
      </a>
      <a href={FLIXO_REPOSITORY_URL} aria-label={sourceText}>
        {sourceText}
      </a>
    </footer>
  );
}
