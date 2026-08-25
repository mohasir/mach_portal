import { env } from '../../env';
import { R2StorageProvider } from './providers/r2.provider';
import type { StorageProvider } from './storage.types';

export type { StorageProvider, UploadParams } from './storage.types';

let instance: StorageProvider | undefined;

export function getStorageProvider(): StorageProvider {
  if (!instance) {
    switch (env.STORAGE_PROVIDER) {
      case 'r2':
      default:
        instance = new R2StorageProvider();
    }
  }
  return instance;
}
