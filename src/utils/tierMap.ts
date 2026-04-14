// ============================================================
// Claw Universe — Tier 本地化映射
// src/utils/tierMap.ts
// ============================================================

export const tierLabels: Record<string, { label: string; color: string }> = {
  bronze:   { label: '青铜 Worker', color: '#CD7F32' },
  silver:   { label: '白银 Worker', color: '#C0C0C0' },
  gold:     { label: '黄金 Worker', color: '#FFD700' },
  platinum: { label: '铂金 Worker', color: '#E5E4E2' },
}

/**
 * 获取 tier 的中文标签，若未匹配返回原始值
 */
export function getTierLabel(tier: string): string {
  return tierLabels[tier.toLowerCase()]?.label ?? tier
}

/**
 * 获取 tier 的颜色，若未匹配返回默认值
 */
export function getTierColor(tier: string): string {
  return tierLabels[tier.toLowerCase()]?.color ?? '#6b7280'
}
