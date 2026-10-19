import {Component} from '@angular/core';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {routes} from './app.routes';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, RouterLink, RouterLinkActive],
    template: `
        <nav class="navbar navbar-expand navbar-dark bg-dark mb-4">
            <div class="container">
                <span class="navbar-brand">ngx-forms</span>
                <ul class="navbar-nav me-auto flex-wrap">
                    @for (route of links; track route.path) {
                        <li class="nav-item">
                            <a class="nav-link" [routerLink]="'/' + route.path" routerLinkActive="active">{{ route.title }}</a>
                        </li>
                    }
                </ul>
            </div>
        </nav>
        <main class="container pb-5">
            <router-outlet/>
        </main>
    `,
})
export class AppComponent {
    protected readonly links = routes.filter($ => !!$.title);
}
