import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './star-rating.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => StarRatingComponent),
      multi: true
    }
  ]
})
export class StarRatingComponent implements ControlValueAccessor {
  @Input() maxRating = 5;
  @Input() readOnly = false;
  
  @Output() ratingChange = new EventEmitter<number>();
  
  stars: number[] = [];
  rating = 0;
  hoverRating = 0;
  disabled = false;
  
  private onChange: any = () => {};
  private onTouched: any = () => {};

  ngOnInit() {
    this.stars = Array(this.maxRating).fill(0).map((_, i) => i + 1);
  }

  setRating(rating: number) {
    if (this.readOnly || this.disabled) return;
    this.rating = rating;
    this.ratingChange.emit(this.rating);
    this.onChange(this.rating);
    this.onTouched();
  }

  setHover(rating: number) {
    if (this.readOnly || this.disabled) return;
    this.hoverRating = rating;
  }

  clearHover() {
    this.hoverRating = 0;
  }

  // ControlValueAccessor methods
  writeValue(val: number): void {
    if (val !== undefined && val !== null) {
      this.rating = val;
    } else {
      this.rating = 0;
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
