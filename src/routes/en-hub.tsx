import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { HubHome } from '../pages/hub-home';
import { HubPrivacy } from '../pages/hub-privacy';

export const enHubRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/hub',
  head: () => ({
    meta: [
      { title: 'FLIXO Hub — Local file tools' },
      { name: 'description', content: 'Local browser file tools with a strict privacy-first processing boundary.' },
      { name: 'robots', content: 'index,follow' },
    ],
  }),
  component: () => <HubHome locale="en" />,
});

export const enHubPrivacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/hub/privacy',
  head: () => ({
    meta: [
      { title: 'FLIXO Hub — Privacy' },
      { name: 'description', content: 'FLIXO Hub local file processing and browser privacy boundary.' },
      { name: 'robots', content: 'index,follow' },
    ],
  }),
  component: () => <HubPrivacy locale="en" />,
});
