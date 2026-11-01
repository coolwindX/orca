import { resolveEnvironment } from '../../shared/runtime-environment-store'
import { getPreferredPairedRuntimeConnection } from '../../shared/runtime-environments'
import { sendRemoteRuntimeRequest } from '../../shared/remote-runtime/remote-runtime-client'
import { runtimeEnvironmentRevisionFailure } from '../ipc/runtime-environments/runtime-environment-revision-guard'
import {
  fingerprintOrchestrationPeer,
  type OrchestrationEnvironmentTransport
} from '../runtime/orchestration/environment-transport'

export function createOrcadOrchestrationTransport(
  userDataPath: string
): OrchestrationEnvironmentTransport {
  return {
    resolve: (selector) => {
      const environment = resolveEnvironment(userDataPath, selector)
      const connection = getPreferredPairedRuntimeConnection(environment)
      return {
        environmentId: environment.id,
        name: environment.name,
        peerFingerprint: fingerprintOrchestrationPeer(connection.hostPublicKeyB64),
        pairingRevision: environment.pairingRevision ?? environment.createdAt
      }
    },
    call: (selector, method, params, timeoutMs, envelope, expectedPairingRevision) => {
      const environment = resolveEnvironment(userDataPath, selector)
      const failure = runtimeEnvironmentRevisionFailure(
        environment,
        expectedPairingRevision,
        method
      )
      if (failure) {
        return Promise.resolve(failure)
      }
      if (environment.connectionDependency === 'ssh-tunnel') {
        return Promise.reject(
          new Error('SSH-managed environment connections are unavailable in this runtime.')
        )
      }
      return sendRemoteRuntimeRequest(
        getPreferredPairedRuntimeConnection(environment),
        method,
        params,
        timeoutMs ?? 15_000,
        envelope
      )
    }
  }
}
