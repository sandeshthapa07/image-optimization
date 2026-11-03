// Eval 06: Angular 19 standalone component
import { Component, Input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [NgOptimizedImage],
  template: `
    <!-- bug: priority combined with loading="lazy" -->
    <img ngSrc="hero.jpg" width="1920" height="1080" priority loading="lazy" alt="Mountain view" class="hero" />

    <!-- bug: fill without sizes and without object-fit -->
    <div class="card" style="position: relative; aspect-ratio: 4 / 3">
      <img ngSrc="card.jpg" fill alt="Card image" />
    </div>

    <!-- bug: ngSrc without width/height and without fill -->
    <img ngSrc="logo.png" alt="Acme" />
  `,
})
export class HeroComponent {
  @Input() title = '';
}
