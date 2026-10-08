import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { DeveloperContributions } from '../pages/developer-contributions';

export const developerContributionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/developer/contributions',
  head: () => ({
    meta: [
      { title: 'FLIXO Hub — Contributions' },
      { name: 'description', content: 'Reusable contribution center for FLIXO projects, tools, agents, skills, verifiers, workflows and templates.' },
      { name: 'robots', content: 'index,follow' },
    ],
  }),
  component: () => <DeveloperContributions locale="ar" />,
});

export const enDeveloperContributionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/developer/contributions',
  head: () => ({
    meta: [
      { title: 'FLIXO Hub — Contributions' },
      { name: 'description', content: 'Reusable contribution center for FLIXO projects, tools, agents, skills, verifiers, workflows and templates.' },
      { name: 'robots', content: 'index,follow' },
    ],
  }),
  component: () => <DeveloperContributions locale="en" />,
});
