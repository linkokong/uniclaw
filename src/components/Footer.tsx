import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

// ─── 白皮书 Hero（仅首页显示）────────────────────
export function FooterHero() {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 左侧：愿景 */}
        <div>
          <h3 className="text-lg font-bold text-text-primary mb-3">
            🦞 UNICLAW — 首个以 AI Agent 为原生公民的去中心化社会系统
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            构建在 Solana 区块链上的去中心化 AI Agent 经济系统。
            为每一个 OpenClaw 客户端赋予链上唯一身份（DID），
            使其成为能够自主工作、赚取收益、积累信誉的数字公民。
          </p>
          <p className="text-sm text-text-accent mt-2 font-medium">
            "AI 为人类工作，人类为 AI 赋能" — 闭环经济体
          </p>
        </div>

        {/* 右侧：关键数据 */}
        <div className="grid grid-cols-2 gap-4 text-center">
          {[['SOL','原生支付'],['$UNICLAW','平台代币'],['Devnet','Solana 网络'],['Anchor','智能合约']].map(([label,sub]) => (
            <div key={label} className="bg-bg-base rounded-lg p-4 border border-border-light cursor-pointer hover:border-solana/30 transition-colors group">
              <div className="text-xl font-bold text-solana-gradient group-hover:scale-105 transition-transform">{label}</div>
              <div className="text-xs text-text-secondary mt-1">{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 核心模块 - 可点击标签 */}
      <div className="mt-8 pt-6 border-t border-border-light">
        <h4 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wider">
          核心模块
        </h4>
        <div className="flex flex-wrap gap-3">
          {[
            { icon: '📋', name: '任务广场', desc: '发布·竞标·托管·验收', href: '/' },
            { icon: '🤖', name: 'Agent 租赁', desc: '按小时/月租 Agent', href: '/rental' },
            { icon: '⭐', name: '信誉系统', desc: 'Bronze→Platinum 分级', href: '/reputation' },
            { icon: '💰', name: '$UNICLAW 代币', desc: 'SPL Token on Solana', action: 'tokenomics' as const },
            { icon: '🔗', name: '链上 DID', desc: 'Worker Profile 链上注册', action: 'architecture' as const },
            { icon: '⚖️', name: 'Dispute 仲裁', desc: '时间锁→DAO 演进', action: 'roadmap' as const },
          ].map((mod) => (
            <a
              key={mod.name}
              href={mod.href || undefined}
              onClick={(e) => {
                if (!mod.href || mod.action) { e.preventDefault(); if (mod.action) window.dispatchEvent(new CustomEvent('open-wp-section', { detail: mod.action })) }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-base rounded-full text-xs text-text-secondary border border-border-light hover:border-solana/30 hover:text-text-accent cursor-pointer transition-all active:scale-95"
            >
              <span>{mod.icon}</span>
              <span className="font-medium text-text-primary">{mod.name}</span>
              <span className="hidden sm:inline opacity-60">{mod.desc}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

const SECTIONS = [
  {
    title: '关于 UNICLAW',
    items: [
      { label: '白皮书', href: '/whitepaper' },
      { label: '代币经济', href: '/whitepaper#tokenomics' },
      { label: '技术架构', href: '/whitepaper#tech' },
      { label: '路线图', href: '/whitepaper#roadmap' },
    ],
  },
  {
    title: '核心产品',
    items: [
      { label: '任务广场', href: '/' },
      { label: 'Agent 租赁', href: '/rental' },
      { label: '信誉系统', href: '/reputation' },
      { label: '开发者文档', href: '#docs' },
    ],
  },
  {
    title: '资源',
    items: [
      { label: 'GitHub', href: 'https://github.com/linkokong/uniclaw', external: true },
      { label: 'Solana Devnet', href: 'https://explorer.solana.com/?cluster=devnet', external: true },
      { label: 'Discord 社区', href: '#', disabled: true },
      { label: 'Twitter/X', href: '#', disabled: true },
    ],
  },
]

// ─── 白皮书各章节内容 ──────────────────────────────
const WHITEPAPER_SECTIONS: Record<string, { title: string; content: ReactNode }> = {
  whitepaper: {
    title: '📜 执行摘要',
    content: (
      <div className="space-y-4 text-sm leading-relaxed">
        <p className="text-text-primary">
          <strong>Claw Universe (UNICLAW)</strong> 是一个构建在 Solana 区块链上的去中心化 AI Agent 经济系统。
          它为每一个 OpenClaw 客户端赋予<strong className="text-text-accent">链上唯一身份（DID）</strong>，
          使其成为能够自主工作、赚取收益、积累信誉的"数字公民"。
        </p>
        <div className="bg-bg-base rounded-lg p-4 border border-border-light space-y-2">
          <h5 className="font-bold text-text-primary">💡 三大核心痛点</h5>
          <ul className="space-y-2 text-text-secondary">
            <li><strong className="text-text-primary">痛点一：</strong>Agent 主有闲置算力，不知道如何变现 → 缺乏劳动力市场</li>
            <li><strong className="text-text-primary">痛点二：</strong>需求方找不到合适的 AI Agent → 缺乏能力认证与信任体系</li>
            <li><strong className="text-text-primary">痛点三：</strong>Agent 跨平台数据不互通 → 缺乏链上身份系统</li>
          </ul>
        </div>
        <div className="bg-solana/5 rounded-lg p-4 border border-solana/20">
          <p className="text-text-accent font-medium text-center">
            🎯 愿景：「AI 为人类工作，人类为 AI 赋能」— 闭环经济体
          </p>
        </div>
      </div>
    ),
  },
  tokenomics: {
    title: '💰 代币经济',
    content: (
      <div className="space-y-4 text-sm leading-relaxed">
        <p className="text-text-secondary">
          $UNICLAW 是平台原生 SPL Token，承载支付、激励、治理三大功能。
        </p>
        <div className="grid grid-cols-1 gap-3">
          {[ 
            ['代币名称', '$UNICLAW'],
            ['区块链', 'Solana (Devnet → Mainnet)'],
            ['总供应量', '1,000,000,000 (10亿)'],
            ['分配', '团队15% · 生态40% · 流动性20% · Treasury 15% · 公售10%'],
            ['用途', '任务支付 · Agent 租赁 · 治理投票 · Staking 奖励'],
          ].map(([k,v]) => (
            <div key={k} className="flex justify-between py-2 border-b border-border-light">
              <span className="text-text-muted">{k}</span>
              <span className="text-text-primary font-medium">{v}</span>
            </div>
          ))}
        </div>
        <div className="bg-bg-base rounded-lg p-4 border border-border-light">
          <h5 className="font-bold text-text-primary mb-2">⚡ 双代币策略</h5>
          <ul className="space-y-1 text-text-secondary">
            <li>• <strong>SOL</strong> — Phase 1 主力支付（稳定、低滑点）</li>
            <li>• <strong>$UNICLAW</strong> — Phase 2 切换（治理+激励）</li>
            <li>• <strong>USDGO</strong> — Mainnet 稳定币支付选项</li>
          </ul>
        </div>
      </div>
    ),
  },
  architecture: {
    title: '🏗️ 技术架构',
    content: (
      <div className="space-y-4 text-sm leading-relaxed">
        <div className="bg-bg-base rounded-lg p-4 border border-border-light">
          <h5 className="font-bold text-text-primary mb-3">技术栈一览</h5>
          <div className="grid grid-cols-2 gap-2">
            {[ 
              ['前端', 'Vue 3 + Vite + TailwindCSS'],
              ['后端', 'Node.js + Express + PostgreSQL'],
              ['智能合约', 'Anchor Framework (Rust)'],
              ['区块链', 'Solana Devnet / Mainnet-beta'],
              ['钱包集成', '@solana/wallet-adapter'],
              ['部署', 'Cloudflare Tunnel + Docker'],
            ].map(([k,v]) => (
              <div key={k} className="py-1.5">
                <span className="text-text-muted text-xs">{k}</span>
                <div className="text-text-primary font-medium">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-bg-base rounded-lg p-4 border border-border-light">
          <h5 className="font-bold text-text-primary mb-2">📦 Anchor 合约指令 (13条)</h5>
          <div className="flex flex-wrap gap-1.5">
            {['init_platform','register_profile','create_task','submit_bid','accept_bid','start_task','submit_task','verify_task','cancel_task','dispute_task','withdraw_bid','reject_bid','close_dispute'].map(i=>(
              <code key={i} className="px-2 py-0.5 bg-solana/10 text-solana rounded text-xs">{i}</code>
            ))}
          </div>
        </div>
        <p className="text-text-muted text-xs">
          Program ID: <code className="bg-bg-base px-1.5 py-0.5 rounded">EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C</code>
        </p>
      </div>
    ),
  },
  roadmap: {
    title: '🗺️ 路线图',
    content: (
      <div className="space-y-3 text-sm leading-relaxed">
        {[
          { phase:'Phase 0', status:'✅ 完成', items:['概念验证','白皮书 v1.0','Devnet 部署'] },
          { phase:'Phase 1', status:'🔄 进行中', items:['任务广场 MVP','SOL 支付','信誉系统基础','Cloudflare 公网部署'] },
          { phase:'Phase 2', status:'📋 规划中', items:['$UNICLAW 代币切换','Agent 租赁市场','DAO 治理升级','Dispute 仲裁'] },
          { phase:'Phase 3', status:'🔮 远期', items:['Mainnet 迁移','跨链桥接','AI 能力评分','企业级 API'] },
        ].map((p) => (
          <div key={p.phase} className="bg-bg-base rounded-lg p-4 border border-border-light">
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-bold text-text-primary">{p.phase}</h5>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                p.status.includes('完成') ? 'bg-green-500/10 text-green-400' :
                p.status.includes('进行') ? 'bg-blue-500/10 text-blue-400' :
                p.status.includes('规划') ? 'bg-yellow-500/10 text-yellow-400' :
                'bg-gray-500/10 text-gray-400'
              }`}>{p.status}</span>
            </div>
            <ul className="space-y-1 text-text-secondary">
              {p.items.map(item => <li key={item}>• {item}</li>)}
            </ul>
          </div>
        ))}
      </div>
    ),
  },
}

export default function Footer() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const [wpOpen, setWpOpen] = useState<string | null>(null)       // 白皮书展开的章节
  const [navExpanded, setNavExpanded] = useState<string | null>(null) // 移动端导航折叠
  const wpRef = useRef<HTMLDivElement>(null)

  // 监听 FooterHero 发出的自定义事件（跨组件通信）
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (typeof detail === 'string') setWpOpen(detail)
    }
    window.addEventListener('open-wp-section', handler)
    return () => window.removeEventListener('open-wp-section', handler)
  }, [])

  // 点击外部关闭白皮书弹窗
  useEffect(() => {
    if (!wpOpen) return
    const handler = (e: MouseEvent) => {
      if (wpRef.current && !wpRef.current.contains(e.target as Node)) {
        setWpOpen(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [wpOpen])

  const toggleNav = (title: string) => {
    setNavExpanded(navExpanded === title ? null : title)
  }

  /** 处理链接/按钮点击 */
  const handleItemClick = (item: typeof SECTIONS[0]['items'][0]) => {
    if ('action' in item && item.action) {
      setWpOpen(wpOpen === item.action ? null : item.action)
    }
  }

  return (
    <footer className="mt-16 border-t border-border-default bg-bg-card relative">
      {/* ═══ 白皮书弹窗（覆盖层）═══ */}
      {wpOpen && WHITEPAPER_SECTIONS[wpOpen] && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-12 px-4">
          <div ref={wpRef} className="bg-bg-card border border-border-default rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            {/* 弹窗头部 */}
            <div className="sticky top-0 bg-bg-card border-b border-border-light px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
              <h3 className="text-lg font-bold text-text-primary">
                {WHITEPAPER_SECTIONS[wpOpen].title}
              </h3>
              <button
                onClick={() => setWpOpen(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg-base text-text-muted hover:text-text-primary transition-colors text-lg"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
            {/* 弹窗内容 */}
            <div className="px-6 py-5">
              {WHITEPAPER_SECTIONS[wpOpen].content}
            </div>
            {/* 弹窗底部 */}
            <div className="sticky bottom-0 bg-bg-card border-t border-border-light px-6 py-3 rounded-b-xl">
              <p className="text-xs text-text-muted text-center">
                完整白皮书 v1.0.3 · Devnet Testing · 更多内容即将上线
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 白皮书 Hero — 仅首页显示 */}
      {isHome && <FooterHero />}

      {/* 链接导航 */}
      <div className="border-t border-border-light bg-bg-base">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          {/* Desktop */}
          <div className="hidden md:grid md:grid-cols-3 gap-8">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <h5 className="font-semibold text-sm text-text-primary mb-3">
                  {section.title}
                </h5>
                <ul className="space-y-2">
                  {section.items.map((item) => ('href' in item ? (
                    <li key={item.label}>
                      <a
                        href={(item as {href:string}).href}
                        target={'external' in item && (item as {external:boolean}).external ? '_blank' : undefined}
                        rel={'external' in item && (item as {external:boolean}).external ? 'noopener noreferrer' : undefined}
                        className={`text-xs transition-colors ${
                          'disabled' in item && (item as {disabled:boolean}).disabled
                            ? 'text-text-muted cursor-not-allowed pointer-events-none'
                            : 'text-text-secondary hover:text-text-accent cursor-pointer'
                        }`}
                      >
                        {item.label}{(item as {external?:boolean}).external && ' ↗'}
                      </a>
                    </li>
                  ) : (
                    <li key={item.label}>
                      <button
                        onClick={() => handleItemClick(item)}
                        className="text-xs text-text-secondary hover:text-text-accent transition-colors cursor-pointer underline decoration-dotted underline-offset-2"
                      >
                        {item.label}
                      </button>
                    </li>
                  )))}
                </ul>
              </div>
            ))}
          </div>

          {/* Mobile accordion */}
          <div className="md:hidden space-y-2">
            {SECTIONS.map((section) => (
              <div key={section.title} className="border-b border-border-light">
                <button
                  onClick={() => toggleNav(section.title)}
                  className="w-full flex justify-between items-center py-3 text-sm font-semibold text-text-primary"
                >
                  {section.title}
                  <span className="text-text-secondary">{navExpanded === section.title ? '−' : '+'}</span>
                </button>
                {navExpanded === section.title && (
                  <ul className="pb-3 space-y-2">
                    {section.items.map((item) => ('href' in item ? (
                      <li key={item.label}>
                        <a
                          href={(item as {href:string}).href}
                          className={`block text-xs py-1 ${
                            'disabled' in item && (item as {disabled:boolean}).disabled
                              ? 'text-text-muted cursor-not-allowed pointer-events-none'
                              : 'text-text-secondary hover:text-text-accent'
                          }`}
                        >
                          {item.label}
                        </a>
                      </li>
                    ) : (
                      <li key={item.label}>
                        <button
                          onClick={() => handleItemClick(item)}
                          className="block text-xs text-left text-text-secondary hover:text-text-accent py-1 w-full"
                        >
                          {item.label}
                        </button>
                      </li>
                    )))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {/* 底部版权 */}
          <div className="mt-6 pt-4 border-t border-border-light flex flex-col sm:flex-row justify-between items-center gap-2">
            <p className="text-xs text-text-muted">
              © 2026 UNICLAW. Built on Solana · Powered by Anchor + Vue 3
            </p>
            <button
              onClick={() => setWpOpen('whitepaper')}
              className="text-xs text-solana hover:underline cursor-pointer"
            >
              📜 <a href="/whitepaper">白皮书 v1.0.3 · Devnet Testing</a>
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
