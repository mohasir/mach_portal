export interface UploadParams {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StorageProvider {
  upload(params: UploadParams): Promise<{ key: string; url: string }>;
  delete(key: string): Promise<void>;
}
