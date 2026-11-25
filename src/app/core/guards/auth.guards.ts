import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../services/session.service';

export const customerGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionService);
  return session.isLoggedIn() ? true : inject(Router).createUrlTree(['/entrar'], { queryParams: { voltar: state.url } });
};

export const adminGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionService);
  return session.isAdmin() ? true : inject(Router).createUrlTree(['/admin/entrar'], { queryParams: { voltar: state.url } });
};
