import { afterEach, describe, expect, it } from 'vitest'
import { getMeta, offlineDb, setMeta } from './db'

afterEach(async () => {
  await offlineDb.meta.clear()
})

describe('offline db meta helpers', () => {
  it('retorna undefined quando a chave não existe', async () => {
    expect(await getMeta('inexistente')).toBeUndefined()
  })

  it('grava e lê um valor', async () => {
    await setMeta('lastSync:tenant-1', '2026-01-15T10:00:00Z')
    expect(await getMeta('lastSync:tenant-1')).toBe('2026-01-15T10:00:00Z')
  })

  it('sobrescreve o valor de uma chave existente', async () => {
    await setMeta('chave', 'valor 1')
    await setMeta('chave', 'valor 2')
    expect(await getMeta('chave')).toBe('valor 2')
  })
})
