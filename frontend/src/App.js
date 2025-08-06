import React from 'react';
import './App.css';
import TestGenerator from './components/TestGenerator';
import Header from './components/Header';

function App() {
  return (
    <div className="App">
      <Header />
      <main className="main-content">
        <TestGenerator />
      </main>
    </div>
  );
}

export default App;
