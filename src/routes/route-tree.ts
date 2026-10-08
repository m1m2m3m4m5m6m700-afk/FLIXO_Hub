import { arIndexRoute } from './ar-index';
import { enHubPrivacyRoute, enHubRoute } from './en-hub';
import { hubPrivacyRoute, hubRoute } from './hub';
import { indexRoute } from './index';
import { localizedHomeRoute } from './localized-home';
import { localizedToolRoute } from './localized-tool';
import { adminControlPlaneRoute } from './admin-control-plane';
import { adminControlPlaneLoginRoute } from './admin-control-plane-login';
import { toolsRoute } from './tools';
import { arToolsRoute } from './ar-tools';
import { developerPlatformRoute, enDeveloperPlatformRoute } from './developer-platform';

export const routeChildren = [
  indexRoute,
  arIndexRoute,
  localizedHomeRoute,
  hubRoute,
  hubPrivacyRoute,
  enHubRoute,
  enHubPrivacyRoute,
  toolsRoute,
  arToolsRoute,
  developerPlatformRoute,
  enDeveloperPlatformRoute,
  localizedToolRoute,
  adminControlPlaneLoginRoute,
  adminControlPlaneRoute,
] as const;
