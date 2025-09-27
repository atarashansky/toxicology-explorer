export type DescriptorKey =
  | "mw"
  | "logp"
  | "logd"
  | "tpsa"
  | "hbd"
  | "hba"
  | "fcsp3"
  | "qed_value"
  | "sas_score";

export interface DescriptorStats {
  min: number;
  mean: number;
  max: number;
  count: number;
}

export type MetadataStats = Partial<Record<DescriptorKey, DescriptorStats>>;
