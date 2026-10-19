import {ApplicationConfig} from '@angular/core';
import {provideRouter, withHashLocation} from '@angular/router';
import {provideRuleTemplates, RequiredRule, EmailRule} from '@such-code/ngx-forms';
import {routes} from './app.routes';

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(routes, withHashLocation()),
        // Application-wide templates (v21: provideValidationService).
        provideRuleTemplates({
            Contact: {
                email: [new RequiredRule(), new EmailRule()],
            },
        }),
    ],
};
