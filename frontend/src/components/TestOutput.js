import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

const TestOutput = ({ content }) => {
  // Custom syntax highlighting for Gherkin
  const customStyle = {
    ...tomorrow,
    'code[class*="language-"]': {
      ...tomorrow['code[class*="language-"]'],
      fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
      fontSize: '0.9rem',
      lineHeight: '1.6',
      padding: '1.5rem',
      borderRadius: '8px',
      backgroundColor: '#1a202c',
      color: '#e2e8f0',
    },
    '.token.keyword': {
      color: '#81c784',
      fontWeight: 'bold',
    },
    '.token.feature': {
      color: '#64b5f6',
      fontWeight: 'bold',
    },
    '.token.scenario': {
      color: '#ffb74d',
      fontWeight: 'bold',
    },
    '.token.given': {
      color: '#81c784',
      fontWeight: 'bold',
    },
    '.token.when': {
      color: '#64b5f6',
      fontWeight: 'bold',
    },
    '.token.then': {
      color: '#ffb74d',
      fontWeight: 'bold',
    },
    '.token.and': {
      color: '#81c784',
      fontWeight: 'bold',
    },
    '.token.but': {
      color: '#e57373',
      fontWeight: 'bold',
    },
    '.token.string': {
      color: '#fbbf24',
    },
    '.token.comment': {
      color: '#9ca3af',
      fontStyle: 'italic',
    },
  };

  return (
    <div className="test-output-container">
      <div className="test-output-content">
        <SyntaxHighlighter
          language="gherkin"
          style={customStyle}
          customStyle={{
            margin: 0,
            borderRadius: '8px',
            fontSize: '0.9rem',
            lineHeight: '1.6',
            maxHeight: '600px',
            overflow: 'auto',
          }}
          showLineNumbers={true}
          wrapLines={true}
          lineNumberStyle={{
            color: '#718096',
            fontSize: '0.8rem',
            paddingRight: '1rem',
          }}
          codeTagProps={{
            style: {
              fontSize: '0.9rem',
              lineHeight: '1.6',
            }
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
      
      <div className="test-output-footer">
        <p className="test-output-info">
          💡 <strong>Tip:</strong> You can copy these tests to your clipboard or download them as a .feature file
        </p>
      </div>
    </div>
  );
};

export default TestOutput; 
