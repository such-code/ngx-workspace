import {ChangeDetectionStrategy, Component, signal} from '@angular/core';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterOutlet, RouterLink, RouterLinkActive],
})
export class AppComponent {

    public readonly showNavbar = signal(false);

    public handleNavbarToggle($event: MouseEvent): void {
        this.showNavbar.update($ => !$);
    }

}
