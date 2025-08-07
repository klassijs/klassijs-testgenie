import React from 'react';
import logo from '../logo.png';

const Header = () => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <img src={logo} alt="KlassiJS Logo" className="logo-icon" />
          <span>KlassiJS QA CHOMP!!!</span>
          <img src="/chomp.jpeg" alt="Chomp Icon" style={{ width: '50px', height: '50px', objectFit: 'contain' }} />
        </div>
        <div className="flex items-center gap-4">
          <img src="/chomp.jpeg" alt="Chomp Icon" style={{ width: '50px', height: '50px', objectFit: 'contain' }} />
          <span style={{ color: '#4a5568', fontSize: '0.9rem' }}>
            KlassiJS AI-Powered Test Case Generator
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header; 