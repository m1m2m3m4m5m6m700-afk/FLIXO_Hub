import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { DeveloperWorkspace } from '../pages/developer-workspace';

export const developerWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/developer/workspace',
  head: () => ({
    meta: [
      { title: 'FLIXO Hub — Local Developer Workspace' },
      { name: 'description', content: 'Local browser workspace for importing, editing and exporting project files without automatic upload.' },
      { name: 'robots', content: 'noindex,nofollow' },
    ],
  }),
  component: () => <DeveloperWorkspace locale="ar" />,
});

export const enDeveloperWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/developer/workspace',
  head: () => ({
    meta: [
      { title: 'FLIXO Hub — Local Developer Workspace' },
      { name: 'description', content: 'Local browser workspace for importing, editing and exporting project files without automatic upload.' },
      { name: 'robots', content: 'noindex,nofollow' },
    ],
  }),
  component: () => <DeveloperWorkspace locale="en" />,
});
