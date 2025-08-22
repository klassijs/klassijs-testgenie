/**
 * Universal Business Requirements Extractor
 * 
 * This system provides consistent business requirement detection across ALL file types.
 * It works on extracted content from any source (PDF, Word, Excel, PowerPoint, Visio, etc.)
 * and applies the same high-quality business logic detection.
 */

// Universal business element patterns that work across all document types
const UNIVERSAL_BUSINESS_PATTERNS = {
  // High priority - exact matches
  highPriority: [
    { regex: /^Business Process:/i, type: 'Business Process', priority: 'high' },
    { regex: /^Decision Point:/i, type: 'Decision Point', priority: 'high' },
    { regex: /^Process Step:/i, type: 'Process Step', priority: 'high' },
    { regex: /^System Requirement:/i, type: 'System Requirement', priority: 'high' },
    { regex: /^User Story:/i, type: 'User Story', priority: 'high' },
    { regex: /^Acceptance Criteria:/i, type: 'Acceptance Criteria', priority: 'high' }
  ],
  
  // Medium priority - structured patterns (AGGRESSIVE IMPROVEMENT)
  mediumPriority: [
    { regex: /^[0-9]+\.\s+.*/i, type: 'System Requirement', priority: 'medium' },
    { regex: /^[0-9]+\)\s+.*/i, type: 'System Requirement', priority: 'medium' },
    { regex: /^[a-z]\)\s+.*/i, type: 'System Requirement', priority: 'medium' },
    { regex: /^[•\-*]\s+.*/i, type: 'System Requirement', priority: 'medium' },
    { regex: /^Scenario\s+[0-9]+:.*/i, type: 'System Requirement', priority: 'medium' },
    { regex: /^Requirement\s+[0-9]+:.*/i, type: 'System Requirement', priority: 'medium' },
    { regex: /^BR\s*[0-9]+:.*/i, type: 'System Requirement', priority: 'medium' },
    { regex: /^AC\s*[0-9]+:.*/i, type: 'Acceptance Criteria', priority: 'medium' },
    { regex: /^.*(must|should|will|shall|can|need)/i, type: 'System Requirement', priority: 'medium' },
    { regex: /^.*(system|user|process)/i, type: 'System Requirement', priority: 'medium' },
    { regex: /^.*(if|when|where)/i, type: 'Business Rule', priority: 'medium' }
  ],
  
  // Business logic patterns
  businessLogic: [
    { regex: /^where\s+/i, type: 'Business Rule', priority: 'high' },
    { regex: /^if\s+/i, type: 'Business Rule', priority: 'high' },
    { regex: /^when\s+/i, type: 'Business Rule', priority: 'high' },
    { regex: /^then\s+/i, type: 'Business Rule', priority: 'high' },
    { regex: /^given\s+/i, type: 'Business Rule', priority: 'high' }
  ],
  
  // Validation and verification patterns (AGGRESSIVE IMPROVEMENT)
  validation: [
    { regex: /^.*(verify|check|ensure|validate|test)/i, type: 'Validation Requirement', priority: 'medium' },
    { regex: /^.*(must|should|will|shall|can|need).*(verify|check|ensure|validate|test)/i, type: 'Validation Requirement', priority: 'medium' },
    { regex: /^.*(system|user|process).*(verify|check|ensure|validate|test)/i, type: 'Validation Requirement', priority: 'medium' },
    { regex: /^.*(verify|check|ensure|validate|test).*(must|should|will|shall|can|need)/i, type: 'Validation Requirement', priority: 'medium' }
  ],
  
  // Process and workflow patterns (AGGRESSIVE IMPROVEMENT)
  process: [
    { regex: /^.*(process|workflow|step|activity|task)/i, type: 'Process Step', priority: 'medium' },
    { regex: /^.*(must|should|will|shall|can|need).*(process|workflow|step|activity|task)/i, type: 'Process Step', priority: 'medium' },
    { regex: /^.*(system|user|process).*(process|workflow|step|activity|task)/i, type: 'Process Step', priority: 'medium' },
    { regex: /^.*(execute|perform|complete|handle|manage)/i, type: 'Business Process', priority: 'medium' },
    { regex: /^.*(must|should|will|shall|can|need).*(execute|perform|complete|handle|manage)/i, type: 'Business Process', priority: 'medium' }
  ],
  
  // User interaction patterns (AGGRESSIVE IMPROVEMENT)
  userInteraction: [
    { regex: /^.*user/i, type: 'User Action', priority: 'medium' },
    { regex: /^.*user\s+(must|should|will|shall|can|need)/i, type: 'User Action', priority: 'medium' },
    { regex: /^.*(system|interface)\s+(must|should|will|shall|can|need)/i, type: 'User Action', priority: 'low' },
    { regex: /^.*(click|select|enter|submit|access|view|create|edit|delete)/i, type: 'User Action', priority: 'medium' },
    { regex: /^.*(allow|enable|provide|support)/i, type: 'User Action', priority: 'low' }
  ]
};

/**
 * Extract business requirements from any content using universal patterns
 * @param {string} content - Content from any file type
 * @param {Object} options - Extraction options
 * @returns {Object} Comprehensive business requirements analysis
 */
function extractBusinessRequirements(content, options = {}) {
  const {
    minLineLength = 20,
    maxLineLength = 500,
    enableStrictMode = false,
    includeLowPriority = true
  } = options;

  if (!content || typeof content !== 'string') {
    return {
      success: false,
      error: 'Invalid content provided',
      businessElements: { count: 0, elements: [], breakdown: {} }
    };
  }

  const lines = content.split('\n');
  const businessElements = [];
  let currentSection = '';
  let lineNumber = 0;

  for (const line of lines) {
    lineNumber++;
    const trimmedLine = line.trim();
    
    if (!trimmedLine || trimmedLine.length < minLineLength || trimmedLine.length > maxLineLength) {
      continue;
    }

    // Detect section headers
    if (trimmedLine.match(/^#{1,6}\s+/)) {
      currentSection = trimmedLine.replace(/^#{1,6}\s+/, '').trim();
      continue;
    }

    // Skip technical/non-business content
    if (isTechnicalContent(trimmedLine)) {
      continue;
    }

    // Extract business elements using universal patterns
    const elements = extractElementsFromLine(trimmedLine, lineNumber, currentSection, enableStrictMode);
    businessElements.push(...elements);
  }

  // Post-process and categorize elements
  const processedElements = postProcessElements(businessElements);
  
  // Generate comprehensive breakdown
  const breakdown = generateBreakdown(processedElements);
  
  // Calculate quality metrics
  const qualityMetrics = calculateQualityMetrics(processedElements, content.length);

  return {
    success: true,
    businessElements: {
      count: processedElements.length,
      elements: processedElements,
      breakdown: breakdown
    },
    qualityMetrics: qualityMetrics,
    metadata: {
      totalLines: lines.length,
      processedLines: businessElements.length,
      sections: [...new Set(businessElements.map(e => e.section).filter(Boolean))],
      extractionOptions: options
    }
  };
}

/**
 * Extract business elements from a single line using universal patterns
 * @param {string} line - Single line of content
 * @param {number} lineNumber - Line number for tracking
 * @param {string} section - Current section context
 * @param {boolean} strictMode - Enable strict pattern matching
 * @returns {Array} Array of business elements found
 */
function extractElementsFromLine(line, lineNumber, section, strictMode = false) {
  const elements = [];
  const lowerLine = line.toLowerCase();

  // Check high priority patterns first
  for (const pattern of UNIVERSAL_BUSINESS_PATTERNS.highPriority) {
    if (pattern.regex.test(line)) {
      elements.push({
        type: pattern.type,
        text: line,
        lineNumber: lineNumber,
        section: section,
        priority: pattern.priority,
        confidence: 'high',
        pattern: pattern.regex.source
      });
      break; // Only match one high priority pattern per line
    }
  }

  // Check business logic patterns
  for (const pattern of UNIVERSAL_BUSINESS_PATTERNS.businessLogic) {
    if (pattern.regex.test(line)) {
      elements.push({
        type: pattern.type,
        text: line,
        lineNumber: lineNumber,
        section: section,
        priority: pattern.priority,
        confidence: 'high',
        pattern: pattern.regex.source
      });
    }
  }

  // Check medium priority patterns
  for (const pattern of UNIVERSAL_BUSINESS_PATTERNS.mediumPriority) {
    if (pattern.regex.test(line)) {
      elements.push({
        type: pattern.type,
        text: line,
        lineNumber: lineNumber,
        section: section,
        priority: pattern.priority,
        confidence: 'medium',
        pattern: pattern.regex.source
      });
    }
  }

  // Check validation patterns
  for (const pattern of UNIVERSAL_BUSINESS_PATTERNS.validation) {
    if (pattern.regex.test(line)) {
      elements.push({
        type: pattern.type,
        text: line,
        lineNumber: lineNumber,
        section: section,
        priority: pattern.priority,
        confidence: 'medium',
        pattern: pattern.regex.source
      });
    }
  }

  // Check process patterns
  for (const pattern of UNIVERSAL_BUSINESS_PATTERNS.process) {
    if (pattern.regex.test(line)) {
      elements.push({
        type: pattern.type,
        text: line,
        lineNumber: lineNumber,
        section: section,
        priority: pattern.priority,
        confidence: 'medium',
        pattern: pattern.regex.source
      });
    }
  }

  // Check user interaction patterns (lower priority)
  for (const pattern of UNIVERSAL_BUSINESS_PATTERNS.userInteraction) {
    if (pattern.regex.test(line)) {
      elements.push({
        type: pattern.type,
        text: line,
        lineNumber: lineNumber,
        section: section,
        priority: pattern.priority,
        confidence: 'low',
        pattern: pattern.regex.source
      });
    }
  }

  // If no patterns matched but line has business content, classify as generic requirement
  // BALANCED - classify if it has clear business logic, not too restrictive
  if (elements.length === 0 && hasBusinessContent(line) && isExtractableRequirement(line)) {
    elements.push({
      type: 'Business Requirement',
      text: line,
      lineNumber: lineNumber,
      section: section,
      priority: 'low',
      confidence: 'low',
      pattern: 'business_content_detection'
    });
  }

  return elements;
}

/**
 * Check if content is technical/non-business
 * @param {string} line - Line to check
 * @returns {boolean} True if technical content
 */
function isTechnicalContent(line) {
  const technicalPatterns = [
    /^[A-Z][A-Z\s]+$/, // ALL CAPS headers
    /^[0-9\s]+$/, // Just numbers
    /^[a-z0-9]{8,}$/i, // Long alphanumeric strings (IDs, hashes)
    /^(function|class|var|const|let)\s+/i, // Code
    /^(import|export|require)\s+/i, // Code imports
    /^(http|https):\/\//, // URLs
    /^[<>\/\w\s]+$/, // HTML/XML tags
    /^[{}[\]]+$/, // Brackets only
    /^[+\-*/=]+$/, // Math operators only
  ];

  return technicalPatterns.some(pattern => pattern.test(line));
}

/**
 * Check if line has business content
 * @param {string} line - Line to check
 * @returns {boolean} True if business content detected
 */
function hasBusinessContent(line) {
  const businessKeywords = [
    'business', 'process', 'requirement', 'user', 'system', 'data',
    'workflow', 'validation', 'check', 'verify', 'ensure', 'must',
    'should', 'will', 'shall', 'can', 'need', 'want', 'expect'
  ];

  const lowerLine = line.toLowerCase();
  return businessKeywords.some(keyword => lowerLine.includes(keyword)) &&
         line.length > 20 && // Reasonable length
         !isTechnicalContent(line);
}

/**
 * Check if a line is actually extractable as a business requirement
 * @param {string} line - Line to check
 * @returns {boolean} True if extractable as requirement
 */
function isExtractableRequirement(line) {
  const lowerLine = line.toLowerCase();
  
  // Quality check: Reject obviously poor requirements
  if (lowerLine.includes('1 2 13') || lowerLine.includes('1 2 3') || 
      lowerLine.includes('1 2 4') || lowerLine.includes('1 2 5') ||
      lowerLine.includes('1 2 6') || lowerLine.includes('1 2 7') ||
      lowerLine.includes('1 2 8') || lowerLine.includes('1 2 9') ||
      lowerLine.includes('1 2 10') || lowerLine.includes('1 2 11') ||
      lowerLine.includes('1 2 12') || lowerLine.includes('1 2 13') ||
      lowerLine.includes('1 2 14') || lowerLine.includes('1 2 15')) {
    return false; // Reject numbered sequences that aren't requirements
  }
  
  // ENHANCED QUALITY CHECK: Reject vague "support X" statements
  if (lowerLine.includes('support') && lowerLine.length < 60) {
    return false; // "support X" without sufficient context is too vague
  }
  
  // ENHANCED QUALITY CHECK: Reject page references without business context
  if (lowerLine.includes('page') && !lowerLine.includes('user') && 
      !lowerLine.includes('customer') && !lowerLine.includes('access') &&
      !lowerLine.includes('navigate') && !lowerLine.includes('display')) {
    return false; // Just "page X" without business purpose
  }
  
  // ENHANCED QUALITY CHECK: Reject vague team/person references
  if ((lowerLine.includes('team') || lowerLine.includes('person') || lowerLine.includes('sales')) && 
      lowerLine.length < 50 && !lowerLine.includes('can') && !lowerLine.includes('must') &&
      !lowerLine.includes('should') && !lowerLine.includes('will')) {
    return false; // Just mentioning teams without action
  }
  
  // ENHANCED QUALITY CHECK: Reject incomplete sentences
  if (!lowerLine.includes('.') && !lowerLine.includes('!') && !lowerLine.includes('?') && 
      !lowerLine.includes(':') && line.trim().length < 30) {
    return false; // Too short and incomplete
  }
  
  // Quality check: Reject requirements with just numbers
  if (/^\d+\s+\d+\s+\d+/.test(line.trim())) {
    return false; // Just numbers, not a requirement
  }
  
  // ENHANCED QUALITY CHECK: Must have clear business action
  const hasAction = lowerLine.includes('must') || lowerLine.includes('should') || 
                   lowerLine.includes('will') || lowerLine.includes('shall') ||
                   lowerLine.includes('can') || lowerLine.includes('need') ||
                   lowerLine.includes('users') || lowerLine.includes('system') ||
                   lowerLine.includes('the') || lowerLine.includes('a ') ||
                   lowerLine.includes('an ') || lowerLine.includes('if') ||
                   lowerLine.includes('when') || lowerLine.includes('where');
  
  // ENHANCED QUALITY CHECK: Must have clear business outcome
  const hasOutcome = lowerLine.includes('verify') || lowerLine.includes('check') ||
                    lowerLine.includes('ensure') || lowerLine.includes('validate') ||
                    lowerLine.includes('result') || lowerLine.includes('output') ||
                    lowerLine.includes('state') || lowerLine.includes('condition') ||
                    lowerLine.includes('form') || lowerLine.includes('account') ||
                    lowerLine.includes('password') || lowerLine.includes('email') ||
                    lowerLine.includes('permission') || lowerLine.includes('session') ||
                    lowerLine.includes('user') || lowerLine.includes('data') ||
                    lowerLine.includes('information') || lowerLine.includes('access');
  
  // ENHANCED QUALITY CHECK: Must be reasonably complete
  const isComplete = line.trim().endsWith('.') || line.trim().endsWith('!') || 
                    line.trim().endsWith('?') || line.trim().endsWith(':') ||
                    line.trim().length > 25; // Increased minimum length for quality
  
  // ENHANCED QUALITY CHECK: Must not be just descriptive text
  const isNotJustDescription = !lowerLine.startsWith('this document contains') && 
                              !lowerLine.startsWith('the system needs to') && 
                              !lowerLine.startsWith('users will interact with') &&
                              !lowerLine.startsWith('page') && 
                              !lowerLine.startsWith('section') &&
                              !lowerLine.startsWith('the system should support') && // Reject vague support statements
                              !lowerLine.includes('support page') && // Reject page support without context
                              !lowerLine.includes('support team') && // Reject team support without context
                              !lowerLine.includes('support customer'); // Reject customer support without context
  
  // STRICT QUALITY APPROACH: Must meet multiple quality criteria
  return (hasAction || hasOutcome) && isComplete && isNotJustDescription;
}

/**
 * Post-process extracted elements for better categorization
 * @param {Array} elements - Raw extracted elements
 * @returns {Array} Processed elements
 */
function postProcessElements(elements) {
  return elements.map(element => {
    // Enhance element with additional context
    const enhanced = { ...element };
    
    // Detect if element has acceptance criteria
    if (element.text.toLowerCase().includes('given') || 
        element.text.toLowerCase().includes('when') || 
        element.text.toLowerCase().includes('then')) {
      enhanced.hasAcceptanceCriteria = true;
    }
    
    // Detect complexity based on content
    enhanced.complexity = calculateElementComplexity(element.text);
    
    // Detect if element is testable
    enhanced.isTestable = isElementTestable(element.text);
    
    return enhanced;
  });
}

/**
 * Calculate complexity of a business element
 * @param {string} text - Element text
 * @returns {string} Complexity level
 */
function calculateElementComplexity(text) {
  const lowerText = text.toLowerCase();
  let complexity = 1;
  
  if (lowerText.includes('if') || lowerText.includes('when') || lowerText.includes('where')) complexity += 1;
  if (lowerText.includes('and') || lowerText.includes('or')) complexity += 1;
  if (lowerText.includes('loop') || lowerText.includes('repeat')) complexity += 1;
  if (lowerText.includes('parallel') || lowerText.includes('concurrent')) complexity += 1;
  if (lowerText.includes('error') || lowerText.includes('exception')) complexity += 1;
  
  if (complexity <= 2) return 'simple';
  if (complexity <= 4) return 'moderate';
  return 'complex';
}

/**
 * Calculate quality score for a single business element
 * @param {Object} element - Business element object
 * @returns {number} Quality score 0-100
 */
function calculateQualityScore(element) {
  const text = element.text;
  const lowerText = text.toLowerCase();
  let score = 0;
  
  // Action Words (30% weight) - Must have clear action
  if (lowerText.includes('must')) score += 30;
  else if (lowerText.includes('should')) score += 25;
  else if (lowerText.includes('will')) score += 20;
  else if (lowerText.includes('shall')) score += 20;
  else if (lowerText.includes('can')) score += 15;
  else if (lowerText.includes('need')) score += 10;
  
  // Specificity (25% weight) - Must be specific and actionable
  if (lowerText.includes('verify') || lowerText.includes('check') || 
      lowerText.includes('ensure') || lowerText.includes('validate')) score += 25;
  else if (lowerText.includes('create') || lowerText.includes('update') || 
           lowerText.includes('delete') || lowerText.includes('modify')) score += 20;
  else if (lowerText.includes('display') || lowerText.includes('show') || 
           lowerText.includes('present') || lowerText.includes('render')) score += 15;
  else if (lowerText.includes('support') && lowerText.length > 60) score += 10; // Only if detailed
  else if (lowerText.includes('support')) score += 5; // Basic support gets low score
  
  // Completeness (20% weight) - Must be complete and clear
  if (text.trim().endsWith('.') || text.trim().endsWith('!') || text.trim().endsWith('?')) score += 20;
  else if (text.trim().endsWith(':')) score += 15;
  else if (text.trim().length > 40) score += 15;
  else if (text.trim().length > 30) score += 10;
  else if (text.trim().length > 25) score += 5;
  
  // Business Context (15% weight) - Must have clear business purpose
  if (lowerText.includes('customer') && lowerText.includes('can')) score += 15;
  else if (lowerText.includes('user') && lowerText.includes('must')) score += 15;
  else if (lowerText.includes('business') && lowerText.includes('process')) score += 15;
  else if (lowerText.includes('workflow') && lowerText.includes('step')) score += 15;
  else if (lowerText.includes('system') && lowerText.includes('should')) score += 10;
  else if (lowerText.includes('data') && lowerText.includes('validation')) score += 10;
  
  // Testability (10% weight) - Must be testable
  if (isElementTestable(text)) score += 10;
  
  // ENHANCED PENALTIES for poor quality
  if (lowerText.includes('page') && lowerText.length < 40) score -= 25; // Vague page references
  if (lowerText.includes('support') && lowerText.length < 60) score -= 20; // Vague support statements
  if (lowerText.includes('team') && lowerText.length < 50) score -= 15; // Vague team references
  if (lowerText.includes('customer') && lowerText.length < 50) score -= 15; // Vague customer references
  if (/^\d+\s+\d+\s+\d+/.test(text.trim())) score -= 35; // Just numbers
  if (lowerText.includes('the system should support') && lowerText.length < 60) score -= 30; // Vague support
  if (lowerText.includes('support page') && !lowerText.includes('user') && !lowerText.includes('customer')) score -= 25; // Page without context
  
  // BONUS POINTS for high quality
  if (lowerText.includes('given') && lowerText.includes('when') && lowerText.includes('then')) score += 10; // Acceptance criteria
  if (lowerText.includes('verify') && lowerText.includes('check')) score += 5; // Multiple validation words
  if (lowerText.includes('customer') && lowerText.includes('can') && lowerText.includes('access')) score += 5; // Clear user action
  
  return Math.max(0, Math.min(100, score)); // Ensure score is 0-100
}

/**
 * Check if element is testable
 * @param {string} text - Element text
 * @returns {boolean} True if testable
 */
function isElementTestable(text) {
  const lowerText = text.toLowerCase();
  
  // Must have clear action/outcome
  const hasAction = lowerText.includes('must') || lowerText.includes('should') || 
                   lowerText.includes('will') || lowerText.includes('shall');
  
  // Must have measurable outcome
  const hasOutcome = lowerText.includes('verify') || lowerText.includes('check') ||
                    lowerText.includes('ensure') || lowerText.includes('validate');
  
  return hasAction || hasOutcome;
}

/**
 * Generate comprehensive breakdown of business elements
 * @param {Array} elements - Processed elements
 * @returns {Object} Breakdown by type and priority
 */
function generateBreakdown(elements) {
  const breakdown = {
    byType: {},
    byPriority: {},
    byConfidence: {},
    byComplexity: {},
    byTestability: {}
  };

  // Count by type
  elements.forEach(element => {
    breakdown.byType[element.type] = (breakdown.byType[element.type] || 0) + 1;
    breakdown.byPriority[element.priority] = (breakdown.byPriority[element.priority] || 0) + 1;
    breakdown.byConfidence[element.confidence] = (breakdown.byConfidence[element.confidence] || 0) + 1;
    breakdown.byComplexity[element.complexity] = (breakdown.byComplexity[element.complexity] || 0) + 1;
    breakdown.byTestability[element.isTestable ? 'testable' : 'not_testable'] = 
      (breakdown.byTestability[element.isTestable ? 'testable' : 'not_testable'] || 0) + 1;
  });

  return breakdown;
}

/**
 * Calculate quality metrics for the extraction
 * @param {Array} elements - Processed elements
 * @param {number} contentLength - Original content length
 * @returns {Object} Quality metrics
 */
function calculateQualityMetrics(elements, contentLength) {
  const totalElements = elements.length;
  const highConfidenceElements = elements.filter(e => e.confidence === 'high').length;
  const testableElements = elements.filter(e => e.isTestable).length;
  
  return {
    totalElements,
    highConfidenceElements,
    testableElements,
    confidenceRatio: totalElements > 0 ? (highConfidenceElements / totalElements) : 0,
    testabilityRatio: totalElements > 0 ? (testableElements / totalElements) : 0,
    densityPerK: contentLength > 0 ? (totalElements / contentLength) * 1000 : 0,
    qualityScore: calculateOverallQualityScore(elements)
  };
}

/**
 * Calculate overall quality score
 * @param {Array} elements - Processed elements
 * @returns {number} Quality score 0-100
 */
function calculateOverallQualityScore(elements) {
  if (elements.length === 0) return 0;
  
  let score = 0;
  
  // Confidence scoring
  const confidenceScores = { high: 1.0, medium: 0.7, low: 0.4 };
  const avgConfidence = elements.reduce((sum, e) => sum + confidenceScores[e.confidence], 0) / elements.length;
  
  // Testability scoring
  const testabilityRatio = elements.filter(e => e.isTestable).length / elements.length;
  
  // Complexity distribution scoring
  const complexityScores = { simple: 1.0, moderate: 0.8, complex: 0.6 };
  const avgComplexity = elements.reduce((sum, e) => sum + complexityScores[e.complexity], 0) / elements.length;
  
  score = (avgConfidence * 0.4) + (testabilityRatio * 0.4) + (avgComplexity * 0.2);
  
  return Math.round(score * 100);
}

module.exports = {
  extractBusinessRequirements,
  UNIVERSAL_BUSINESS_PATTERNS,
  extractElementsFromLine,
  isTechnicalContent,
  hasBusinessContent,
  isExtractableRequirement,
  postProcessElements,
  calculateElementComplexity,
  isElementTestable,
  generateBreakdown,
  calculateQualityMetrics,
  calculateOverallQualityScore,
  calculateQualityScore
};
