import {Routes} from '@angular/router';
import {FormDirectivesComponent} from './components/form-directives/form-directives.component';
import {FormContextComponent} from './components/form-context/form-context.component';
import {FormSemanticComponent} from './components/form-semantic/form-semantic.component';
import {FormErrorComponent} from './components/form-error/form-error.component';
import {FormObservationComponent} from './components/form-observation/form-observation.component';
import {FormReactiveComponent} from './components/form-reactive/form-reactive.component';

export const routes: Routes = [
  { path: 'directives', component: FormDirectivesComponent },
  { path: 'context', component: FormContextComponent },
  { path: 'semantic', component: FormSemanticComponent },
  { path: 'error', component: FormErrorComponent },
  { path: 'observation', component: FormObservationComponent },
  { path: 'reactive', component: FormReactiveComponent },
  { path: '', redirectTo: 'directives', pathMatch: 'full' },
];
