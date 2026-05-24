import React from 'react'
import { copyright } from '@/data/siteConfig'
import '@/styles/footer.css'

interface FooterProps {
    variant?: 'light' | 'dark'
}

export const Footer: React.FC<FooterProps> = ({ variant = 'light' }) => {
    return (
        <footer className={`app-footer app-footer--${variant}`}>
            <div className="app-footer-content">
                <p className="app-footer-copyright">
                    {copyright}
                </p>
                <p className="app-footer-credit">
                    이 가이드와 스크립트는 Agentic IDE{' '}
                    <a
                        href="https://kiro.dev/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="app-footer-link"
                    >
                        Kiro
                    </a>
                    로 만들어졌습니다.
                </p>
            </div>
        </footer>
    )
}
