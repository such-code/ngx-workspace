import {Routes} from '@angular/router';

export const routes: Routes = [
    {path: 'templates', loadComponent: () => import('./pages/templates.page').then($ => $.TemplatesPage), title: 'Templates'},
    {path: 'server', loadComponent: () => import('./pages/server-errors.page').then($ => $.ServerErrorsPage), title: 'Server errors'},
    {path: 'semantic', loadComponent: () => import('./pages/semantic.page').then($ => $.SemanticPage), title: 'Semantic'},
    {path: 'dynamic', loadComponent: () => import('./pages/dynamic.page').then($ => $.DynamicPage), title: 'Dynamic structure'},
    {path: 'wizard', loadComponent: () => import('./pages/wizard.page').then($ => $.WizardPage), title: 'Wizard'},
    {path: 'input', loadComponent: () => import('./pages/input.page').then($ => $.InputPage), title: 'Input correction'},
    {path: '', redirectTo: 'templates', pathMatch: 'full'},
];
