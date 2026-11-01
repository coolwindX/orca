import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { encodePairingOffer } from '../../shared/pairing'
import {
  addEnvironmentFromPairingCode,
  updateEnvironmentFromPairingCode
} from '../../shared/runtime-environment-store'
import { sendRemoteRuntimeRequest } from '../../shared/remote-runtime/remote-runtime-client'
import { createOrcadOrchestrationTransport } from './orcad-orchestration-transport'

vi.mock('../../shared/remote-runtime/remote-runtime-client', () => ({
  sendRemoteRuntimeRequest: vi.fn().mockResolvedValue({ ok: true, result: {} })
}))

describe('orcad orchestration transport', () => {
  const directories: string[] = []
  afterEach(() => {
    vi.clearAllMocks()
    for (const dir of directories.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('routes to a saved peer and fences a replaced pairing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orcad-orchestration-'))
    directories.push(dir)
    const code = encodePairingOffer({
      v: 2,
      endpoint: 'ws://127.0.0.1:6768',
      deviceToken: 'device-token',
      publicKeyB64: Buffer.alloc(32, 1).toString('base64')
    })
    const environment = addEnvironmentFromPairingCode(dir, {
      name: 'worker',
      pairingCode: code,
      now: 10
    })
    const transport = createOrcadOrchestrationTransport(dir)
    const peer = transport.resolve('worker')
    expect(peer).toMatchObject({
      environmentId: environment.id,
      name: 'worker',
      pairingRevision: 10
    })
    const envelope = { orchestrationContractVersion: 1, orchestrationRequestId: 'request' }
    await transport.call(
      peer.environmentId,
      'orchestration.workerStart',
      { task: 'test' },
      1000,
      envelope,
      peer.pairingRevision
    )
    expect(sendRemoteRuntimeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'ws://127.0.0.1:6768' }),
      'orchestration.workerStart',
      { task: 'test' },
      1000,
      envelope
    )
    updateEnvironmentFromPairingCode(dir, environment.id, { pairingCode: code, now: 20 })
    expect(
      await transport.call(
        peer.environmentId,
        'orchestration.workerStart',
        {},
        1000,
        envelope,
        peer.pairingRevision
      )
    ).toMatchObject({ ok: false, error: { code: 'runtime_environment_changed' } })
    expect(sendRemoteRuntimeRequest).toHaveBeenCalledTimes(1)
  })
})
