import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const token = authService.getToken();

    if (token) {
        // console.log('AuthInterceptor: Attaching token', token.substring(0, 10) + '...');
        const cloned = req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        });
        return next(cloned);
    } else {
        console.warn('AuthInterceptor: No token found in AuthService');
    }

    return next(req);
};
