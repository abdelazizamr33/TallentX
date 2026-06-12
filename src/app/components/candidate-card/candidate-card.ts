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
  @Input() dateLabel = 'Date';
  @Input() dateValue?: string;
  @Input() score?: number | null;
  @Input() maxScore?: number;
  @Input() status?: string;
  
  @Output() cardClick = new EventEmitter<void>();

  onClick() {
    this.cardClick.emit();
  }
}
