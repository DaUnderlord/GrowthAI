export type ProviderPostFormat =
  | 'Reel'
  | 'Carousel'
  | 'Story'
  | 'Feed'
  | 'Shorts'
  | 'Article'
  | 'Ad Campaign'
  | 'Unknown';

const KNOWN: ProviderPostFormat[] = [
  'Reel',
  'Carousel',
  'Story',
  'Feed',
  'Shorts',
  'Article',
  'Ad Campaign',
  'Unknown',
];

export function mapProviderPostType(post: {
  postType?: string;
  media_type?: string;
  mediaType?: string;
  media_product_type?: string;
  mediaProductType?: string;
} | null | undefined): ProviderPostFormat {
  if (!post) return 'Unknown';
  const product = String(post.media_product_type || post.mediaProductType || '').toUpperCase();
  const media = String(post.media_type || post.mediaType || '').toUpperCase();
  if (product === 'REELS' || media === 'REELS') return 'Reel';
  if (product === 'STORY' || media === 'STORY') return 'Story';
  if (media === 'CAROUSEL_ALBUM') return 'Carousel';
  if (media === 'IMAGE' || media === 'VIDEO') return 'Feed';
  const existing = String(post.postType || '').trim();
  if (KNOWN.includes(existing as ProviderPostFormat)) return existing as ProviderPostFormat;
  if (/reel/i.test(existing)) return 'Reel';
  if (/carousel/i.test(existing)) return 'Carousel';
  if (/stor(y|ies)/i.test(existing)) return 'Story';
  if (/short/i.test(existing)) return 'Shorts';
  if (/feed|image|photo/i.test(existing)) return 'Feed';
  return 'Unknown';
}

export function formatLabel(format: ProviderPostFormat | string): string {
  if (format === 'Unknown' || !format) return 'Unclassified';
  if (format === 'Feed') return 'Feed';
  return String(format);
}

export function calendarTypeFromFormat(
  format: ProviderPostFormat | string
): 'Reel' | 'Carousel' | 'Story' | 'Article' | 'Ad Campaign' | 'Shorts' {
  if (format === 'Reel') return 'Reel';
  if (format === 'Shorts') return 'Shorts';
  if (format === 'Story') return 'Story';
  if (format === 'Article') return 'Article';
  if (format === 'Ad Campaign') return 'Ad Campaign';
  if (format === 'Carousel' || format === 'Feed') return 'Carousel';
  return 'Reel';
}
