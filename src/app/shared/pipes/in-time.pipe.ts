import { Pipe, PipeTransform } from '@angular/core';

/** "0930" → "09:30". */
@Pipe({ name: 'inTime', standalone: true })
export class InTimePipe implements PipeTransform {
  transform(value: any): unknown {
    if (typeof value === 'string' && value.length === 4 && !isNaN(parseInt(value, 10))) {
      return `${value.substring(0, 2)}:${value.substring(2, 4)}`;
    }
    return value;
  }
}
