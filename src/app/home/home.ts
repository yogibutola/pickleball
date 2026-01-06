import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../theme.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [RouterLink, CommonModule],
    templateUrl: './home.html',
    styleUrl: './home.css'
})
export class HomeComponent {
    private themeService = inject(ThemeService);
    currentTheme = this.themeService.theme;

    images = [
        {
            src: '/assets/images/pickleball_group_high_five_1767668502686.png',
            alt: 'Group high five',
            title: 'Manage Your League',
            caption: 'Effortless organization for clubs and groups.',
            buttonText: 'Manage League',
            link: '/admin/login'
        },
        {
            src: '/assets/images/pickleball_serve_moment_1767668489237.png',
            alt: 'Close up of a serve',
            title: 'Player Portal',
            caption: 'Track your stats, matches, and ratings.',
            buttonText: 'Player Sign-In',
            link: '/login'
        },
        {
            src: '/assets/images/pickleball_game_action_1767668476539.png',
            alt: 'Action shot of a doubles game',
            title: 'See It in Action',
            caption: 'Experience the power of automated slotting.',
            buttonText: 'Demo',
            link: '/signup'
        }
    ];

    currentSlide = 0;

    nextSlide() {
        this.currentSlide = (this.currentSlide + 1) % this.images.length;
    }

    prevSlide() {
        this.currentSlide = (this.currentSlide - 1 + this.images.length) % this.images.length;
    }

    setSlide(index: number) {
        this.currentSlide = index;
    }
}
