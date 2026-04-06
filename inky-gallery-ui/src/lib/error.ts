import { ApiError } from '@/lib/api';

export function extractErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    if (error.message.includes('Failed to fetch')) {
      return 'Could not reach InkyGallery. Please reload the page and try again.';
    }
    return error.message;
  }
  return 'Something went wrong';
}
