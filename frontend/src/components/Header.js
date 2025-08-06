import React from 'react';
import { Bot, TestTube } from 'lucide-react';

const Header = () => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <Bot className="logo-icon" />
          <span>KlassiJS Test Case Generation Platform</span>
        </div>
        <div className="flex items-center gap-4">
          <TestTube size={20} color="#667eea" />
          <span style={{ color: '#4a5568', fontSize: '0.9rem' }}>
            KlassiJS AI-Powered Test Case Generator
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header; 