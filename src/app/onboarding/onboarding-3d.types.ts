export type Onboarding3dMode = 'establishment' | 'property';

export type Onboarding3dVisual =
  | 'tower'
  | 'apartment'
  | 'compound'
  | 'resort'
  | 'hostel'
  | 'institutional'
  | 'mixed';

export type LayoutFocusField = 'none' | 'floors' | 'rooms' | 'compounds' | 'buildings';

export function visualFromPresetId(presetId: string | null | undefined): Onboarding3dVisual {
  const map: Record<string, Onboarding3dVisual> = {
    hotel: 'tower',
    serviced_apartments: 'apartment',
    residential_compound: 'compound',
    corporate_housing: 'mixed',
    hospital: 'institutional',
    student_housing: 'hostel',
  };
  return map[presetId ?? ''] ?? 'tower';
}

export function visualFromPresetIcon(icon: string | null | undefined): Onboarding3dVisual {
  const map: Record<string, Onboarding3dVisual> = {
    hotel: 'tower',
    apartment: 'apartment',
    compound: 'compound',
    corporate: 'mixed',
    hospital: 'institutional',
    student: 'hostel',
    building: 'tower',
  };
  return map[icon ?? ''] ?? 'tower';
}

export function visualFromProfileId(profileId: string | null | undefined): Onboarding3dVisual {
  const map: Record<string, Onboarding3dVisual> = {
    hotel: 'tower',
    serviced_apartments: 'apartment',
    residential_compound: 'compound',
    resort: 'resort',
    hostel: 'hostel',
    corporate_housing: 'mixed',
    hospital: 'institutional',
    student_housing: 'hostel',
  };
  return map[profileId ?? ''] ?? 'tower';
}
