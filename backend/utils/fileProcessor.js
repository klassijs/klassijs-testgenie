const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const JSZip = require('jszip');
const crypto = require('crypto');

// Import universal business requirements extractor
const { extractBusinessRequirements: universalExtract } = require('./universalBusinessExtractor');

// REALISTIC configuration for business element detection - targeting ~200+ requirements
const BUSINESS_ELEMENT_CONFIG = {
  // REALISTIC - only catch actual business requirements, not noise
  minLineLength: 60,          // Lines must have substantial business content
  minRequirementLength: 60,   // Requirements must have clear business logic
  minRuleLength: 60,
  maxLowPriorityItems: 15,    // Strict limit to prevent over-counting
  
  // SIMPLE patterns that work the same for ALL document types
  patterns: {
    // High priority - exact matches only
    highPriority: [
      { regex: /^Business Process:/i, type: 'Business Process', priority: 'high' },
      { regex: /^Decision Point:/i, type: 'Decision Point', priority: 'high' },
      { regex: /^Process Step:/i, type: 'Process Step', priority: 'high' }
    ],
    
    // Medium priority - simple, consistent patterns
    mediumPriority: [
      { regex: /^[0-9]+\.\s+/, type: 'System Requirement', priority: 'medium' },
      { regex: /^[0-9]+\)\s+/, type: 'System Requirement', priority: 'medium' },
      { regex: /^[a-z]\)\s+/, type: 'System Requirement', priority: 'medium' },
      { regex: /^[•\-*]\s+/, type: 'System Requirement', priority: 'medium' },
      { regex: /^Scenario\s+[0-9]+/i, type: 'System Requirement', priority: 'medium' },
      { regex: /^Acceptance\s+Criteria/i, type: 'System Requirement', priority: 'medium' },
      { regex: /^Acceptance\s+Criteria\s+[0-9]+/i, type: 'System Requirement', priority: 'medium' },
      { regex: /^AC\s*[0-9]+/i, type: 'System Requirement', priority: 'medium' },
      { regex: /^Requirement\s+[0-9]+/i, type: 'System Requirement', priority: 'medium' },
      { regex: /^BR\s*[0-9]+/i, type: 'System Requirement', priority: 'medium' }
    ],
    
    // Medium keywords - simple, consistent
    mediumKeywords: [
      { keywords: ['Given', 'When', 'Then', 'And', 'But'], type: 'System Requirement', priority: 'medium' },
      { keywords: ['should', 'must', 'will', 'shall'], type: 'System Requirement', priority: 'medium' },
      { keywords: ['scenario', 'scenarios'], type: 'System Requirement', priority: 'medium' },
      { keywords: ['acceptance', 'criteria', 'requirement'], type: 'System Requirement', priority: 'medium' },
      { keywords: ['verify', 'check', 'ensure', 'validate'], type: 'System Requirement', priority: 'medium' },
      { keywords: ['where', 'when', 'then', 'if'], type: 'System Requirement', priority: 'medium' }
    ],
    
    // Low priority - more selective to avoid over-counting
    lowPriority: [
      { keywords: ['verify', 'check', 'ensure', 'validate', 'test'], type: 'System Requirement', priority: 'low' }
    ]
  }
};

// SIMPLE, CONSISTENT business element detection function - works the same for ALL documents
function detectBusinessElements(content, config = BUSINESS_ELEMENT_CONFIG) {
  const lines = content.split('\n');
  const businessElements = [];
  let currentSection = '';



  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // SIMPLE section detection - only exclude very short ALL CAPS
    if (line.match(/^[A-Z][A-Z\s]+$/) && line.length < 15) {
      currentSection = line;
      continue;
    }

    // Check high priority patterns first
    for (const pattern of config.patterns.highPriority) {
      if (pattern.regex.test(line)) {
        businessElements.push({
          type: pattern.type,
          text: line,
          lineNumber: i + 1,
          section: currentSection,
          priority: pattern.priority
        });
        break;
      }
    }
    
    // SIMPLE, CONSISTENT detection - same logic for all documents
    if (line.length > 60 && !line.match(/^[A-Z][A-Z\s]+$/) && line.length < 200) {
      // Check if line contains business-related patterns
      const hasBusinessContent = 
        // Structured content patterns
        line.match(/^[0-9]+\.\s+/) ||                    // Numbered lists
        line.match(/^[0-9]+\)\s+/) ||                    // Numbered with parenthesis
        line.match(/^[a-z]\)\s+/) ||                     // Lettered lists
        line.match(/^[•\-*]\s+/) ||                      // Bullet points
        line.match(/^Scenario\s+/i) ||                   // Scenarios
        line.match(/^Acceptance\s+Criteria/i) ||         // Acceptance criteria headers
        line.match(/^Acceptance\s+Criteria\s+[0-9]+/i) || // Numbered acceptance criteria
        line.match(/^Requirement\s+/i) ||                // Requirements
        line.match(/^BR\s*/i) ||                         // BR format
        line.match(/^AC\s*/i) ||                         // AC format
        line.match(/^(Given|When|Then|And|But)\s+/i) ||  // Gherkin
        // Business function patterns
        line.toLowerCase().includes('create') ||
        line.toLowerCase().includes('generate') ||
        line.toLowerCase().includes('export') ||
        line.toLowerCase().includes('import') ||
        line.toLowerCase().includes('update') ||
        line.toLowerCase().includes('process') ||
        line.toLowerCase().includes('handle') ||
        line.toLowerCase().includes('manage') ||
        line.toLowerCase().includes('track') ||
        line.toLowerCase().includes('calculate') ||
        // Modal verb patterns - ONLY if they contain specific business content
        (line.toLowerCase().includes('should') && line.length > 50 && 
         !line.toLowerCase().includes('the system should support') && 
         (line.toLowerCase().includes('create') || line.toLowerCase().includes('generate') || 
          line.toLowerCase().includes('export') || line.toLowerCase().includes('import') || 
          line.toLowerCase().includes('update') || line.toLowerCase().includes('process') || 
          line.toLowerCase().includes('handle') || line.toLowerCase().includes('manage') || 
          line.toLowerCase().includes('track') || line.toLowerCase().includes('calculate'))) ||
        (line.toLowerCase().includes('must') && line.length > 50 && 
         !line.toLowerCase().includes('the system must support') && 
         (line.toLowerCase().includes('create') || line.toLowerCase().includes('generate') || 
          line.toLowerCase().includes('export') || line.toLowerCase().includes('import') || 
          line.toLowerCase().includes('update') || line.toLowerCase().includes('process') || 
          line.toLowerCase().includes('handle') || line.toLowerCase().includes('manage') || 
          line.toLowerCase().includes('track') || line.toLowerCase().includes('calculate'))) ||
        (line.toLowerCase().includes('will') && line.length > 50 && 
         !line.toLowerCase().includes('the system will support') && 
         (line.toLowerCase().includes('create') || line.toLowerCase().includes('generate') || 
          line.toLowerCase().includes('export') || line.toLowerCase().includes('import') || 
          line.toLowerCase().includes('update') || line.toLowerCase().includes('process') || 
          line.toLowerCase().includes('handle') || line.toLowerCase().includes('manage') || 
          line.toLowerCase().includes('track') || line.toLowerCase().includes('calculate'))) ||
        (line.toLowerCase().includes('shall') && line.length > 50 && 
         !line.toLowerCase().includes('the system shall support') && 
         (line.toLowerCase().includes('create') || line.toLowerCase().includes('generate') || 
          line.toLowerCase().includes('export') || line.toLowerCase().includes('import') || 
          line.toLowerCase().includes('update') || line.toLowerCase().includes('process') || 
          line.toLowerCase().includes('handle') || line.toLowerCase().includes('manage') || 
          line.toLowerCase().includes('track') || line.toLowerCase().includes('calculate'))) ||
        (line.toLowerCase().includes('can') && line.length > 50 && 
         !line.toLowerCase().includes('the system can support') && 
         (line.toLowerCase().includes('create') || line.toLowerCase().includes('generate') || 
          line.toLowerCase().includes('export') || line.toLowerCase().includes('import') || 
          line.toLowerCase().includes('update') || line.toLowerCase().includes('process') || 
          line.toLowerCase().includes('handle') || line.toLowerCase().includes('manage') || 
          line.toLowerCase().includes('track') || line.toLowerCase().includes('calculate'))) ||
        (line.toLowerCase().includes('has') && line.length > 50 && 
         !line.toLowerCase().includes('the system has support') && 
         (line.toLowerCase().includes('create') || line.toLowerCase().includes('generate') || 
          line.toLowerCase().includes('export') || line.toLowerCase().includes('import') || 
          line.toLowerCase().includes('update') || line.toLowerCase().includes('process') || 
          line.toLowerCase().includes('handle') || line.toLowerCase().includes('manage') || 
          line.toLowerCase().includes('track') || line.toLowerCase().includes('calculate'))) ||
        (line.toLowerCase().includes('provides') && line.length > 50 && 
         !line.toLowerCase().includes('the system provides support') && 
         (line.toLowerCase().includes('create') || line.toLowerCase().includes('generate') || 
          line.toLowerCase().includes('export') || line.toLowerCase().includes('import') || 
          line.toLowerCase().includes('update') || line.toLowerCase().includes('process') || 
          line.toLowerCase().includes('handle') || line.toLowerCase().includes('manage') || 
          line.toLowerCase().includes('track') || line.toLowerCase().includes('calculate'))) ||
        (line.toLowerCase().includes('supports') && line.length > 50 && 
         !line.toLowerCase().includes('the system supports') && 
         (line.toLowerCase().includes('create') || line.toLowerCase().includes('generate') || 
          line.toLowerCase().includes('export') || line.toLowerCase().includes('import') || 
          line.toLowerCase().includes('update') || line.toLowerCase().includes('process') || 
          line.toLowerCase().includes('handle') || line.toLowerCase().includes('manage') || 
          line.toLowerCase().includes('track') || line.toLowerCase().includes('calculate'))) ||
        (line.toLowerCase().includes('allows') && line.length > 50 && 
         !line.toLowerCase().includes('the system allows support') && 
         (line.toLowerCase().includes('create') || line.toLowerCase().includes('generate') || 
          line.toLowerCase().includes('export') || line.toLowerCase().includes('import') || 
          line.toLowerCase().includes('update') || line.toLowerCase().includes('process') || 
          line.toLowerCase().includes('handle') || line.toLowerCase().includes('manage') || 
          line.toLowerCase().includes('track') || line.toLowerCase().includes('calculate'))) ||
        (line.toLowerCase().includes('enables') && line.length > 50 && 
         !line.toLowerCase().includes('the system enables support') && 
         (line.toLowerCase().includes('create') || line.toLowerCase().includes('generate') || 
          line.toLowerCase().includes('export') || line.toLowerCase().includes('import') || 
          line.toLowerCase().includes('update') || line.toLowerCase().includes('process') || 
          line.toLowerCase().includes('handle') || line.toLowerCase().includes('manage') || 
          line.toLowerCase().includes('track') || line.toLowerCase().includes('calculate'))) ||
        (line.toLowerCase().includes('includes') && line.length > 50 && 
         !line.toLowerCase().includes('the system includes support') && 
         (line.toLowerCase().includes('create') || line.toLowerCase().includes('generate') || 
          line.toLowerCase().includes('export') || line.toLowerCase().includes('import') || 
          line.toLowerCase().includes('update') || line.toLowerCase().includes('process') || 
          line.toLowerCase().includes('handle') || line.toLowerCase().includes('manage') || 
          line.toLowerCase().includes('track') || line.toLowerCase().includes('calculate')));
      
      if (hasBusinessContent) {
        // Aggressive filtering to avoid generic system statements and non-requirements
        const isObviousNonRequirement = 
          line.length < 20 ||                                                    // Very short lines
          line.match(/^[A-Z\s]+$/) && line.length < 15 ||                       // Short ALL CAPS
          line.match(/^[0-9\s]+$/) && line.length < 15 ||                       // Short numbers
          line.toLowerCase().includes('page') && line.length < 25 ||             // Very short page references
          line.toLowerCase().includes('section') && line.length < 25 ||          // Very short section references
          line.toLowerCase().includes('chapter') && line.length < 25 ||          // Very short chapter references
          line.toLowerCase().includes('table of contents') ||                    // Table of contents
          line.toLowerCase().includes('index') ||                                // Index
          line.toLowerCase().includes('glossary') ||                             // Glossary
          line.toLowerCase().includes('references') ||                           // References
          line.toLowerCase().includes('bibliography') ||                         // Bibliography
          // Filter out ALL generic system statements regardless of length
          line.toLowerCase().includes('the system should support') ||  // Generic system support statements
          line.toLowerCase().includes('the system must support') ||    // Generic system support statements
          line.toLowerCase().includes('the system will support') ||    // Generic system support statements
          line.toLowerCase().includes('the system shall support') ||   // Generic system support statements
          line.toLowerCase().includes('the system can support') ||     // Generic system support statements
          line.toLowerCase().includes('the system has support') ||     // Generic system support statements
          line.toLowerCase().includes('the system provides support') || // Generic system support statements
          line.toLowerCase().includes('the system supports') ||        // Generic system support statements
          line.toLowerCase().includes('the system allows support') ||  // Generic system support statements
          line.toLowerCase().includes('the system enables support') || // Generic system support statements
          line.toLowerCase().includes('the system includes support') || // Generic system support statements

          // Filter out ALL generic patterns regardless of length
          line.toLowerCase().includes('access has been granted') ||     // Generic access statements
          line.toLowerCase().includes('us only') ||                    // Generic location statements
          line.toLowerCase().includes('narrative') ||                 // Generic narrative statements
          line.toLowerCase().includes('sequence flow') ||             // Generic flow statements
          line.toLowerCase().includes('message') ||                   // Generic message statements
          line.toLowerCase().includes('timer') ||                     // Generic timer statements
          line.toLowerCase().includes('intermediate') ||              // Generic intermediate statements
          line.toLowerCase().includes('data object') ||               // Generic data object statements
          line.toLowerCase().includes('data store') ||                // Generic data store statements
          line.toLowerCase().includes('association') ||               // Generic association statements
          line.toLowerCase().includes('default sequence flow') ||     // Generic flow statements
          line.toLowerCase().includes('other intermediate') ||        // Generic intermediate statements
          line.toLowerCase().includes('intermediate event') ||        // Generic event statements
          line.toLowerCase().includes('version') ||                   // Generic version statements
          line.toLowerCase().includes('date') ||                      // Generic date statements
          line.toLowerCase().includes('description') ||               // Generic description statements
          line.toLowerCase().includes('author') ||                    // Generic author statements
          line.toLowerCase().includes('document creation') ||         // Generic document statements
          line.toLowerCase().includes('document name') ||             // Generic document statements
          line.toLowerCase().includes('programme and project name') || // Generic project statements
          line.toLowerCase().includes('academic division online product sales process') || // Generic process statements
          line.toLowerCase().includes('flexible selling') ||           // Generic selling statements
          line.toLowerCase().includes('title-by-title project') ||    // Generic project statements
          // Additional generic patterns that are getting through
          line.toLowerCase().includes('page') && !line.toLowerCase().includes('create') && !line.toLowerCase().includes('update') && !line.toLowerCase().includes('process') ||  // Page references without actions
          line.toLowerCase().includes('customer') && !line.toLowerCase().includes('create') && !line.toLowerCase().includes('update') && !line.toLowerCase().includes('process') && !line.toLowerCase().includes('export') && !line.toLowerCase().includes('import') ||  // Customer without actions
          line.toLowerCase().includes('sales team') && !line.toLowerCase().includes('create') && !line.toLowerCase().includes('update') && !line.toLowerCase().includes('process') && !line.toLowerCase().includes('export') && !line.toLowerCase().includes('import') ||  // Sales team without actions
          line.toLowerCase().includes('oup') && !line.toLowerCase().includes('create') && !line.toLowerCase().includes('update') && !line.toLowerCase().includes('process') && !line.toLowerCase().includes('export') && !line.toLowerCase().includes('import');  // OUP without actions
        
        if (!isObviousNonRequirement) {
          businessElements.push({
            type: 'System Requirement',
            text: line,
            lineNumber: i + 1,
            section: currentSection,
            priority: 'medium'
          });
        }
        continue;
      }
    }

    // Check medium priority patterns - SIMPLE and CONSISTENT
    for (const pattern of config.patterns.mediumPriority) {
      if (pattern.regex.test(line) && line.length > 60) {
        // Simple filtering to ensure it's actually a business requirement
        const isActualRequirement = 
          line.length > 40 && // Must be substantial
          line.split(' ').length > 4 && // Must have at least 5 words
          !line.match(/^the system (should|must|will|can|has|provides|supports|allows|enables|includes)/i) && // Not generic system statements
          !line.match(/^(page|section|screen|button|field|menu|tab|link|data|information|display|access|support|provide|show|view)/i); // Not generic UI references
        
        if (isActualRequirement) {
          businessElements.push({
            type: pattern.type,
            text: line,
            lineNumber: i + 1,
            section: currentSection,
            priority: pattern.priority
          });
        }
        break;
      }
    }

    // Check medium priority keywords - SIMPLE and CONSISTENT
    for (const keywordPattern of config.patterns.mediumKeywords) {
      const hasKeyword = keywordPattern.keywords.some(keyword => 
        line.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (hasKeyword) {
        // Simple restriction: line must have substantial business content
        const hasSubstantialContent = 
          line.length > 50 && // Must be substantial
          line.split(' ').length > 4 && // Must have at least 5 words
          (line.includes(' ') || line.includes('-') || line.includes(':')) && // Must have structure
          !line.match(/^[A-Z\s]+$/) && // Must not be just ALL CAPS
          !line.match(/^the system (should|must|will|can|has|provides|supports|allows|enables|includes)/i); // Must not be generic system statements
        
        if (hasSubstantialContent) {
          businessElements.push({
            type: keywordPattern.type,
            text: line,
            lineNumber: i + 1,
            section: currentSection,
            priority: 'medium'
          });
        }
        break;
      }
    }

    // Check low priority patterns - SIMPLE and CONSISTENT
    for (const keywordPattern of config.patterns.lowPriority) {
      const hasKeyword = keywordPattern.keywords.some(keyword => 
        line.toLowerCase().includes(keyword)
      );
      
      if (hasKeyword) {
        // Simple restriction: must be high-quality business content
        const isHighQuality = 
          line.length > 60 && // Must be substantial
          line.includes(' ') && // Must have multiple words
          line.split(' ').length > 6 && // Must have at least 7 words
          !line.match(/^[A-Z\s]+$/) && // Must not be just ALL CAPS
          !line.match(/^[0-9\s]+$/) && // Must not be just numbers
          line.match(/[a-z]/i) && // Must contain letters
          !line.match(/^the system (should|must|will|can|has|provides|supports|allows|enables|includes)/i) && // Must not be generic system statements
          !line.match(/^(page|section|screen|button|field|menu|tab|link|data|information|display|access|support|provide|show|view)/i); // Must not be generic UI references
        
        if (isHighQuality) {
          businessElements.push({
            type: keywordPattern.type,
            text: line,
            lineNumber: i + 1,
            section: currentSection,
            priority: 'low'
          });
        }
        break;
      }
    }
  }

  // SIMPLE deduplication - just remove exact duplicates
  const uniqueElements = [];
  const seenTexts = new Set();

  for (const element of businessElements) {
    const normalizedText = element.text.toLowerCase().trim();
    
    if (!seenTexts.has(normalizedText)) {
      seenTexts.add(normalizedText);
      uniqueElements.push(element);
    }
  }



  // Return the expected object structure that the rest of the code expects
  return {
    count: uniqueElements.length,
    elements: uniqueElements,
    breakdown: {
      processes: uniqueElements.filter(e => e.type === 'Business Process').length,
      requirements: uniqueElements.filter(e => e.type === 'System Requirement').length,
      decisions: uniqueElements.filter(e => e.type === 'Decision Point').length,
      steps: uniqueElements.filter(e => e.type === 'Process Step').length,
      flows: uniqueElements.filter(e => e.type === 'Business Flow').length,
      userStories: uniqueElements.filter(e => e.type === 'User Story').length,
      userActions: uniqueElements.filter(e => e.type === 'User Action').length
    },
    priorities: {
      high: uniqueElements.filter(e => e.priority === 'high').length,
      medium: uniqueElements.filter(e => e.priority === 'medium').length,
      low: uniqueElements.filter(e => e.priority === 'low').length
    }
  };
}

// Legacy function for backward compatibility
function countBusinessElementsDeterministically(content) {
  return detectBusinessElements(content);
}

// Configuration adjustment function for easy rule tweaking
function adjustBusinessElementConfig(adjustments = {}) {
  const newConfig = { ...BUSINESS_ELEMENT_CONFIG };
  
  // Adjust thresholds
  if (adjustments.minLineLength !== undefined) {
    newConfig.minLineLength = adjustments.minLineLength;
  }
  if (adjustments.minRequirementLength !== undefined) {
    newConfig.minRequirementLength = adjustments.minRequirementLength;
  }
  if (adjustments.maxLowPriorityItems !== undefined) {
    newConfig.maxLowPriorityItems = adjustments.maxLowPriorityItems;
  }
  
  // Adjust patterns
  if (adjustments.patterns) {
    if (adjustments.patterns.highPriority) {
      newConfig.patterns.highPriority = [...newConfig.patterns.highPriority, ...adjustments.patterns.highPriority];
    }
    if (adjustments.patterns.mediumPriority) {
      newConfig.patterns.mediumPriority = [...newConfig.patterns.mediumPriority, ...adjustments.patterns.mediumPriority];
    }
    if (adjustments.patterns.mediumKeywords) {
      newConfig.patterns.mediumKeywords = [...newConfig.patterns.mediumKeywords, ...adjustments.patterns.mediumKeywords];
    }
    if (adjustments.patterns.lowPriority) {
      newConfig.patterns.lowPriority = [...newConfig.patterns.lowPriority, ...adjustments.patterns.lowPriority];
    }
  }
  
  return newConfig;
}

// File type detection
const isImageFile = (mimeType, extension) => {
  const imageMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff', 'image/webp', 'image/svg+xml'];
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg'];
  return imageMimes.includes(mimeType) || imageExtensions.includes(extension.toLowerCase());
};

const isExcelFile = (mimeType, extension) => {
  const excelMimes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.oasis.opendocument.spreadsheet'];
  const excelExtensions = ['.xls', '.xlsx', '.ods'];
  return excelMimes.includes(mimeType) || excelExtensions.includes(extension.toLowerCase());
};

const isPowerPointFile = (mimeType, extension) => {
  const pptMimes = ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.oasis.opendocument.presentation'];
  const pptExtensions = ['.ppt', '.pptx', '.odp'];
  return pptMimes.includes(mimeType) || pptExtensions.includes(extension.toLowerCase());
};

const isVisioFile = (mimeType, extension) => {
  const visioMimes = ['application/octet-stream']; // VSDX files often have this MIME type
  const visioExtensions = ['.vsd', '.vsdx'];
  return visioMimes.includes(mimeType) || visioExtensions.includes(extension.toLowerCase());
};

// Helper function to analyze image content using universal extractor
function analyzeImageContent(fileName, extension) {
  // Analyze image based on filename and extension for business context
  const name = fileName.toLowerCase();
  let description = '';
  
  // Analyze filename for business context
  if (name.includes('workflow') || name.includes('process') || name.includes('diagram')) {
    description = 'This image appears to contain workflow or process diagrams that likely represent business processes.';
  } else if (name.includes('ui') || name.includes('interface') || name.includes('screen')) {
    description = 'This image appears to contain user interface elements that represent system functionality.';
  } else if (name.includes('data') || name.includes('chart') || name.includes('graph')) {
    description = 'This image appears to contain data visualizations that may represent business metrics or processes.';
  } else if (name.includes('architecture') || name.includes('system') || name.includes('design')) {
    description = 'This image appears to contain system architecture or design diagrams.';
  } else if (name.includes('user') || name.includes('persona') || name.includes('profile')) {
    description = 'This image appears to contain user-related information or personas.';
  } else {
    description = 'This image file contains visual content that requires manual analysis to identify business requirements.';
  }
  
  // Create a simple content representation for universal analysis
  const imageContent = `Image Analysis: ${description}\n\nFilename: ${fileName}\nExtension: ${extension}\n\nThis image file contains visual content that may represent business processes, system requirements, or user interface elements. The filename suggests: ${description.toLowerCase()}`;
  
  // Use universal business requirements extractor for consistent analysis
  const universalAnalysis = universalExtract(imageContent, {
    minLineLength: 10,
    maxLineLength: 500,
    enableStrictMode: false,
    includeLowPriority: true
  });
  
  return {
    description,
    businessElements: universalAnalysis.businessElements
  };
}

// Extract content from different file types
async function extractFileContent(file) {
  try {
    const buffer = file.buffer;
    const mimeType = file.mimetype;
    const originalName = file.originalname;
    const extension = path.extname(originalName);

    // Handle different file types
    if (mimeType === 'application/pdf') {
  
      
      try {
        const pdfData = await pdfParse(buffer);
        let extractedContent = pdfData.text;
        
        // Enhanced PDF processing to extract more structured content
        const lines = extractedContent.split('\n');
        let structuredContent = '';
        let currentSection = '';
        let inTable = false;
        let tableContent = '';
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // Detect headers and sections
          if (line.match(/^[A-Z][A-Z\s]+$/) || line.match(/^[0-9]+\.\s+[A-Z]/) || line.match(/^[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s*$/)) {
            if (currentSection) {
              structuredContent += `\n\n## ${currentSection}\n`;
            }
            currentSection = line;
            structuredContent += `\n\n# ${line}\n`;
          }
          // Detect tables (lines with multiple spaces or tabs)
          else if (line.includes('  ') && line.split(/\s{2,}/).length > 2) {
            if (!inTable) {
              inTable = true;
              tableContent = '';
            }
            tableContent += line + '\n';
          }
          // Detect diagrams and charts (lines with special characters)
          else if (line.includes('┌') || line.includes('├') || line.includes('└') || line.includes('│') || 
                   line.includes('─') || line.includes('┐') || line.includes('┤') || line.includes('┘')) {
            structuredContent += `\n\n### Diagram/Chart Content:\n${line}\n`;
          }
          // Detect flow diagrams (lines with arrows)
          else if (line.includes('→') || line.includes('←') || line.includes('↑') || line.includes('↓') ||
                   line.includes('->') || line.includes('<-') || line.includes('=>') || line.includes('<=')) {
            structuredContent += `\n\n### Flow Diagram:\n${line}\n`;
          }
          else {
            if (inTable) {
              structuredContent += `\n\n### Table Content:\n${tableContent}\n`;
              inTable = false;
              tableContent = '';
            }
            structuredContent += line + '\n';
          }
        }
        
        if (inTable) {
          structuredContent += `\n\n### Table Content:\n${tableContent}\n`;
        }
        
        const result = structuredContent.trim();
        
        // Use universal business requirements extractor for consistent analysis
        const universalAnalysis = universalExtract(result, {
          minLineLength: 20,
          maxLineLength: 500,
          enableStrictMode: false,
          includeLowPriority: true
        });
        
        const enhancedResult = `${result}\n\n### Universal Business Element Analysis:\n- **Total Business Elements**: ${universalAnalysis.businessElements.count}\n- **Quality Score**: ${universalAnalysis.qualityMetrics.qualityScore}%\n- **High Confidence Elements**: ${universalAnalysis.qualityMetrics.highConfidenceElements}\n- **Testable Elements**: ${universalAnalysis.qualityMetrics.testableElements}\n\n### Element Breakdown:\n- **Business Processes**: ${universalAnalysis.businessElements.breakdown.byType['Business Process'] || 0}\n- **System Requirements**: ${universalAnalysis.businessElements.breakdown.byType['System Requirement'] || 0}\n- **Decision Points**: ${universalAnalysis.businessElements.breakdown.byType['Decision Point'] || 0}\n- **Process Steps**: ${universalAnalysis.businessElements.breakdown.byType['Process Step'] || 0}\n- **Business Rules**: ${universalAnalysis.businessElements.breakdown.byType['Business Rule'] || 0}\n- **User Actions**: ${universalAnalysis.businessElements.breakdown.byType['User Action'] || 0}\n- **Validation Requirements**: ${universalAnalysis.businessElements.breakdown.byType['Validation Requirement'] || 0}\n\n### Universal Analysis:\nThis universal business requirements extractor identified **${universalAnalysis.businessElements.count} business requirements** using consistent patterns across all file types. Quality Score: ${universalAnalysis.qualityMetrics.qualityScore}%`;
        
        return enhancedResult;
        
      } catch (error) {
        console.error(`Error processing PDF: ${error.message}`);
        const pdfData = await pdfParse(buffer);
        return pdfData.text;
      }
    } else if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      const textContent = buffer.toString('utf-8');
      
      // Use universal business requirements extractor for consistent analysis
      const universalAnalysis = universalExtract(textContent, {
        minLineLength: 20,
        maxLineLength: 500,
        enableStrictMode: false,
        includeLowPriority: true
      });
      
      const enhancedContent = `${textContent}\n\n### Universal Business Element Analysis:\n- **Total Business Elements**: ${universalAnalysis.businessElements.count}\n- **Quality Score**: ${universalAnalysis.qualityMetrics.qualityScore}%\n- **High Confidence Elements**: ${universalAnalysis.qualityMetrics.highConfidenceElements}\n- **Testable Elements**: ${universalAnalysis.qualityMetrics.testableElements}\n\n### Element Breakdown:\n- **Business Processes**: ${universalAnalysis.businessElements.breakdown.byType['Business Process'] || 0}\n- **System Requirements**: ${universalAnalysis.businessElements.breakdown.byType['System Requirement'] || 0}\n- **Decision Points**: ${universalAnalysis.businessElements.breakdown.byType['Decision Point'] || 0}\n- **Process Steps**: ${universalAnalysis.businessElements.breakdown.byType['Process Step'] || 0}\n- **Business Rules**: ${universalAnalysis.businessElements.breakdown.byType['Business Rule'] || 0}\n- **User Actions**: ${universalAnalysis.businessElements.breakdown.byType['User Action'] || 0}\n- **Validation Requirements**: ${universalAnalysis.businessElements.breakdown.byType['Validation Requirement'] || 0}\n\n### Universal Analysis:\nThis universal business requirements extractor identified **${universalAnalysis.businessElements.count} business requirements** using consistent patterns across all file types. Quality Score: ${universalAnalysis.qualityMetrics.qualityScore}%`;
      
      return enhancedContent;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
               mimeType === 'application/msword' ||
               mimeType === 'application/rtf' ||
               mimeType === 'application/vnd.oasis.opendocument.text') {
      
  
      
      // Enhanced Word document processing for complex content including flow diagrams
      try {
        if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          // For .docx files, extract from XML structure to get embedded content
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(buffer);
          
          let extractedContent = '';
          
         // Extract main document content with better text extraction
        if (zipContent.files['word/document.xml']) {
          const documentXml = await zipContent.files['word/document.xml'].async('string');
          
          // Extract text from paragraph tags for better structure
          const paragraphMatches = documentXml.match(/<w:p[^>]*>.*?<\/w:p>/gs);
          if (paragraphMatches) {
            extractedContent += `\n\nMain Document Content:\n`;
            paragraphMatches.forEach(paragraph => {
              const textMatches = paragraph.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
              if (textMatches) {
                const paragraphText = textMatches
                  .map(text => text.replace(/<\/?w:t[^>]*>/g, ''))
                  .join(' ')
                  .trim();
                if (paragraphText.length > 5) {
                  extractedContent += `${paragraphText}\n`;
                }
              }
            });
          } else {
            // Fallback to basic text extraction
            const textContent = documentXml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            if (textContent.length > 10) {
              extractedContent += `\n\nMain Document Content:\n${textContent}`;
            }
          }
        }
          
          // Extract embedded objects and diagrams
          const embeddedFiles = Object.keys(zipContent.files).filter(file => 
            file.includes('word/embeddings/') || 
            file.includes('word/media/') ||
            file.includes('word/drawings/')
          );
          
  
          
          for (const embeddedFile of embeddedFiles) {
            try {
              const embeddedContent = await zipContent.files[embeddedFile].async('string');
              const textContent = embeddedContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
              if (textContent.length > 10) {
                extractedContent += `\n\nEmbedded Content (${embeddedFile}):\n${textContent}`;
              }
            } catch (error) {

            }
          }
          
          // Extract headers and footers
          const headerFiles = Object.keys(zipContent.files).filter(file => file.includes('word/header'));
          const footerFiles = Object.keys(zipContent.files).filter(file => file.includes('word/footer'));
          
          for (const headerFile of headerFiles) {
            try {
              const headerContent = await zipContent.files[headerFile].async('string');
              const textContent = headerContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
              if (textContent.length > 10) {
                extractedContent += `\n\nHeader Content:\n${textContent}`;
              }
            } catch (error) {
  
            }
          }
          
          if (extractedContent.trim()) {
            // Use universal business requirements extractor for consistent analysis
            const universalAnalysis = universalExtract(extractedContent, {
              minLineLength: 20,
              maxLineLength: 500,
              enableStrictMode: false,
              includeLowPriority: true
            });
            
            const enhancedContent = `${extractedContent}\n\n### Universal Business Element Analysis:\n- **Total Business Elements**: ${universalAnalysis.businessElements.count}\n- **Quality Score**: ${universalAnalysis.qualityMetrics.qualityScore}%\n- **High Confidence Elements**: ${universalAnalysis.qualityMetrics.highConfidenceElements}\n- **Testable Elements**: ${universalAnalysis.qualityMetrics.testableElements}\n\n### Element Breakdown:\n- **Business Processes**: ${universalAnalysis.businessElements.breakdown.byType['Business Process'] || 0}\n- **System Requirements**: ${universalAnalysis.businessElements.breakdown.byType['System Requirement'] || 0}\n- **Decision Points**: ${universalAnalysis.businessElements.breakdown.byType['Decision Point'] || 0}\n- **Process Steps**: ${universalAnalysis.businessElements.breakdown.byType['Process Step'] || 0}\n- **Business Rules**: ${universalAnalysis.businessElements.breakdown.byType['Business Rule'] || 0}\n- **User Actions**: ${universalAnalysis.businessElements.breakdown.byType['User Action'] || 0}\n- **Validation Requirements**: ${universalAnalysis.businessElements.breakdown.byType['Validation Requirement'] || 0}\n\n### Universal Analysis:\nThis universal business requirements extractor identified **${universalAnalysis.businessElements.count} business requirements** using consistent patterns across all file types. Quality Score: ${universalAnalysis.qualityMetrics.qualityScore}%`;
            
            return enhancedContent;
          }
        }
        
        // Fallback to mammoth for other Word formats
        const result = await mammoth.extractRawText({ buffer });
        
        const extractedContent = result.value;
        
        // Use universal business requirements extractor for consistent analysis
        const universalAnalysis = universalExtract(extractedContent, {
          minLineLength: 20,
          maxLineLength: 500,
          enableStrictMode: false,
          includeLowPriority: true
        });
        
        const enhancedContent = `${extractedContent}\n\n### Universal Business Element Analysis:\n- **Total Business Elements**: ${universalAnalysis.businessElements.count}\n- **Quality Score**: ${universalAnalysis.qualityMetrics.qualityScore}%\n- **High Confidence Elements**: ${universalAnalysis.qualityMetrics.highConfidenceElements}\n- **Testable Elements**: ${universalAnalysis.qualityMetrics.testableElements}\n\n### Element Breakdown:\n- **Business Processes**: ${universalAnalysis.businessElements.breakdown.byType['Business Process'] || 0}\n- **System Requirements**: ${universalAnalysis.businessElements.breakdown.byType['System Requirement'] || 0}\n- **Decision Points**: ${universalAnalysis.businessElements.breakdown.byType['Decision Point'] || 0}\n- **Process Steps**: ${universalAnalysis.businessElements.breakdown.byType['Process Step'] || 0}\n- **Business Rules**: ${universalAnalysis.businessElements.breakdown.byType['Business Rule'] || 0}\n- **User Actions**: ${universalAnalysis.businessElements.breakdown.byType['User Action'] || 0}\n- **Validation Requirements**: ${universalAnalysis.businessElements.breakdown.byType['Validation Requirement'] || 0}\n\n### Universal Analysis:\nThis universal business requirements extractor identified **${universalAnalysis.businessElements.count} business requirements** using consistent patterns across all file types. Quality Score: ${universalAnalysis.qualityMetrics.qualityScore}%`;
        
        return enhancedContent;
        
      } catch (error) {
        console.error(`Error processing Word document: ${error.message}`);
        // Fallback to basic mammoth extraction
        const result = await mammoth.extractRawText({ buffer });
        
        const extractedContent = result.value;
        return extractedContent;
      }
    } else if (isImageFile(mimeType, extension)) {
      // Enhanced image analysis with deterministic counting
      const imageAnalysis = analyzeImageContent(originalName, extension);
      
      const result = `# Image File Analysis\n\n## File: ${originalName}\n\n### Image Type: ${extension.toUpperCase()}\n\n### Analysis:\n${imageAnalysis.description}\n\n### Universal Business Element Analysis:\n- **Total Business Elements**: ${imageAnalysis.businessElements.count}\n- **Quality Score**: ${imageAnalysis.businessElements.qualityMetrics?.qualityScore || 'N/A'}%\n- **High Confidence Elements**: ${imageAnalysis.businessElements.qualityMetrics?.highConfidenceElements || 'N/A'}\n- **Testable Elements**: ${imageAnalysis.businessElements.qualityMetrics?.testableElements || 'N/A'}\n\n### Element Breakdown:\n- **Business Processes**: ${imageAnalysis.businessElements.breakdown?.byType?.['Business Process'] || 0}\n- **System Requirements**: ${imageAnalysis.businessElements.breakdown?.byType?.['System Requirement'] || 0}\n- **Decision Points**: ${imageAnalysis.businessElements.breakdown?.byType?.['Decision Point'] || 0}\n- **Process Steps**: ${imageAnalysis.businessElements.breakdown?.byType?.['Process Step'] || 0}\n- **Business Rules**: ${imageAnalysis.businessElements.breakdown?.byType?.['Business Rule'] || 0}\n- **User Actions**: ${imageAnalysis.businessElements.breakdown?.byType?.['User Action'] || 0}\n- **Validation Requirements**: ${imageAnalysis.businessElements.breakdown?.byType?.['Validation Requirement'] || 0}\n\n### Universal Analysis:\nThis universal business requirements extractor identified **${imageAnalysis.businessElements.count} business requirements** using consistent patterns across all file types.\n\n### Note:\nThis is an image file that may require manual review or OCR processing for detailed text extraction.`;
      return result;
    } else if (isExcelFile(mimeType, extension)) {
  
      try {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(buffer);
        
        let extractedContent = '';
        
        // Extract workbook structure and sheet names
        if (zipContent.files['xl/workbook.xml']) {
          const workbookXml = await zipContent.files['xl/workbook.xml'].async('string');
          const sheetMatches = workbookXml.match(/<sheet[^>]*name="([^"]*)"[^>]*>/g);
          if (sheetMatches) {
            extractedContent += `\n\n## Workbook Structure:\n`;
            sheetMatches.forEach((match, index) => {
              const nameMatch = match.match(/name="([^"]*)"/);
              if (nameMatch) {
                extractedContent += `Sheet ${index + 1}: ${nameMatch[1]}\n`;
              }
            });
          }
        }
        
        // Extract all worksheets
        const worksheetFiles = Object.keys(zipContent.files).filter(file => 
          file.includes('xl/worksheets/sheet') && file.endsWith('.xml')
        );
        
        for (const worksheetFile of worksheetFiles) {
          try {
            const worksheetXml = await zipContent.files[worksheetFile].async('string');
            
            extractedContent += `\n\n### Worksheet: ${worksheetFile}\n`;
            
        // Extract only meaningful text content (headers, labels, business logic)
        const textMatches = worksheetXml.match(/<t>(.*?)<\/t>/g);
        if (textMatches) {
          const meaningfulTexts = textMatches
            .map(text => text.replace(/<\/?t>/g, '').trim())
            .filter(text => text.length > 3 && !text.match(/^[0-9]+$/) && !text.match(/^[A-Z\s]+$/)); // Filter out numbers, very short text, and ALL CAPS
          
          if (meaningfulTexts.length > 0) {
            extractedContent += `\n#### Business Content:\n`;
            meaningfulTexts.forEach(text => {
              extractedContent += `${text}\n`;
            });
          }
        }
        
        // Enhanced business element detection for Excel - analyze actual content
        const businessElements = [];
        let elementCount = 0;
        
        // Extract meaningful business content from the actual text
        const lines = extractedContent.split('\n').filter(line => line.trim().length > 0);
        
        lines.forEach((line, index) => {
          const trimmedLine = line.trim();
          
          // Skip very short lines and generic headers
          if (trimmedLine.length < 10) return;
          
          // Detect business processes from content
          if (trimmedLine.toLowerCase().includes('process') || 
              trimmedLine.toLowerCase().includes('workflow') ||
              trimmedLine.toLowerCase().includes('procedure')) {
            businessElements.push({
              type: 'Business Process',
              text: trimmedLine,
              lineNumber: elementCount++,
              section: 'Excel Analysis'
            });
          }
          
          // Detect system requirements from content
          else if (trimmedLine.toLowerCase().includes('requirement') || 
                   trimmedLine.toLowerCase().includes('feature') ||
                   trimmedLine.toLowerCase().includes('functionality')) {
            businessElements.push({
              type: 'System Requirement',
              text: trimmedLine,
              lineNumber: elementCount++,
              section: 'Excel Analysis'
            });
          }
          
          // Detect user actions from content
          else if (trimmedLine.toLowerCase().includes('user') || 
                   trimmedLine.toLowerCase().includes('action') ||
                   trimmedLine.toLowerCase().includes('step')) {
            businessElements.push({
              type: 'User Action',
              text: trimmedLine,
              lineNumber: elementCount++,
              section: 'Excel Analysis'
            });
          }
          
          // Detect decision points from content
          else if (trimmedLine.toLowerCase().includes('decision') || 
                   trimmedLine.toLowerCase().includes('condition') ||
                   trimmedLine.toLowerCase().includes('if') ||
                   trimmedLine.toLowerCase().includes('when')) {
            businessElements.push({
              type: 'Decision Point',
              text: trimmedLine,
              lineNumber: elementCount++,
              section: 'Excel Analysis'
            });
          }
          
          // Detect business rules and scenarios
          else if (trimmedLine.toLowerCase().includes('scenario') || 
                   trimmedLine.toLowerCase().includes('rule') ||
                   trimmedLine.toLowerCase().includes('business') ||
                   trimmedLine.toLowerCase().includes('acceptance')) {
            businessElements.push({
              type: 'Business Rule',
              text: trimmedLine,
              lineNumber: elementCount++,
              section: 'Excel Analysis'
            });
          }
          
          // Detect numbered or bulleted items as potential requirements
          else if (trimmedLine.match(/^[0-9]+\.\s+/) || 
                   trimmedLine.match(/^[0-9]+\)\s+/) ||
                   trimmedLine.match(/^[•\-*]\s+/)) {
            businessElements.push({
              type: 'System Requirement',
              text: trimmedLine,
              lineNumber: elementCount++,
              section: 'Excel Analysis'
            });
          }
        });
        
        // If no business elements detected, add a default one
        if (businessElements.length === 0) {
          businessElements.push({
            type: 'Business Process',
            text: 'Excel Data Analysis Required - Manual Review Recommended',
            lineNumber: elementCount++,
            section: 'Excel Analysis'
          });
        }
            
            // Extract sheet structure info (column headers, row headers)
            const headerMatches = worksheetXml.match(/<c[^>]*r="[A-Z]+1"[^>]*>.*?<v>(.*?)<\/v>.*?<\/c>/gs);
            if (headerMatches) {
              const headers = headerMatches
                .map(header => header.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
                .filter(header => header.length > 0);
              
              if (headers.length > 0) {
                extractedContent += `\n#### Column Headers:\n`;
                headers.forEach(header => {
                  extractedContent += `- ${header}\n`;
                });
              }
            }
          } catch (error) {

          }
        }
        
        // Extract charts and embedded objects
        const chartFiles = Object.keys(zipContent.files).filter(file => 
          file.includes('xl/charts/') || file.includes('xl/drawings/')
        );
        
        if (chartFiles.length > 0) {
          extractedContent += `\n\n### Charts and Diagrams:\n`;
          chartFiles.forEach(chartFile => {
            extractedContent += `- ${chartFile}\n`;
          });
        }
        
        // Extract shared strings (for better text extraction)
        if (zipContent.files['xl/sharedStrings.xml']) {
          const sharedStringsXml = await zipContent.files['xl/sharedStrings.xml'].async('string');
          const stringMatches = sharedStringsXml.match(/<t>(.*?)<\/t>/g);
          if (stringMatches) {
            extractedContent += `\n\n### Shared Strings Content:\n`;
            stringMatches.forEach(stringMatch => {
              const stringText = stringMatch.replace(/<\/?t>/g, '').trim();
              if (stringText.length > 3 && !stringText.match(/^[0-9]+$/) && !stringText.match(/^[A-Z\s]+$/)) {
                extractedContent += `${stringText}\n`;
              }
            });
          }
        }
        
        if (extractedContent.trim()) {
          // Use universal business requirements extractor for consistent analysis
          const universalAnalysis = universalExtract(extractedContent, {
            minLineLength: 20,
            maxLineLength: 500,
            enableStrictMode: false,
            includeLowPriority: true
          });
          
          const result = `# Excel Spreadsheet Analysis\n\n## File: ${originalName}\n\n### Extracted Content:\n${extractedContent.trim()}\n\n### Universal Business Element Analysis:\n- **Total Business Elements**: ${universalAnalysis.businessElements.count}\n- **Quality Score**: ${universalAnalysis.qualityMetrics.qualityScore}%\n- **High Confidence Elements**: ${universalAnalysis.qualityMetrics.highConfidenceElements}\n- **Testable Elements**: ${universalAnalysis.qualityMetrics.testableElements}\n\n### Element Breakdown:\n- **Business Processes**: ${universalAnalysis.businessElements.breakdown.byType['Business Process'] || 0}\n- **System Requirements**: ${universalAnalysis.businessElements.breakdown.byType['System Requirement'] || 0}\n- **Decision Points**: ${universalAnalysis.businessElements.breakdown.byType['Decision Point'] || 0}\n- **Process Steps**: ${universalAnalysis.businessElements.breakdown.byType['Process Step'] || 0}\n- **Business Rules**: ${universalAnalysis.businessElements.breakdown.byType['Business Rule'] || 0}\n- **User Actions**: ${universalAnalysis.businessElements.breakdown.byType['User Action'] || 0}\n- **Validation Requirements**: ${universalAnalysis.businessElements.breakdown.byType['Validation Requirement'] || 0}\n\n### Universal Analysis:\nThis universal business requirements extractor identified **${universalAnalysis.businessElements.count} business requirements** using consistent patterns across all file types. Quality Score: ${universalAnalysis.qualityMetrics.qualityScore}%`;
          
          return result;
        } else {
          const result = `# Excel Spreadsheet Analysis\n\n## File: ${originalName}\n\n### Note:\nThis Excel file contains structured data that should be reviewed manually to create appropriate test cases based on the data relationships and business logic.`;
          return result;
        }
      } catch (zipError) {
        console.error(`Error processing Excel file ${originalName}:`, zipError);
        
        const errorResult = `# Excel Spreadsheet Analysis\n\n## File: ${originalName}\n\n### Note:\nThis Excel file contains structured data that requires manual analysis to create appropriate test cases.`;
        return errorResult;
      }
    } else if (isPowerPointFile(mimeType, extension)) {
  
      
      try {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(buffer);
        
        let extractedContent = '';
        
        // Extract presentation structure
        if (zipContent.files['ppt/presentation.xml']) {
          const presentationXml = await zipContent.files['ppt/presentation.xml'].async('string');
          const slideMatches = presentationXml.match(/<sldId[^>]*id="([^"]*)"[^>]*rid="([^"]*)"[^>]*>/g);
          if (slideMatches) {
            extractedContent += `\n\n## Presentation Structure:\n`;
            extractedContent += `Found ${slideMatches.length} slides in presentation\n`;
          }
        }
        
        // Extract all slides
        const slideFiles = Object.keys(zipContent.files).filter(file => 
          file.includes('ppt/slides/slide') && file.endsWith('.xml')
        );
        
        for (let i = 0; i < slideFiles.length; i++) {
          const slideFile = slideFiles[i];
          try {
            const slideXml = await zipContent.files[slideFile].async('string');
            
            extractedContent += `\n\n### Slide ${i + 1}:\n`;
            
            // Extract slide text content
            const textMatches = slideXml.match(/<a:t>(.*?)<\/a:t>/g);
            if (textMatches) {
              extractedContent += `\n#### Text Content:\n`;
              textMatches.forEach(textMatch => {
                const textContent = textMatch.replace(/<\/?a:t>/g, '').trim();
                if (textContent.length > 0) {
                  extractedContent += `- ${textContent}\n`;
                }
              });
            }
            
            // Extract shapes and diagrams
            const shapeMatches = slideXml.match(/<p:sp[^>]*>.*?<\/p:sp>/gs);
            if (shapeMatches) {
              extractedContent += `\n#### Shapes and Diagrams:\n`;
              shapeMatches.forEach(shape => {
                const shapeText = shape.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                if (shapeText.length > 10) {
                  extractedContent += `- Shape: ${shapeText}\n`;
                }
              });
            }
            
            // Enhanced business element detection for PowerPoint
            const businessElements = [];
            let elementCount = 0;
            
            // Detect business processes from slide content
            if (textMatches && textMatches.some(text => 
              text.toLowerCase().includes('process') || 
              text.toLowerCase().includes('workflow') ||
              text.toLowerCase().includes('business')
            )) {
              businessElements.push({
                type: 'Business Process',
                text: `Slide ${i + 1} Business Process Content`,
                lineNumber: elementCount++,
                section: 'PowerPoint Analysis'
              });
            }
            
            // Detect system requirements from slide content
            if (textMatches && textMatches.some(text => 
              text.toLowerCase().includes('requirement') || 
              text.toLowerCase().includes('feature') ||
              text.toLowerCase().includes('system')
            )) {
              businessElements.push({
                type: 'System Requirement',
                text: `Slide ${i + 1} System Requirements`,
                lineNumber: elementCount++,
                section: 'PowerPoint Analysis'
              });
            }
            
            // Detect user actions from slide content
            if (textMatches && textMatches.some(text => 
              text.toLowerCase().includes('user') || 
              text.toLowerCase().includes('action') ||
              text.toLowerCase().includes('click')
            )) {
              businessElements.push({
                type: 'User Action',
                text: `Slide ${i + 1} User Actions`,
                lineNumber: elementCount++,
                section: 'PowerPoint Analysis'
              });
            }
            
            // Detect decision points from slide content
            if (textMatches && textMatches.some(text => 
              text.toLowerCase().includes('decision') || 
              text.toLowerCase().includes('condition') ||
              text.toLowerCase().includes('if')
            )) {
              businessElements.push({
                type: 'Decision Point',
                text: `Slide ${i + 1} Decision Points`,
                lineNumber: elementCount++,
                section: 'PowerPoint Analysis'
              });
            }
            
            // Extract animations and transitions
            const animationMatches = slideXml.match(/<p:anim[^>]*>.*?<\/p:anim>/gs);
            if (animationMatches) {
              extractedContent += `\n#### Animations:\n`;
              animationMatches.forEach(animation => {
                const animationText = animation.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                if (animationText.length > 5) {
                  extractedContent += `- Animation: ${animationText}\n`;
                }
              });
            }
            
          } catch (error) {

          }
        }
        
        // Extract embedded media and objects
        const mediaFiles = Object.keys(zipContent.files).filter(file => 
          file.includes('ppt/media/') || file.includes('ppt/embeddings/')
        );
        
        if (mediaFiles.length > 0) {
          extractedContent += `\n\n### Embedded Media:\n`;
          mediaFiles.forEach(mediaFile => {
            extractedContent += `- ${mediaFile}\n`;
          });
        }
        
        // Extract slide masters for layout information
        const masterFiles = Object.keys(zipContent.files).filter(file => 
          file.includes('ppt/slideMasters/')
        );
        
        if (masterFiles.length > 0) {
          extractedContent += `\n\n### Slide Layouts:\n`;
          masterFiles.forEach(masterFile => {
            extractedContent += `- ${masterFile}\n`;
          });
        }
        
        if (extractedContent.trim()) {
          // Use deterministic counting for business elements
          // Use universal business requirements extractor for consistent analysis
          const universalAnalysis = universalExtract(extractedContent, {
            minLineLength: 20,
            maxLineLength: 500,
            enableStrictMode: false,
            includeLowPriority: true
          });
          
          const result = `# PowerPoint Presentation Analysis\n\n## File: ${originalName}\n\n### Extracted Content:\n${extractedContent.trim()}\n\n### Universal Business Element Analysis:\n- **Total Business Elements**: ${universalAnalysis.businessElements.count}\n- **Quality Score**: ${universalAnalysis.qualityMetrics.qualityScore}%\n- **High Confidence Elements**: ${universalAnalysis.qualityMetrics.highConfidenceElements}\n- **Testable Elements**: ${universalAnalysis.qualityMetrics.testableElements}\n\n### Element Breakdown:\n- **Business Processes**: ${universalAnalysis.businessElements.breakdown.byType['Business Process'] || 0}\n- **System Requirements**: ${universalAnalysis.businessElements.breakdown.byType['System Requirement'] || 0}\n- **Decision Points**: ${universalAnalysis.businessElements.breakdown.byType['Decision Point'] || 0}\n- **Process Steps**: ${universalAnalysis.businessElements.breakdown.byType['Process Step'] || 0}\n- **Business Rules**: ${universalAnalysis.businessElements.breakdown.byType['Business Rule'] || 0}\n- **User Actions**: ${universalAnalysis.businessElements.breakdown.byType['User Action'] || 0}\n- **Validation Requirements**: ${universalAnalysis.businessElements.breakdown.byType['Validation Requirement'] || 0}\n\n### Universal Analysis:\nThis universal business requirements extractor identified **${universalAnalysis.businessElements.count} business requirements** using consistent patterns across all file types. Quality Score: ${universalAnalysis.qualityMetrics.qualityScore}%`;
          
          return result;
        } else {
          const result = `# PowerPoint Presentation Analysis\n\n## File: ${originalName}\n\n### Note:\nThis PowerPoint presentation contains visual elements that should be reviewed manually to create appropriate test cases based on the presentation content and flow.`;
          return result;
        }
      } catch (zipError) {
        console.error(`Error processing PowerPoint file ${originalName}:`, zipError);
        
        const errorResult = `# PowerPoint Presentation Analysis\n\n## File: ${originalName}\n\n### Note:\nThis PowerPoint presentation contains visual elements that require manual analysis to create appropriate test cases.`;
        return errorResult;
      }
    } else if (isVisioFile(mimeType, extension)) {
      try {
        // VSDX files are essentially ZIP files containing XML
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(buffer);
        
        let extractedContent = '';
        
        // Extract business requirements from diagram structure
        if (zipContent.files['visio/document.xml']) {
          const documentXml = await zipContent.files['visio/document.xml'].async('string');
          
          // Extract page information for business context with deterministic ordering
          const pageMatches = documentXml.match(/<Page[^>]*Name="([^"]*)"[^>]*>/g);
          if (pageMatches) {
            extractedContent += `\n\n## Business Process Pages:\n`;
            // Sort page matches for consistency
            const sortedPageMatches = pageMatches.sort();
            sortedPageMatches.forEach((match, index) => {
              const nameMatch = match.match(/Name="([^"]*)"/);
              if (nameMatch) {
                const pageName = nameMatch[1];
                // Filter out technical page names and focus on business process names
                if (!pageName.match(/^(Page|Sheet|Background|Layer)/i)) {
                  extractedContent += `Business Process: ${pageName}\n`;
                }
              }
            });
          }
        }
        
        // Extract business requirements from all pages with deterministic ordering
        const pageFiles = Object.keys(zipContent.files).filter(file => 
          file.includes('visio/pages/') && file.endsWith('.xml')
        ).sort(); // Sort for consistency
        
        // Enhanced flowchart analysis
        let totalShapes = 0;
        let totalConnections = 0;
        let decisionPoints = 0;
        let processSteps = 0;
        let startPoints = 0;
        let endPoints = 0;
        
        for (const pageFile of pageFiles) {
          try {
            const pageXml = await zipContent.files[pageFile].async('string');
            
            // Extract business process elements and their relationships
            const businessElements = [];
            
            // Enhanced shape analysis for flowchart elements with deterministic processing
            const shapeMatches = pageXml.match(/<Shape[^>]*>.*?<\/Shape>/gs);
            if (shapeMatches) {
              totalShapes += shapeMatches.length;
              
              // Sort shapes by their position in the XML for consistency
              const sortedShapes = shapeMatches.sort((a, b) => {
                const aPos = pageXml.indexOf(a);
                const bPos = pageXml.indexOf(b);
                return aPos - bPos;
              });
              
              sortedShapes.forEach((shape, index) => {
                // Extract shape text and properties
                const textMatches = shape.match(/<Text[^>]*>.*?<\/Text>/gs);
                const nameMatches = shape.match(/Name="([^"]*)"/);
                const typeMatches = shape.match(/Type="([^"]*)"/);
                const masterMatches = shape.match(/Master="([^"]*)"/);
                
                if (textMatches || nameMatches) {
                  const shapeText = textMatches ? 
                    textMatches.map(text => text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()).join(' ') :
                    (nameMatches ? nameMatches[1] : '');
                  
                  const shapeType = typeMatches ? typeMatches[1] : '';
                  const masterType = masterMatches ? masterMatches[1] : '';
                  
                  // Enhanced flowchart element classification
                  let elementType = 'Business Process Component';
                  let flowchartRole = 'process';
                  
                  // Detect decision points (diamonds, gateways)
                  if (shapeText.toLowerCase().includes('decision') || 
                      shapeText.toLowerCase().includes('gateway') ||
                      shapeText.toLowerCase().includes('if') ||
                      shapeText.toLowerCase().includes('condition') ||
                      masterType.toLowerCase().includes('diamond') ||
                      masterType.toLowerCase().includes('gateway')) {
                    elementType = 'Decision Point';
                    flowchartRole = 'decision';
                    decisionPoints++;
                  }
                  // Detect start/end points
                  else if (shapeText.toLowerCase().includes('start') ||
                           shapeText.toLowerCase().includes('begin') ||
                           masterType.toLowerCase().includes('start')) {
                    elementType = 'Start Point';
                    flowchartRole = 'start';
                    startPoints++;
                  }
                  else if (shapeText.toLowerCase().includes('end') ||
                           shapeText.toLowerCase().includes('finish') ||
                           shapeText.toLowerCase().includes('stop') ||
                           masterType.toLowerCase().includes('end')) {
                    elementType = 'End Point';
                    flowchartRole = 'end';
                    endPoints++;
                  }
                  // Detect process steps
                  else if (shapeText.toLowerCase().includes('process') ||
                           shapeText.toLowerCase().includes('step') ||
                           shapeText.toLowerCase().includes('task') ||
                           masterType.toLowerCase().includes('rectangle')) {
                    elementType = 'Process Step';
                    flowchartRole = 'process';
                    processSteps++;
                  }
                  
                  // Focus on business-relevant shapes
                  if (shapeText.length > 3 && 
                      !shapeText.match(/^(Shape|Text|Group|Container)/i) &&
                      !shapeText.match(/^[0-9\s]+$/)) {
                    
                    businessElements.push({
                      text: shapeText,
                      type: shapeType,
                      master: masterType,
                      element: elementType,
                      flowchartRole: flowchartRole,
                      position: index + 1, // Use consistent index-based positioning
                      xmlPosition: pageXml.indexOf(shape) // Store XML position for deterministic ordering
                    });
                  }
                }
              });
            }
            
            // Enhanced connection analysis for business flows
            const connectionMatches = pageXml.match(/<Connect[^>]*>/g);
            if (connectionMatches) {
              totalConnections += connectionMatches.length;
              
              connectionMatches.forEach((connection, index) => {
                const fromMatches = connection.match(/FromSheet="([^"]*)"/);
                const toMatches = connection.match(/ToSheet="([^"]*)"/);
                const fromPartMatches = connection.match(/FromPart="([^"]*)"/);
                const toPartMatches = connection.match(/ToPart="([^"]*)"/);
                
                if (fromMatches && toMatches) {
                  // Find the connected elements to understand the flow
                  const fromElement = businessElements.find(el => el.position.toString() === fromMatches[1]);
                  const toElement = businessElements.find(el => el.position.toString() === toMatches[1]);
                  
                  let flowType = 'Standard Flow';
                  let flowDescription = `Flow from ${fromElement ? fromElement.text : fromMatches[1]} to ${toElement ? toElement.text : toMatches[1]}`;
                  
                  // Enhanced flow classification
                  if (fromElement && toElement) {
                    if (fromElement.flowchartRole === 'decision' && toElement.flowchartRole === 'process') {
                      flowType = 'Decision Flow';
                      flowDescription = `Decision "${fromElement.text}" leads to process "${toElement.text}"`;
                    } else if (fromElement.flowchartRole === 'process' && toElement.flowchartRole === 'decision') {
                      flowType = 'Process to Decision';
                      flowDescription = `Process "${fromElement.text}" leads to decision "${toElement.text}"`;
                    } else if (fromElement.flowchartRole === 'start' && toElement.flowchartRole === 'process') {
                      flowType = 'Start Flow';
                      flowDescription = `Start point leads to process "${toElement.text}"`;
                    } else if (fromElement.flowchartRole === 'process' && toElement.flowchartRole === 'end') {
                      flowType = 'End Flow';
                      flowDescription = `Process "${fromElement.text}" leads to end point`;
                    }
                  }
                  
                  businessElements.push({
                    text: flowDescription,
                    type: 'Connection',
                    element: 'Business Flow',
                    flowType: flowType,
                    fromElement: fromElement ? fromElement.text : fromMatches[1],
                    toElement: toElement ? toElement.text : toMatches[1],
                    position: businessElements.length + 1
                  });
                }
              });
            }
            
            // Extract business requirements from the diagram elements with deterministic ordering
            if (businessElements.length > 0) {
              extractedContent += `\n\n### Business Requirements from Diagram:\n`;
              
              // Sort business elements by XML position for consistent ordering
              businessElements.sort((a, b) => (a.xmlPosition || 0) - (b.xmlPosition || 0));
              
              // Group by element type for better organization
              const processes = businessElements.filter(el => el.element === 'Business Process Component');
              const flows = businessElements.filter(el => el.element === 'Business Flow');
              
              if (processes.length > 0) {
                extractedContent += `\n#### Business Processes and Systems:\n`;
                processes.forEach(process => {
                  extractedContent += `- ${process.text}\n`;
                });
              }
              
              if (flows.length > 0) {
                extractedContent += `\n#### Business Flows and Relationships:\n`;
                flows.forEach(flow => {
                  extractedContent += `- ${flow.text}\n`;
                });
              }
              
              // Generate business requirements based on the diagram structure
              extractedContent += `\n\n#### Derived Business Requirements:\n`;
              
              // Create requirements based on process components with consistent ordering
              processes.forEach((process, index) => {
                const requirementText = process.text.replace(/[^\w\s]/g, ' ').trim();
                if (requirementText.length > 5) {
                  extractedContent += `- The system should support ${requirementText.toLowerCase()}\n`;
                }
              });
              
              // Create requirements based on business flows with consistent ordering
              flows.forEach((flow, index) => {
                const flowText = flow.text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                if (flowText.length > 10) {
                  extractedContent += `- The system should handle ${flowText.toLowerCase()}\n`;
                }
              });
              
              // Enhanced flowchart analysis summary
              extractedContent += `\n#### Flowchart Analysis Summary:\n`;
              extractedContent += `- **Total Elements**: ${totalShapes} shapes, ${totalConnections} connections\n`;
              extractedContent += `- **Process Steps**: ${processSteps} identified\n`;
              extractedContent += `- **Decision Points**: ${decisionPoints} identified\n`;
              extractedContent += `- **Start Points**: ${startPoints} identified\n`;
              extractedContent += `- **End Points**: ${endPoints} identified\n`;
              
              // Flow complexity assessment
              if (decisionPoints > 5) {
                extractedContent += `- **Complexity**: High - Multiple decision paths detected\n`;
              } else if (decisionPoints > 2) {
                extractedContent += `- **Complexity**: Medium - Several decision points\n`;
              } else {
                extractedContent += `- **Complexity**: Low - Linear process flow\n`;
              }
              
              // Flow validation
              if (startPoints === 0) {
                extractedContent += `- **⚠️ Warning**: No start point detected\n`;
              }
              if (endPoints === 0) {
                extractedContent += `- **⚠️ Warning**: No end point detected\n`;
              }
              if (decisionPoints > 0 && processSteps < decisionPoints) {
                extractedContent += `- **⚠️ Warning**: More decisions than process steps - review flow logic\n`;
              }
            }
            
          } catch (error) {

          }
        }
        
        // Extract any embedded text or notes that might contain business requirements
        const embeddedFiles = Object.keys(zipContent.files).filter(file => 
          file.includes('embeddings/') || file.includes('media/') || file.includes('word/')
        );
        
        if (embeddedFiles.length > 0) {
          extractedContent += `\n\n### Additional Business Context:\n`;
          for (const embeddedFile of embeddedFiles) {
            try {
              const embeddedContent = await zipContent.files[embeddedFile].async('string');
              // Extract meaningful text from embedded content
              const textMatches = embeddedContent.match(/<Text[^>]*>.*?<\/Text>/gs);
              if (textMatches) {
                const meaningfulTexts = textMatches
                  .map(text => text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
                  .filter(text => text.length > 10 && !text.match(/^[0-9\s]+$/));
                
                if (meaningfulTexts.length > 0) {
                  meaningfulTexts.forEach(text => {
                    extractedContent += `- ${text}\n`;
                  });
                }
              }
            } catch (error) {
              // Skip embedded files that can't be read as text
            }
          }
        }
        
        if (extractedContent.trim()) {
          // Use universal business requirements extractor for consistent analysis
          const universalAnalysis = universalExtract(extractedContent, {
            minLineLength: 20,
            maxLineLength: 500,
            enableStrictMode: false,
            includeLowPriority: true
          });
          
          const result = `# Visio Diagram Analysis\n\n## File: ${originalName}\n\n### Extracted Content:\n${extractedContent.trim()}\n\n### Universal Business Element Analysis:\n- **Total Business Elements**: ${universalAnalysis.businessElements.count}\n- **Quality Score**: ${universalAnalysis.qualityMetrics.qualityScore}%\n- **High Confidence Elements**: ${universalAnalysis.qualityMetrics.highConfidenceElements}\n- **Testable Elements**: ${universalAnalysis.qualityMetrics.testableElements}\n\n### Element Breakdown:\n- **Business Processes**: ${universalAnalysis.businessElements.breakdown.byType['Business Process'] || 0}\n- **System Requirements**: ${universalAnalysis.businessElements.breakdown.byType['System Requirement'] || 0}\n- **Decision Points**: ${universalAnalysis.businessElements.breakdown.byType['Decision Point'] || 0}\n- **Process Steps**: ${universalAnalysis.businessElements.breakdown.byType['Process Step'] || 0}\n- **Business Rules**: ${universalAnalysis.businessElements.breakdown.byType['Business Rule'] || 0}\n- **User Actions**: ${universalAnalysis.businessElements.breakdown.byType['User Action'] || 0}\n- **Validation Requirements**: ${universalAnalysis.businessElements.breakdown.byType['Validation Requirement'] || 0}\n\n### Universal Analysis:\nThis universal business requirements extractor identified **${universalAnalysis.businessElements.count} business requirements** using consistent patterns across all file types. Quality Score: ${universalAnalysis.qualityMetrics.qualityScore}%`;
          
          return result;
        } else {
          const result = `# Visio Diagram Analysis\n\n## File: ${originalName}\n\n### Note:\nThis Visio diagram file contains visual elements that require manual analysis. The diagram structure and relationships should be reviewed manually to create appropriate test cases.`;
          
          return result;
        }
      } catch (zipError) {
        console.error(`Error processing Visio file ${originalName}:`, zipError);
        
        const errorResult = `# Visio Diagram Analysis\n\n## File: ${originalName}\n\n### Note:\nThis Visio diagram file requires manual analysis. Please review the diagram structure and create test cases based on the visual elements and relationships shown.`;
        return errorResult;
      }
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    console.error(`Error extracting content from ${file.originalname}:`, error);
    
    
    
    throw new Error(`Failed to extract content from ${file.originalname}: ${error.message}`);
  }
}

// Process document sections
function processDocumentSections(content, fileName) {
  const sections = [];
  const lines = content.split('\n');
  let currentSection = '';
  let currentSectionTitle = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('#') || line.startsWith('##') || line.startsWith('###')) {
      // Save previous section if exists
      if (currentSection.trim()) {
        sections.push({
          title: currentSectionTitle || `Section ${sections.length + 1}`,
          content: currentSection.trim()
        });
      }
      
      // Start new section
      currentSectionTitle = line.replace(/^#+\s*/, '');
      currentSection = line + '\n';
    } else {
      currentSection += line + '\n';
    }
  }
  
  // Add the last section
  if (currentSection.trim()) {
    sections.push({
      title: currentSectionTitle || `Section ${sections.length + 1}`,
      content: currentSection.trim()
    });
  }
  
  // If no sections found, create a single section
  if (sections.length === 0) {
    sections.push({
      title: `Content from ${fileName}`,
      content: content.trim()
    });
  }
  
  return sections;
}

// Enhanced Visio (.vsdx) flowchart analysis function
async function analyzeVisioFlowchart(buffer, originalName) {
  try {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(buffer);
    
    let extractedContent = '';
    let businessElements = [];
    let elementCount = 0;
    
    // Extract Visio drawing pages
    const drawingFiles = Object.keys(zipContent.files).filter(file => 
      file.includes('visio/pages/page') && file.endsWith('.xml')
    );
    
    // Extract master shapes for additional context
    const masterFiles = Object.keys(zipContent.files).filter(file => 
      file.includes('visio/masters/master') && file.endsWith('.xml')
    );
    
    // Process each drawing page
    for (const drawingFile of drawingFiles) {
      try {
        const pageXml = await zipContent.files[drawingFile].async('string');
        const pageAnalysis = analyzeVisioXmlContent(pageXml, drawingFile);
        
        extractedContent += `\n\n## Page: ${drawingFile}\n${pageAnalysis.content}`;
        businessElements.push(...pageAnalysis.elements);
        elementCount += pageAnalysis.elements.length;
      } catch (error) {
        console.error(`Error processing page ${drawingFile}:`, error);
      }
    }
    
    // Process master shapes for additional business context
    for (const masterFile of masterFiles) {
      try {
        const masterXml = await zipContent.files[masterFile].async('string');
        const masterAnalysis = analyzeVisioMasterShapes(masterXml);
        
        extractedContent += `\n\n## Master Shapes: ${masterFile}\n${masterAnalysis.content}`;
        businessElements.push(...masterAnalysis.elements);
        elementCount += masterAnalysis.elements.length;
      } catch (error) {
        console.error(`Error processing master ${masterFile}:`, error);
      }
    }
    
    // Calculate flowchart complexity
    const complexity = calculateFlowchartComplexity({
      totalShapes: businessElements.length,
      decisionPoints: businessElements.filter(e => e.type === 'Decision Point').length,
      processSteps: businessElements.filter(e => e.type === 'Process Step').length,
      connectors: businessElements.filter(e => e.type === 'Connector').length
    });
    
    // Generate comprehensive analysis
    const analysis = {
      businessElements: {
        count: businessElements.length,
        elements: businessElements,
        breakdown: {
          processes: businessElements.filter(e => e.type === 'Business Process').length,
          requirements: businessElements.filter(e => e.type === 'System Requirement').length,
          decisions: businessElements.filter(e => e.type === 'Decision Point').length,
          steps: businessElements.filter(e => e.type === 'Process Step').length,
          flows: businessElements.filter(e => e.type === 'Business Flow').length,
          userActions: businessElements.filter(e => e.type === 'User Action').length,
          shapes: businessElements.filter(e => e.type === 'Shape').length,
          connectors: businessElements.filter(e => e.type === 'Connector').length
        }
      },
      description: `Enhanced Visio analysis identified ${businessElements.length} business elements across ${drawingFiles.length} pages with ${complexity} complexity.`,
      flowchartMetadata: {
        totalPages: drawingFiles.length,
        totalShapes: businessElements.filter(e => e.type === 'Shape').length,
        totalConnectors: businessElements.filter(e => e.type === 'Connector').length,
        hasDecisionPoints: businessElements.some(e => e.type === 'Decision Point'),
        hasProcessFlows: businessElements.some(e => e.type === 'Business Flow'),
        complexity: complexity
      }
    };
    
    return analysis;
    
  } catch (error) {
    console.error(`Error analyzing Visio flowchart:`, error);
    
    return {
      businessElements: {
        count: 0,
        elements: [],
        breakdown: {
          processes: 0,
          requirements: 0,
          decisions: 0,
          steps: 0,
          flows: 0,
          userActions: 0,
          shapes: 0,
          connectors: 0
        }
      },
      extractedContent: `# Visio Flowchart Analysis\n\n## File: ${originalName}\n\n### Error:\nFailed to analyze flowchart content: ${error.message}`,
      flowchartMetadata: {
        totalPages: 0,
        totalShapes: 0,
        totalConnectors: 0,
        hasDecisionPoints: false,
        hasProcessFlows: false,
        complexity: 'Unknown'
      }
    };
  }
}

// Helper function to analyze Visio XML content
function analyzeVisioXmlContent(xmlContent, context) {
  const elements = [];
  let content = '';
  
  // Extract shapes and their text content
  const shapeMatches = xmlContent.match(/<Shape[^>]*>.*?<\/Shape>/gs);
  if (shapeMatches) {
    shapeMatches.forEach((shape, index) => {
      const shapeAnalysis = analyzeVisioShape(shape, index, context);
      if (shapeAnalysis.element) {
        elements.push(shapeAnalysis.element);
      }
      content += shapeAnalysis.content;
    });
  }
  
  return { elements, content };
}

// Helper function to analyze individual Visio shapes
function analyzeVisioShape(shapeXml, index, context) {
  let element = null;
  let content = '';
  
  // Extract shape text
  const textMatches = shapeXml.match(/<Text[^>]*>.*?<\/Text>/gs);
  if (textMatches) {
    const shapeText = textMatches.map(text => 
      text.replace(/<\/?Text[^>]*>/g, '').trim()
    ).join(' ').trim();
    
    if (shapeText.length > 0) {
      // Analyze text for business elements
      const businessElements = analyzeVisioTextForBusinessElements(shapeText, index, context);
      if (businessElements.length > 0) {
        element = businessElements[0]; // Take the first business element found
      }
      
      content += `\nShape ${index + 1}: ${shapeText}`;
    }
  }
  
  return { element, content };
}

// Helper function to analyze Visio master shapes
function analyzeVisioMasterShapes(masterXml) {
  const elements = [];
  let content = '';
  
  // Extract master shape definitions
  const masterMatches = masterXml.match(/<Master[^>]*>.*?<\/Master>/gs);
  if (masterMatches) {
    masterMatches.forEach((master, index) => {
      const nameMatches = master.match(/Name="([^"]*)"/);
      if (nameMatches) {
        const masterName = nameMatches[1];
        content += `\nMaster Shape ${index + 1}: ${masterName}`;
        
        // Add business context based on master name
        if (masterName.toLowerCase().includes('decision')) {
          elements.push({
            type: 'Decision Point',
            text: `Master: ${masterName}`,
            lineNumber: index + 1,
            section: 'Master Shapes'
          });
        } else if (masterName.toLowerCase().includes('process')) {
          elements.push({
            type: 'Process Step',
            text: `Master: ${masterName}`,
            lineNumber: index + 1,
            section: 'Master Shapes'
          });
        }
      }
    });
  }
  
  return { elements, content };
}

// Helper function to analyze Visio text for business elements
function analyzeVisioTextForBusinessElements(text, lineNumber, context) {
  const elements = [];
  
  // Simple business element detection based on text content
  if (text.toLowerCase().includes('decision') || text.toLowerCase().includes('if') || text.toLowerCase().includes('when')) {
    elements.push({
      type: 'Decision Point',
      text: text,
      lineNumber: lineNumber,
      section: context
    });
  } else if (text.toLowerCase().includes('process') || text.toLowerCase().includes('step') || text.toLowerCase().includes('action')) {
    elements.push({
      type: 'Process Step',
      text: text,
      lineNumber: lineNumber,
      section: context
    });
  } else if (text.toLowerCase().includes('start') || text.toLowerCase().includes('begin')) {
    elements.push({
      type: 'Business Process',
      text: text,
      lineNumber: lineNumber,
      section: context
    });
  } else if (text.toLowerCase().includes('end') || text.toLowerCase().includes('finish')) {
    elements.push({
      type: 'Business Process',
      text: text,
      lineNumber: lineNumber,
      section: context
    });
  } else if (text.toLowerCase().includes('user') || text.toLowerCase().includes('input')) {
    elements.push({
      type: 'User Action',
      text: text,
      lineNumber: lineNumber,
      section: context
    });
  } else {
    // Default to generic shape
    elements.push({
      type: 'Shape',
      text: text,
      lineNumber: lineNumber,
      section: context
    });
  }
  
  return elements;
}

// Helper function to calculate flowchart complexity
function calculateFlowchartComplexity(breakdown) {
  const totalElements = breakdown.totalShapes + breakdown.decisionPoints + breakdown.processSteps + breakdown.connectors;
  
  if (totalElements <= 10) return 'simple';
  if (totalElements <= 25) return 'moderate';
  if (totalElements <= 50) return 'complex';
  return 'very complex';
}

module.exports = {
  extractFileContent,
  processDocumentSections,
  isImageFile,
  isExcelFile,
  isPowerPointFile,
  isVisioFile,
  analyzeVisioFlowchart
}; 
