import {ApplicationConfig} from '@angular/core';
import {provideRouter, withHashLocation} from '@angular/router';
import {provideRuleTemplates, RequiredRule, EmailRule} from '@such-code/ngx-forms-validation';
import {routes} from './app.routes';

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(routes, withHashLocation()),
        provideRuleTemplates({
            Contact: {
                email: [new RequiredRule(), new EmailRule()],
            },
        }),
    ],
};
