export type ReleaseStage = 'nightly' | 'alpha' | 'beta' | 'rc' | 'stable';

export interface VersionInfo {
  version: string;
  stage: ReleaseStage;
  label: string;
}

const STAGE_LABELS: Record<ReleaseStage, string> = {
  nightly: 'Nightly',
  alpha: 'Alpha',
  beta: 'Beta',
  rc: 'RC',
  stable: 'Release',
};

export function parseVersion(version: string): VersionInfo {
  const prerelease = version.split('-')[1]?.split('.')[0];
  const stage: ReleaseStage =
    prerelease === 'nightly' ? 'nightly' :
    prerelease === 'alpha' ? 'alpha' :
    prerelease === 'beta' ? 'beta' :
    prerelease === 'rc' ? 'rc' :
    'stable';

  return {
    version,
    stage,
    label: STAGE_LABELS[stage],
  };
}
