import type { CitationSource } from './types';

export type CitationStyle = 'apa' | 'mla' | 'chicago';

function formatAuthorListAPA(authors: string[]): string {
  if (authors.length === 0) return '';
  if (authors.length === 1) return authors[0] + '.';
  if (authors.length === 2) return authors[0] + ', & ' + authors[1] + '.';
  return authors.slice(0, -1).join(', ') + ', & ' + authors[authors.length - 1] + '.';
}

function formatAuthorListMLA(authors: string[]): string {
  if (authors.length === 0) return '';
  if (authors.length === 1) return authors[0] + '.';
  if (authors.length === 2) return authors[0] + ', and ' + authors[1] + '.';
  return authors[0] + ', et al.';
}

function formatAuthorListChicago(authors: string[]): string {
  if (authors.length === 0) return '';
  if (authors.length === 1) return authors[0] + '.';
  return authors.join(', ') + '.';
}

function formatAccessed(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso + 'T12:00:00Z');
    const month = d.toLocaleString('en-US', { month: 'long' });
    const day = d.getUTCDate();
    const year = d.getUTCFullYear();
    return `${month} ${day}, ${year}`;
  } catch {
    return '';
  }
}

/**
 * Format a single item as a bibliography entry in the given style.
 * APA 7, MLA 9, Chicago (Notes/Bibliography — bibliography format).
 */
export function formatBibliography(
  source: CitationSource,
  style: CitationStyle
): string {
  const accessed = source.accessedAt ? formatAccessed(source.accessedAt) : '';
  const authorAPA = formatAuthorListAPA(source.authors);
  const authorMLA = formatAuthorListMLA(source.authors);
  const authorChicago = formatAuthorListChicago(source.authors);

  switch (style) {
    case 'apa': {
      const yearPart = source.year === 'n.d.' ? '(n.d.)' : `(${source.year}).`;
      const titlePart = source.title + '.';
      const sitePart = source.publisher ? ' ' + source.publisher + '.' : '';
      const retrieved = accessed && source.url
        ? ' Retrieved ' + accessed + ', from ' + source.url
        : source.url
          ? ' ' + source.url
          : '';
      if (authorAPA) {
        return authorAPA + ' ' + yearPart + ' ' + titlePart + sitePart + retrieved + '.';
      }
      return titlePart + ' ' + yearPart + sitePart + (source.url ? ' ' + source.url + '.' : '.');
    }
    case 'mla': {
      const authorPart = authorMLA ? authorMLA + ' ' : '';
      const titlePart = '"' + source.title + '." ';
      const sitePart = source.publisher ? source.publisher + ', ' : '';
      const datePart = source.year !== 'n.d.' ? source.year + ', ' : '';
      const urlPart = source.url ? ' ' + source.url : '';
      const accessedPart = accessed ? ' Accessed ' + accessed + '.' : '';
      return authorPart + titlePart + sitePart + datePart + urlPart + '.' + (accessedPart ? ' ' + accessedPart : '');
    }
    case 'chicago': {
      const authorPart = authorChicago ? authorChicago + ' ' : '';
      const titlePart = source.title + '. ';
      const pubPart = source.publisher ? source.publisher + ', ' : '';
      const yearPart = source.year !== 'n.d.' ? source.year + '. ' : 'N.d. ';
      const urlPart = source.url ? ' ' + source.url + '.' : '.';
      const accessedPart = accessed && source.url
        ? ' Accessed ' + accessed + '.'
        : '';
      return authorPart + titlePart + pubPart + yearPart + urlPart + accessedPart;
    }
    default:
      return source.title + '. ' + (source.url || '');
  }
}
