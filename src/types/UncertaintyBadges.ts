export type UncertaintyBadgeLevel = "LOW" | "MEDIUM" | "HIGH";

export interface EndpointUncertaintyBadge {
  cv_median: number;
  ci_width_median: number;
  relative_dynamic_range: number;
  extrapolated_ld_count: number;
  badge: UncertaintyBadgeLevel;
}

export type CompoundUncertaintyBadges = Partial<Record<string, EndpointUncertaintyBadge>>;

export type UncertaintyBadgesMap = Record<string, CompoundUncertaintyBadges>;
