import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { FileStorage } from '../../src/infrastructure/storage/file-storage.js';
import type { FileRepository } from '../../src/modules/files/file.repository.js';
import { FileService } from '../../src/modules/files/file.service.js';
import type { FileRecord } from '../../src/modules/files/file.types.js';
import { png } from '../fixtures.js';

describe('file service', () => {
  it('cleans up stored bytes when metadata persistence fails', async () => {
    const repository = mock<FileRepository>();
    const storage = mock<FileStorage>();
    storage.save.mockResolvedValue({ key: 'generated', size: png.length });
    repository.create.mockRejectedValue(new Error('database unavailable'));
    await expect(
      new FileService(repository, storage).upload({
        ownerId: 'owner',
        buffer: png,
        originalName: 'image.png',
        declaredMimeType: 'image/png',
      }),
    ).rejects.toThrow('database unavailable');
    expect(storage.delete).toHaveBeenCalledWith(storage.save.mock.calls[0]![0].key);
  });

  it('rejects non-image content disguised as an image', async () => {
    const storage = mock<FileStorage>();
    await expect(
      new FileService(mock<FileRepository>(), storage).upload({
        ownerId: 'owner',
        buffer: Buffer.from('this is not an image'),
        originalName: 'image.png',
        declaredMimeType: 'image/png',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('hides other users files and does not delete their data', async () => {
    const repository = mock<FileRepository>();
    const storage = mock<FileStorage>();
    repository.findById.mockResolvedValue(mock<FileRecord>({ ownerId: 'someone-else' }));
    await expect(new FileService(repository, storage).delete('file', 'me')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(repository.delete).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
