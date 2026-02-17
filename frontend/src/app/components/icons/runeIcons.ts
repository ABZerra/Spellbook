import type { ComponentType, SVGProps } from 'react';
import {
  AttackRollIcon,
  CastingTimeIcon,
  CharacterIcon,
  CommitRitualIcon,
  ConcentrationIcon,
  CornerFlourishLeftIcon,
  CornerFlourishRightIcon,
  DamageIcon,
  DiffChangesIcon,
  DiscardPlanIcon,
  DividerOrnateIcon,
  DividerSectionIcon,
  DividerShortIcon,
  DividerSimpleIcon,
  DuplicateWarningIcon,
  DurationIcon,
  HealingIcon,
  LibraryIcon,
  MaterialIcon,
  NoteIntentIcon,
  RangeIcon,
  ReplaceSpellIcon,
  RitualIcon,
  SaveIcon,
  SchoolAbjurationIcon,
  SchoolConjurationIcon,
  SchoolDivinationIcon,
  SchoolEnchantmentIcon,
  SchoolEvocationIcon,
  SchoolIllusionIcon,
  SchoolNecromancyIcon,
  SchoolTransmutationIcon,
  SomaticIcon,
  SpellCatalogIcon,
  UndoChangeIcon,
  VerbalIcon,
} from './generated-icons';

export type SvgIcon = ComponentType<SVGProps<SVGSVGElement>>;

export {
  AttackRollIcon,
  CastingTimeIcon,
  CharacterIcon,
  CommitRitualIcon,
  ConcentrationIcon,
  CornerFlourishLeftIcon,
  CornerFlourishRightIcon,
  DamageIcon,
  DiffChangesIcon,
  DiscardPlanIcon,
  DividerOrnateIcon,
  DividerSectionIcon,
  DividerShortIcon,
  DividerSimpleIcon,
  DuplicateWarningIcon,
  DurationIcon,
  HealingIcon,
  LibraryIcon,
  MaterialIcon,
  NoteIntentIcon,
  RangeIcon,
  ReplaceSpellIcon,
  RitualIcon,
  SaveIcon,
  SchoolAbjurationIcon,
  SchoolConjurationIcon,
  SchoolDivinationIcon,
  SchoolEnchantmentIcon,
  SchoolEvocationIcon,
  SchoolIllusionIcon,
  SchoolNecromancyIcon,
  SchoolTransmutationIcon,
  SomaticIcon,
  SpellCatalogIcon,
  UndoChangeIcon,
  VerbalIcon,
};

export type SchoolKey =
  | 'abjuration'
  | 'conjuration'
  | 'divination'
  | 'enchantment'
  | 'evocation'
  | 'illusion'
  | 'necromancy'
  | 'transmutation';

export const SCHOOL_ICON_BY_KEY: Record<SchoolKey, SvgIcon> = {
  abjuration: SchoolAbjurationIcon,
  conjuration: SchoolConjurationIcon,
  divination: SchoolDivinationIcon,
  enchantment: SchoolEnchantmentIcon,
  evocation: SchoolEvocationIcon,
  illusion: SchoolIllusionIcon,
  necromancy: SchoolNecromancyIcon,
  transmutation: SchoolTransmutationIcon,
};

export function normalizeSchoolKey(value: string | null | undefined): SchoolKey | null {
  const key = String(value || '').trim().toLowerCase();
  if (key in SCHOOL_ICON_BY_KEY) return key as SchoolKey;
  return null;
}
