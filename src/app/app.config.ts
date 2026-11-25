import { registerLocaleData } from '@angular/common';
import localePtMz from '@angular/common/locales/pt-MZ';
import {
  ApplicationConfig,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withHashLocation,
  withInMemoryScrolling,
  withRouterConfig,
} from '@angular/router';
import { environment } from '../environments/environment';
import { AppDataService } from './application/app-data.service';
import { routes } from './app.routes';
import { provideMockRepositories } from './infrastructure/providers';

registerLocaleData(localePtMz);

const routerFeatures = [
  withComponentInputBinding(),
  withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
  withRouterConfig({ paramsInheritanceStrategy: 'always' }),
  ...(environment.useHash ? [withHashLocation()] : []),
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, ...routerFeatures),
    { provide: LOCALE_ID, useValue: 'pt-MZ' },
    // Troque por provideHttpRepositories() quando existir backend REST.
    provideMockRepositories(),
    provideAppInitializer(() => inject(AppDataService).loadAll()),
  ],
};
