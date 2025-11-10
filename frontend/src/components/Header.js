import React from 'react';
// import logo from '../logo.png';

const Header = () => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          {/* <img src={logo} alt="KlassiJS Logo" className="logo-icon" /> */}
          <span>QA CHOMP!!!</span>
          <img src="/chompOnData.png" alt="Chomp Icon" className="chomp-icon chomp-icon-left" />
        </div>
        <div className="flex items-center gap-2">
          <img src="/chompOnDigitalData.png" alt="Chomp Icon" className="chomp-icon chomp-icon-right" />
          <span className="header-subtitle">
            KlassiJS AI-Powered Test Case Generator
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header; 