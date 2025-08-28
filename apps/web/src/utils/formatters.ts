/**
 * Formatting utility functions
 */

/**
 * Format a number as currency
 */
export function formatCurrency(
  amount: number,
  currency = 'USD',
  locale = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format a number with commas
 */
export function formatNumber(
  number: number,
  locale = 'en-US'
): string {
  return new Intl.NumberFormat(locale).format(number);
}

/**
 * Format a percentage
 */
export function formatPercentage(
  value: number,
  decimals = 1,
  locale = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

/**
 * Format bytes to human readable size
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Format phone number
 */
export function formatPhoneNumber(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  }
  
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
  }
  
  return phoneNumber;
}

/**
 * Format address
 */
export function formatAddress(address: {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}): string {
  const parts = [];
  
  if (address.street) parts.push(address.street);
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  if (address.zipCode) parts.push(address.zipCode);
  if (address.country) parts.push(address.country);
  
  return parts.join(', ');
}

/**
 * Format name (first letter of each word capitalized)
 */
export function formatName(name: string): string {
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format time ago
 */
export function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffInMs = now.getTime() - past.getTime();
  
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  const diffInWeeks = Math.floor(diffInDays / 7);
  const diffInMonths = Math.floor(diffInDays / 30);
  const diffInYears = Math.floor(diffInDays / 365);

  if (diffInYears > 0) return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
  if (diffInMonths > 0) return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
  if (diffInWeeks > 0) return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
  if (diffInDays > 0) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  if (diffInHours > 0) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  if (diffInMinutes > 0) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format list with proper grammar
 */
export function formatList(items: string[], conjunction = 'and'): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  
  const lastItem = items[items.length - 1];
  const otherItems = items.slice(0, -1);
  
  return `${otherItems.join(', ')}, ${conjunction} ${lastItem}`;
}

/**
 * Format status with proper styling class
 */
export function formatStatus(status: string): {
  label: string;
  className: string;
} {
  const statusMap: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-green-100 text-green-800' },
    inactive: { label: 'Inactive', className: 'bg-gray-100 text-gray-800' },
    pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
    completed: { label: 'Completed', className: 'bg-blue-100 text-blue-800' },
    cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800' },
    draft: { label: 'Draft', className: 'bg-gray-100 text-gray-800' },
    published: { label: 'Published', className: 'bg-green-100 text-green-800' },
    archived: { label: 'Archived', className: 'bg-purple-100 text-purple-800' },
  };

  return statusMap[status.toLowerCase()] || {
    label: status,
    className: 'bg-gray-100 text-gray-800',
  };
}

const formatters = {
  currency: formatCurrency,
  number: formatNumber,
  percentage: formatPercentage,
  bytes: formatBytes,
  duration: formatDuration,
  phoneNumber: formatPhoneNumber,
  address: formatAddress,
  name: formatName,
  timeAgo: formatTimeAgo,
  truncate,
  list: formatList,
  status: formatStatus,
};

export default formatters;
