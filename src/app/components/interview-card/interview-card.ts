import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-interview-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './interview-card.html',
})
export class InterviewCardComponent {
  @Input() interviewId!: number;
  @Input() candidateName!: string;
  @Input() interviewType!: string;
  @Input() date!: string;
  @Input() status!: string;
  
  @Output() cardClick = new EventEmitter<void>();

  onClick() {
    this.cardClick.emit();
  }
}
