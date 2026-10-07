export const LEARNING_METRIC_KEYS = Object.freeze([
  'retrieval_count',
  'helpful_usage',
  'harmful_usage',
  'reuse_success_rate',
  'regression_survival',
  'contradiction_rate',
  'staleness_rate',
  'time_to_validation',
  'time_to_promotion',
  'false_positive_rate',
]);

function ratio(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(6)) : 0;
}

function average(values) {
  const valid = values.filter(value => Number.isFinite(value) && value >= 0);
  return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : 0;
}

export function computeLearningMetrics({
  retrievals = [],
  usage = [],
  memories = [],
  validationDurationsMs = [],
  promotionDurationsMs = [],
} = {}) {
  if (!Array.isArray(retrievals) || !Array.isArray(usage) || !Array.isArray(memories)) {
    throw new Error('learning metrics inputs must be arrays');
  }
  const retrievalCount = retrievals.length;
  const helpful = usage.filter(item => item?.outcome === 'HELPFUL').length;
  const harmful = usage.filter(item => item?.outcome === 'HARMFUL').length;
  const reuseDenominator = helpful + harmful;
  const staleRetrievals = retrievals.filter(item =>
    item?.sha_freshness === 'STALE_EVIDENCE' ||
    (item?.tested_sha !== undefined && item?.tested_sha !== item?.current_sha)
  ).length;
  const reviewed = memories.filter(memory =>
    Number(memory?.independent_confirmations ?? 0) > 0 ||
    Number(memory?.contradiction_count ?? 0) > 0
  ).length;
  const contradicted = memories.filter(memory =>
    Number(memory?.contradiction_count ?? 0) > 0 || memory?.status === 'DISPUTED'
  ).length;
  const promoted = memories.filter(memory => memory?.status === 'PROMOTED').length;
  const promotedWithRegression = memories.filter(
    memory => memory?.status === 'PROMOTED' && memory?.regression_evidence === true,
  ).length;
  const promotedUsages = usage.filter(item => item?.memory_status === 'PROMOTED').length;
  const harmfulPromotedUsages = usage.filter(
    item => item?.memory_status === 'PROMOTED' && item?.outcome === 'HARMFUL',
  ).length;

  return {
    retrieval_count: retrievalCount,
    helpful_usage: helpful,
    harmful_usage: harmful,
    reuse_success_rate: ratio(helpful, reuseDenominator),
    regression_survival: ratio(promotedWithRegression, promoted),
    contradiction_rate: ratio(contradicted, reviewed),
    staleness_rate: ratio(staleRetrievals, retrievalCount),
    time_to_validation: average(validationDurationsMs),
    time_to_promotion: average(promotionDurationsMs),
    false_positive_rate: ratio(harmfulPromotedUsages, promotedUsages),
  };
}

export function validateLearningMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object') throw new Error('metrics object required');
  for (const key of LEARNING_METRIC_KEYS) if (!(key in metrics)) throw new Error('metric missing: ' + key);
  for (const key of ['reuse_success_rate','regression_survival','contradiction_rate','staleness_rate','false_positive_rate']) {
    if (!Number.isFinite(metrics[key]) || metrics[key] < 0 || metrics[key] > 1) throw new Error('metric out of range: ' + key);
  }
  for (const key of ['retrieval_count','helpful_usage','harmful_usage','time_to_validation','time_to_promotion']) {
    if (!Number.isFinite(metrics[key]) || metrics[key] < 0) throw new Error('metric invalid: ' + key);
  }
  return true;
}
