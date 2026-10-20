import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { DeveloperContribution } from '../pages/developer-contribution';

export const developerContributionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/developer/contribute',
  head: () => ({
    meta: [
      { title: 'FLIXO Hub — Contribution' },
      { name: 'description', content: 'Create an evidence-bound local contribution proposal for the FLIXO programming platform.' },
      { name: 'robots', content: 'noindex,nofollow' },
    ],
  }),
  component: DeveloperContribution,
});
