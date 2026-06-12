import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-candidate-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './candidate-card.html',
})
export class CandidateCardComponent {
  @Input() candidateId!: string;
  @Input() name!: string;
  @Input() email?: string;
  @Input() imageUrl?: string;
  @Input() dateLabel = 'Date';
  @Input() dateValue?: string;
  @Input() score?: number | null;
  @Input() maxScore?: number;
  @Input() status?: string;
  @Input() fitStatus?: string;
  @Input() recruiterRating?: number | null;
  
  @Output() cardClick = new EventEmitter<void>();
  @Output() rate = new EventEmitter<number>();

  onClick() {
    this.cardClick.emit();
  }

  onRate(event: MouseEvent, rating: number) {
    event.stopPropagation();
    this.rate.emit(rating);
  }
}
