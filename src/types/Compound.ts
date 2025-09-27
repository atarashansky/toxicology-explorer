export interface Compound {
  // Basic identifiers
  id: number;
  name: string;
  smiles?: string;
  inchi?: string;
  
  // Molecular descriptors (metadata we want to display)
  mw?: number;
  logp?: number;
  logd?: number;
  tpsa?: number;
  hbd?: number;
  hba?: number;
  fcsp3?: number;
  qed_value?: number;
  sas_score?: number;
  
  // Other data fields (not displayed in metadata but available)
  doses?: string;
  split?: string;
  failure?: string;
  
  // Prediction data
  bioactivity_mean_preds?: string;
  bioactivity_std_preds?: string;
  bioactivity_lower_bound?: string;
  bioactivity_upper_bound?: string;
  bioactivity_popt?: string;
  
  cell_count_mean_preds?: string;
  cell_count_std_preds?: string;
  cell_count_lower_bound?: string;
  cell_count_upper_bound?: string;
  cell_count_popt?: string;
  
  cyto_area_mean_preds?: string;
  cyto_area_std_preds?: string;
  cyto_area_lower_bound?: string;
  cyto_area_upper_bound?: string;
  cyto_area_popt?: string;
  
  ldh_mean_preds?: string;
  ldh_std_preds?: string;
  ldh_lower_bound?: string;
  ldh_upper_bound?: string;
  ldh_popt?: string;
  
  mito_puncta_mean_preds?: string;
  mito_puncta_std_preds?: string;
  mito_puncta_lower_bound?: string;
  mito_puncta_upper_bound?: string;
  mito_puncta_popt?: string;
  
  mtt_mean_preds?: string;
  mtt_std_preds?: string;
  mtt_lower_bound?: string;
  mtt_upper_bound?: string;
  mtt_popt?: string;
  
  nuclei_size_mean_preds?: string;
  nuclei_size_std_preds?: string;
  nuclei_size_lower_bound?: string;
  nuclei_size_upper_bound?: string;
  nuclei_size_popt?: string;
  
  ros_mean_preds?: string;
  ros_std_preds?: string;
  ros_lower_bound?: string;
  ros_upper_bound?: string;
  ros_popt?: string;
  
  vacuoles_mean_preds?: string;
  vacuoles_std_preds?: string;
  vacuoles_lower_bound?: string;
  vacuoles_upper_bound?: string;
  vacuoles_popt?: string;
  
  // LD values
  cyto_area_ld20?: number;
  cyto_area_ld50?: number;
  cyto_area_ld80?: number;
  cell_count_ld20?: number;
  cell_count_ld50?: number;
  cell_count_ld80?: number;
  nuclei_size_ld20?: number;
  nuclei_size_ld50?: number;
  nuclei_size_ld80?: number;
  vacuoles_ld20?: number;
  vacuoles_ld50?: number;
  vacuoles_ld80?: number;
  mito_puncta_ld20?: number;
  mito_puncta_ld50?: number;
  mito_puncta_ld80?: number;
  bioactivity_ld20?: number;
  bioactivity_ld50?: number;
  bioactivity_ld80?: number;
  ros_ld20?: number;
  ros_ld50?: number;
  ros_ld80?: number;
  mtt_ld20?: number;
  mtt_ld50?: number;
  mtt_ld80?: number;
  ldh_ld20?: number;
  ldh_ld50?: number;
  ldh_ld80?: number;
  
  advisory_tests_result?: string;
}

// Metadata that we want to display in the modal
export interface CompoundMetadata {
  id: number;
  name: string;
  smiles?: string;
  inchi?: string;
  mw?: number;
  logp?: number;
  logd?: number;
  tpsa?: number;
  hbd?: number;
  hba?: number;
  fcsp3?: number;
  qed_value?: number;
  sas_score?: number;
}