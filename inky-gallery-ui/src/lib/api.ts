import type {
  Asset,
  DeviceSettings,
  DisplayStatus,
  PlaybackPayload,
  PlaybackSettings,
  QueueItem,
  QueueSortMode,
} from '@/data/types';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function apiRequest<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      Accept: 'application/json',
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
    ...init,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : payload?.error || payload?.message || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export interface UploadOptions {
  duplicatePolicy?: 'reject' | 'reuse_existing' | 'keep_both';
  autoAddToQueue?: boolean;
}

export interface AppBootstrap {
  assets: Asset[];
  queue: QueueItem[];
  playback: PlaybackPayload;
  deviceSettings: DeviceSettings;
  displayStatus: DisplayStatus;
}

export async function fetchBootstrap(): Promise<AppBootstrap> {
  const [assets, queue, playback, deviceSettings, displayStatus] = await Promise.all([
    listAssets(),
    getQueue(),
    getPlayback(),
    getDeviceSettings(),
    getDisplayStatus(),
  ]);

  return {
    assets,
    queue,
    playback,
    deviceSettings,
    displayStatus,
  };
}

export async function listAssets(): Promise<Asset[]> {
  const items: Asset[] = [];
  let cursor: number | null = 0;

  while (cursor !== null) {
    const query: string = cursor ? `?cursor=${cursor}` : '';
    const data: { items: Asset[]; next_cursor: number | null } = await apiRequest(`/api/assets${query}`);
    items.push(...data.items);
    cursor = data.next_cursor;
  }

  return items;
}

export async function uploadAssets(files: File[], options: UploadOptions): Promise<{ created: Asset[] }> {
  const form = new FormData();
  files.forEach((file) => form.append('files[]', file));
  form.append('duplicate_policy', options.duplicatePolicy || 'reject');
  form.append('auto_add_to_queue', String(Boolean(options.autoAddToQueue)));
  return apiRequest('/api/assets', {
    method: 'POST',
    body: form,
  });
}

export function updateAsset(assetId: string, updates: Partial<Pick<Asset, 'favorite' | 'caption'>>) {
  return apiRequest<Asset>(`/api/assets/${assetId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function deleteAsset(assetId: string) {
  return apiRequest<{ success: true }>(`/api/assets/${assetId}`, {
    method: 'DELETE',
  });
}

export function bulkDeleteAssets(assetIds: string[]) {
  return apiRequest<{ success: true; deleted_asset_ids: string[] }>('/api/assets/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ asset_ids: assetIds }),
  });
}

export async function getQueue(): Promise<QueueItem[]> {
  const data = await apiRequest<{ items: QueueItem[] }>('/api/queue');
  return data.items;
}

export async function addQueueItems(assetIds: string[]): Promise<QueueItem[]> {
  const data = await apiRequest<{ items: QueueItem[] }>('/api/queue/items', {
    method: 'POST',
    body: JSON.stringify({ asset_ids: assetIds }),
  });
  return data.items;
}

export function applyAssetNow(assetId: string) {
  return apiRequest<{ queue_item: QueueItem; state: PlaybackPayload['state'] }>('/api/queue/apply-now', {
    method: 'POST',
    body: JSON.stringify({ asset_id: assetId }),
  });
}

export function updateQueueItem(queueItemId: string, updates: Partial<QueueItem>) {
  return apiRequest<QueueItem>(`/api/queue/items/${queueItemId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function deleteQueueItem(queueItemId: string) {
  return apiRequest<{ success: true }>(`/api/queue/items/${queueItemId}`, {
    method: 'DELETE',
  });
}

export async function reorderQueue(orderedQueueItemIds: string[]): Promise<QueueItem[]> {
  const data = await apiRequest<{ items: QueueItem[] }>('/api/queue/reorder', {
    method: 'POST',
    body: JSON.stringify({ ordered_queue_item_ids: orderedQueueItemIds }),
  });
  return data.items;
}

export async function sortQueue(sortMode: QueueSortMode): Promise<QueueItem[]> {
  const data = await apiRequest<{ items: QueueItem[] }>('/api/queue/sort', {
    method: 'POST',
    body: JSON.stringify({ sort_mode: sortMode }),
  });
  return data.items;
}

export function getPlayback() {
  return apiRequest<PlaybackPayload>('/api/playback');
}

export function updatePlaybackSettings(updates: Partial<PlaybackSettings>) {
  return apiRequest<PlaybackSettings>('/api/playback', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function previewPlayback(payload: {
  asset_id?: string;
  queue_item_id?: string;
  direction?: 'next' | 'previous';
}) {
  return apiRequest('/api/playback/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function applyPreview() {
  return apiRequest('/api/playback/apply', { method: 'POST' });
}

export function pausePlayback() {
  return apiRequest('/api/playback/pause', { method: 'POST' });
}

export function resumePlayback() {
  return apiRequest('/api/playback/resume', { method: 'POST' });
}

export function nextPlayback() {
  return apiRequest('/api/playback/next', { method: 'POST' });
}

export function previousPlayback() {
  return apiRequest('/api/playback/previous', { method: 'POST' });
}

export function getDeviceSettings() {
  return apiRequest<DeviceSettings>('/api/device/settings');
}

export function updateDeviceSettings(updates: Partial<DeviceSettings>) {
  return apiRequest<DeviceSettings>('/api/device/settings', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function getDisplayStatus() {
  return apiRequest<DisplayStatus>('/api/display/status');
}
