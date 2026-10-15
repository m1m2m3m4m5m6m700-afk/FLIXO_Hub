import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { HubHome } from '../pages/hub-home';
import { HubPrivacy } from '../pages/hub-privacy';

export const hubRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/hub',
  head: () => ({
    meta: [
      { title: 'FLIXO Hub — أدوات ملفات محلية' },
      { name: 'description', content: 'أدوات ملفات محلية داخل المتصفح مع تركيز على الخصوصية.' },
      { name: 'robots', content: 'index,follow' },
    ],
  }),
  component: () => <HubHome locale="ar" />,
});

export const hubPrivacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/hub/privacy',
  head: () => ({
    meta: [
      { title: 'FLIXO Hub — الخصوصية' },
      { name: 'description', content: 'حدود معالجة الملفات محليًا داخل متصفح FLIXO Hub.' },
      { name: 'robots', content: 'index,follow' },
    ],
  }),
  component: () => <HubPrivacy locale="ar" />,
});
