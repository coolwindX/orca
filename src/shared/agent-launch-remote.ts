import type { Repo } from './repo-types'
import { getRepoExecutionHostId, isRemoteExecutionHostId } from './execution-host'

/** SSH relays and headless runtimes install plain `orca`; only local Linux desktops use `orca-ide`. */
export function repoIsRemote(repo: Pick<Repo, 'connectionId' | 'executionHostId'>): boolean {
  return isRemoteExecutionHostId(getRepoExecutionHostId(repo))
}
