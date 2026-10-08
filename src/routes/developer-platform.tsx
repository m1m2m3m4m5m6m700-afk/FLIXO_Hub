import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { DeveloperPlatform } from '../pages/developer-platform';

export const developerPlatformRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/developer',
  head: () => ({
    meta: [
      { title: 'FLIXO Hub — Developer Platform' },
      { name: 'description', content: 'Governed programming workspace for projects, execution, verification, agents and contributions.' },
      { name: 'robots', content: 'index,follow' },
    ],
  }),
  component: () => <DeveloperPlatform locale="ar" />,
});

export const enDeveloperPlatformRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/developer',
  head: () => ({
    meta: [
      { title: 'FLIXO Hub — Developer Platform' },
      { name: 'description', content: 'Governed programming workspace for projects, execution, verification, agents and contributions.' },
      { name: 'robots', content: 'index,follow' },
    ],
  }),
  component: () => <DeveloperPlatform locale="en" />,
});
