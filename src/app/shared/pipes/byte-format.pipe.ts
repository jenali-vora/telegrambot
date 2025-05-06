import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'byteFormat', standalone: true })
export class ByteFormatPipe implements PipeTransform {
  transform(bytes: number | undefined | null, decimals = 1): string {
    if (bytes === undefined || bytes === null || isNaN(bytes) || bytes < 0) return '-';
    if (bytes === 0) return '0 Bytes';
    const k = 1024; const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const sizeIndex = Math.min(i, sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, sizeIndex)).toFixed(dm)) + ' ' + sizes[sizeIndex];
  }
}