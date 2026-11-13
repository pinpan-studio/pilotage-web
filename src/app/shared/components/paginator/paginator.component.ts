import { Component, input, output, computed } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-paginator',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './paginator.component.html',
  styleUrl: './paginator.component.scss',
})
export class PaginatorComponent {
  total = input<number>(0);
  page = input<number>(1);
  itemPerPage = input<number>(20);
  pageSizeOptions = input<number[]>([10, 20, 50, 100]);

  pageChange = output<number>();
  pageSizeChange = output<number>();

  nbPage = computed(() => {
    const tot = this.total();
    const size = this.itemPerPage();
    return Math.max(1, Math.ceil(tot / size));
  });

  rangeStart = computed(() => {
    if (this.total() === 0) return 0;
    return (this.page() - 1) * this.itemPerPage() + 1;
  });

  rangeEnd = computed(() => {
    return Math.min(this.page() * this.itemPerPage(), this.total());
  });

  visiblePages = computed(() => {
    const current = this.page();
    const totalPages = this.nbPage();
    const pages: (number | string)[] = [];

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) {
        pages.push('...');
      }
      const start = Math.max(2, current - 1);
      const end = Math.min(totalPages - 1, current + 1);
      for (let i = start; i <= end; i++) {
        if (i > 1 && i < totalPages) pages.push(i);
      }
      if (current < totalPages - 2) {
        pages.push('...');
      }
      pages.push(totalPages);
    }
    return pages;
  });

  changePage(p: number) {
    if (p >= 1 && p <= this.nbPage() && p !== this.page()) {
      this.pageChange.emit(p);
    }
  }

  onPageSizeChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.pageSizeChange.emit(Number(select.value));
  }
}
