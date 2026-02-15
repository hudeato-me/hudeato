import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')(  {
  component: LandingPage,
})

function LandingPage() {
  return (
    <div>
      {/* Header */}
      <header className="lp-header">
        <div className="lp-logo">Hudeato</div>
        <Link to="/login" className="lp-login-btn">
          ログイン
        </Link>
      </header>

      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-hero-badge">✨ AI-Powered Vocabulary Learning</div>
        <h1>
          英語学習を
          <br />
          もっと<span className="gradient-text">スマート</span>に
        </h1>
        <p>
          Hudeatoは、AIがあなたの学習パターンを分析し、
          最適なタイミングで復習を提案。効率的に英単語をマスターできます。
        </p>
        <div className="lp-cta-group">
          <Link to="/login" className="lp-cta-primary">
            無料ではじめる
          </Link>
          <a href="#features" className="lp-cta-secondary">
            機能を見る
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="lp-features" id="features">
        <h2 className="lp-features-title">なぜHudeatoなのか</h2>
        <p className="lp-features-subtitle">
          学習を加速させる3つの特徴
        </p>
        <div className="lp-features-grid">
          <div className="lp-feature-card">
            <div
              className="lp-feature-icon"
              style={{ background: 'rgba(108, 99, 255, 0.1)' }}
            >
              🧠
            </div>
            <h3>AIパーソナライズ</h3>
            <p>
              学習履歴をAIが分析し、あなただけの最適な学習プランを自動生成します。
            </p>
          </div>
          <div className="lp-feature-card">
            <div
              className="lp-feature-icon"
              style={{ background: 'rgba(255, 107, 157, 0.1)' }}
            >
              📊
            </div>
            <h3>詳細なアナリティクス</h3>
            <p>
              学習の進捗をリアルタイムで可視化。モチベーションの維持に役立ちます。
            </p>
          </div>
          <div className="lp-feature-card">
            <div
              className="lp-feature-icon"
              style={{ background: 'rgba(16, 185, 129, 0.1)' }}
            >
              ⚡
            </div>
            <h3>スペースドリピティション</h3>
            <p>
              科学的に証明された間隔反復法で、 長期記憶への定着率を最大化します。
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer">© 2026 Hudeato. All rights reserved.</footer>
    </div>
  )
}
