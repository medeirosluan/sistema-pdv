import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, http, tokenStore } from './api'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('tokenStore', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('salva e lê os tokens do localStorage', () => {
    tokenStore.save('access-1', 'refresh-1')
    expect(tokenStore.access).toBe('access-1')
    expect(tokenStore.refresh).toBe('refresh-1')
  })

  it('limpa os tokens', () => {
    tokenStore.save('access-1', 'refresh-1')
    tokenStore.clear()
    expect(tokenStore.access).toBeNull()
    expect(tokenStore.refresh).toBeNull()
  })
})

describe('http requests', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('envia o token de acesso no header Authorization quando presente', async () => {
    tokenStore.save('access-token', 'refresh-token')
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { ok: true }))

    await http.get('/products')

    const [, init] = vi.mocked(fetch).mock.calls[0]
    const headers = new Headers(init?.headers)
    expect(headers.get('Authorization')).toBe('Bearer access-token')
  })

  it('lança ApiError com a mensagem do backend quando a resposta falha', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(400, { message: 'Dados inválidos' }),
    )

    await expect(http.get('/products')).rejects.toMatchObject({
      message: 'Dados inválidos',
      status: 400,
    })
    await expect(http.get('/products')).rejects.toBeInstanceOf(ApiError)
  })

  it('junta múltiplas mensagens de validação em uma só string', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(400, { message: ['Nome é obrigatório', 'Preço inválido'] }),
    )

    await expect(http.get('/products')).rejects.toMatchObject({
      message: 'Nome é obrigatório, Preço inválido',
    })
  })

  it('renova o access token em uma resposta 401 e repete a requisição original', async () => {
    tokenStore.save('access-expirado', 'refresh-valido')
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Não autorizado' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          accessToken: 'access-novo',
          refreshToken: 'refresh-novo',
          user: {},
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }))

    const result = await http.get('/products')

    expect(result).toEqual({ items: [] })
    expect(tokenStore.access).toBe('access-novo')
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('limpa os tokens e propaga o erro quando o refresh também falha', async () => {
    tokenStore.save('access-expirado', 'refresh-invalido')
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Não autorizado' }))
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Refresh inválido' }))

    await expect(http.get('/products')).rejects.toMatchObject({ status: 401 })
    expect(tokenStore.access).toBeNull()
  })

  it('não envia Authorization em chamadas marcadas como públicas', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, {
        accessToken: 'a',
        refreshToken: 'b',
        user: {},
      }),
    )

    await api.login({
      tenantSlug: 'loja',
      email: 'demo@example.com',
      password: 'x',
    })

    const [, init] = vi.mocked(fetch).mock.calls[0]
    const headers = new Headers(init?.headers)
    expect(headers.has('Authorization')).toBe(false)
  })

  it('retorna undefined para respostas 204 sem corpo', async () => {
    tokenStore.save('access', 'refresh')
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    const result = await http.delete('/products/1')

    expect(result).toBeUndefined()
  })
})
