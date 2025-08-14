/**
 * Workflow Analysis Utility
 * Analyzes business process documents and calculates cyclomatic complexity
 */

// Keywords that indicate workflow elements
const WORKFLOW_KEYWORDS = {
  decisionPoints: [
    'gateway', 'decision', 'exclusive gateway', 'parallel gateway', 'inclusive gateway',
    'conditional', 'if', 'else', 'switch', 'case', 'branch', 'fork', 'join',
    'exclusive', 'parallel', 'inclusive', 'xor', 'and', 'or'
  ],
  activities: [
    'task', 'user task', 'service task', 'subprocess', 'activity', 'action',
    'process', 'step', 'operation', 'function', 'method', 'procedure',
    'workflow', 'flow', 'sequence', 'loop', 'iteration'
  ],
  events: [
    'start event', 'end event', 'intermediate event', 'trigger', 'signal',
    'message', 'timer', 'error', 'cancel', 'terminate'
  ],
  connectors: [
    'flow', 'sequence flow', 'message flow', 'association', 'data flow',
    'control flow', 'conditional flow', 'default flow'
  ]
};

/**
 * Analyze text content for workflow elements
 * @param {string} content - Document content to analyze
 * @returns {Object} Analysis results with counts and complexity
 */
function analyzeWorkflowContent(content) {
  const text = content.toLowerCase();
  const analysis = {
    decisionPoints: 0,
    activities: 0,
    events: 0,
    connectors: 0,
    edges: 0,        // New: count actual transitions/flows
    nodes: 0,        // New: count all workflow elements
    components: 1,   // New: assume single workflow component
    totalElements: 0,
    cyclomaticComplexity: 0,
    workflowDetected: false,
    complexityLevel: 'simple'
  };

  // Count workflow elements
  WORKFLOW_KEYWORDS.decisionPoints.forEach(keyword => {
    const regex = new RegExp(keyword, 'gi');
    const matches = text.match(regex);
    if (matches) {
      analysis.decisionPoints += matches.length;
    }
  });

  WORKFLOW_KEYWORDS.activities.forEach(keyword => {
    const regex = new RegExp(keyword, 'gi');
    const matches = text.match(regex);
    if (matches) {
      analysis.activities += matches.length;
    }
  });

  WORKFLOW_KEYWORDS.events.forEach(keyword => {
    const regex = new RegExp(keyword, 'gi');
    const matches = text.match(regex);
    if (matches) {
      analysis.events += matches.length;
    }
  });

  WORKFLOW_KEYWORDS.connectors.forEach(keyword => {
    const regex = new RegExp(keyword, 'gi');
    const matches = text.match(regex);
    if (matches) {
      analysis.connectors += matches.length;
    }
  });

  // Calculate edges (transitions) - estimate based on connectors and decision points
  analysis.edges = analysis.connectors + analysis.decisionPoints;
  
  // Calculate total nodes (all workflow elements)
  analysis.nodes = analysis.decisionPoints + analysis.activities + analysis.events;
  
  // Calculate total elements
  analysis.totalElements = analysis.nodes + analysis.connectors;

  // Calculate cyclomatic complexity using the better formula: CC = E - N + 2P
  analysis.cyclomaticComplexity = Math.max(1, analysis.edges - analysis.nodes + (2 * analysis.components));

  // Determine if workflow is detected
  analysis.workflowDetected = analysis.decisionPoints > 0 || analysis.activities > 5 || analysis.connectors > 3;

  // Determine complexity level based on the new formula
  if (analysis.cyclomaticComplexity <= 3) {
    analysis.complexityLevel = 'simple';
  } else if (analysis.cyclomaticComplexity <= 10) {
    analysis.complexityLevel = 'moderate';
  } else if (analysis.cyclomaticComplexity <= 20) {
    analysis.complexityLevel = 'complex';
  } else {
    analysis.complexityLevel = 'very complex';
  }

  return analysis;
}

/**
 * Generate complexity description for a requirement
 * @param {Object} analysis - Workflow analysis results
 * @param {string} requirementText - The specific requirement text
 * @returns {string} Formatted complexity description
 */
function generateComplexityDescription(analysis, requirementText = '') {
  const reqText = requirementText.toLowerCase();
  
  // Analyze this specific requirement for workflow elements
  const reqAnalysis = analyzeWorkflowContent(requirementText);
  
  // Check if this specific requirement involves workflows
  const hasWorkflowElements = WORKFLOW_KEYWORDS.decisionPoints.some(keyword => 
    reqText.includes(keyword)
  ) || WORKFLOW_KEYWORDS.activities.some(keyword => 
    reqText.includes(keyword)
  );

  if (!hasWorkflowElements && reqAnalysis.decisionPoints === 0) {
    return 'CC: 1, Decision Points: 0, Activities: 1, Paths: 1';
  }

  // Use requirement-specific analysis for more accurate complexity
  const localCC = Math.max(1, reqAnalysis.decisionPoints - reqAnalysis.activities + 2);
  const estimatedPaths = Math.max(1, Math.pow(2, Math.min(reqAnalysis.decisionPoints, 6)));

  return `CC: ${localCC}, Decision Points: ${reqAnalysis.decisionPoints}, Activities: ${reqAnalysis.activities}, Paths: ${estimatedPaths}`;
}

/**
 * Analyze BPMN-like content for specific workflow patterns
 * @param {string} content - Content that might contain BPMN elements
 * @returns {Object} Detailed workflow analysis
 */
function analyzeBPMNContent(content) {
  const text = content.toLowerCase();
  
  // Look for specific BPMN patterns
  const patterns = {
    exclusiveGateways: (text.match(/exclusive gateway|xor gateway|decision gateway/gi) || []).length,
    parallelGateways: (text.match(/parallel gateway|fork gateway|join gateway/gi) || []).length,
    inclusiveGateways: (text.match(/inclusive gateway|or gateway/gi) || []).length,
    userTasks: (text.match(/user task/gi) || []).length,
    serviceTasks: (text.match(/service task/gi) || []).length,
    subprocesses: (text.match(/subprocess|sub-process/gi) || []).length,
    startEvents: (text.match(/start event/gi) || []).length,
    endEvents: (text.match(/end event/gi) || []).length,
    intermediateEvents: (text.match(/intermediate event/gi) || []).length,
    sequenceFlows: (text.match(/sequence flow/gi) || []).length
  };

  const totalDecisionPoints = patterns.exclusiveGateways + patterns.parallelGateways + patterns.inclusiveGateways;
  const totalActivities = patterns.userTasks + patterns.serviceTasks + patterns.subprocesses;
  const totalEvents = patterns.startEvents + patterns.endEvents + patterns.intermediateEvents;

  return {
    patterns,
    totalDecisionPoints,
    totalActivities,
    totalEvents,
    sequenceFlows: patterns.sequenceFlows,
    cyclomaticComplexity: Math.max(1, totalDecisionPoints - totalActivities + 2),
    workflowType: totalDecisionPoints > 0 ? 'complex' : 'simple'
  };
}

/**
 * Intelligently categorize requirements and assign complexity
 * @param {string} requirementText - The requirement text
 * @param {string} acceptanceCriteria - The acceptance criteria
 * @returns {string} Appropriate complexity description
 */
function categorizeRequirementComplexity(requirementText, acceptanceCriteria) {
  const reqText = (requirementText + ' ' + acceptanceCriteria).toLowerCase();
  
  // Simple requirements (no workflows, basic functionality)
  if (reqText.includes('login') || reqText.includes('logout') || 
      reqText.includes('view') || reqText.includes('display') ||
      reqText.includes('show') || reqText.includes('read')) {
    return 'CC: 1, Decision Points: 0, Activities: 1, Paths: 1';
  }
  
  // Form validation requirements
  if (reqText.includes('validate') || reqText.includes('input') || 
      reqText.includes('form') || reqText.includes('field')) {
    return 'CC: 3, Decision Points: 2, Activities: 3, Paths: 3';
  }
  
  // Basic CRUD operations
  if (reqText.includes('create') || reqText.includes('add') ||
      reqText.includes('update') || reqText.includes('edit') ||
      reqText.includes('delete') || reqText.includes('remove')) {
    return 'CC: 2, Decision Points: 1, Activities: 2, Paths: 2';
  }
  
  // Workflow requirements (approval, routing, etc.)
  if (reqText.includes('workflow') || reqText.includes('approval') ||
      reqText.includes('routing') || reqText.includes('process') ||
      reqText.includes('gateway') || reqText.includes('decision')) {
    // Analyze this specific requirement
    const reqAnalysis = analyzeWorkflowContent(reqText);
    const localCC = Math.max(1, reqAnalysis.decisionPoints - reqAnalysis.activities + 2);
    const estimatedPaths = Math.max(1, Math.pow(2, Math.min(reqAnalysis.decisionPoints, 6)));
    return `CC: ${localCC}, Decision Points: ${reqAnalysis.decisionPoints}, Activities: ${reqAnalysis.activities}, Paths: ${estimatedPaths}`;
  }
  
  // Integration requirements
  if (reqText.includes('integration') || reqText.includes('api') ||
      reqText.includes('service') || reqText.includes('external')) {
    return 'CC: 4, Decision Points: 3, Activities: 4, Paths: 4';
  }
  
  // Default for unknown types
  return 'CC: 2, Decision Points: 1, Activities: 2, Paths: 2';
}

/**
 * Validate test coverage against complexity requirements
 * @param {string} testContent - Generated test scenarios
 * @param {string} complexityInfo - Complexity information from requirement
 * @returns {Object} Coverage validation results
 */
function validateTestCoverage(testContent, complexityInfo) {
  try {
    // Extract paths count from complexity info
    const pathsMatch = complexityInfo.match(/Paths: (\d+)/);
    const expectedPaths = pathsMatch ? parseInt(pathsMatch[1]) : 1;
    
    // Count actual test scenarios
    const scenarioMatches = testContent.match(/Scenario:/g);
    const actualScenarios = scenarioMatches ? scenarioMatches.length : 0;
    
    // Count decision points and activities
    const decisionPointsMatch = complexityInfo.match(/Decision Points: (\d+)/);
    const activitiesMatch = complexityInfo.match(/Activities: (\d+)/);
    const expectedDecisionPoints = decisionPointsMatch ? parseInt(decisionPointsMatch[1]) : 0;
    const expectedActivities = activitiesMatch ? parseInt(activitiesMatch[1]) : 1;
    
    // Analyze test content for decision coverage
    const decisionKeywords = ['if', 'when', 'else', 'branch', 'condition', 'gateway'];
    const decisionCoverage = decisionKeywords.some(keyword => 
      testContent.toLowerCase().includes(keyword)
    );
    
    // Calculate coverage percentage
    const pathCoverage = Math.min(100, (actualScenarios / expectedPaths) * 100);
    const decisionCoveragePercentage = expectedDecisionPoints > 0 ? 
      (decisionCoverage ? 100 : 0) : 100;
    
    return {
      expectedPaths,
      actualScenarios,
      pathCoverage: Math.round(pathCoverage),
      expectedDecisionPoints,
      expectedActivities,
      decisionCoverage: Math.round(decisionCoveragePercentage),
      isAdequate: actualScenarios >= expectedPaths,
      recommendations: generateCoverageRecommendations(expectedPaths, actualScenarios, expectedDecisionPoints)
    };
  } catch (error) {
    console.error('Error validating test coverage:', error);
    return {
      expectedPaths: 1,
      actualScenarios: 0,
      pathCoverage: 0,
      isAdequate: false,
      recommendations: ['Error analyzing coverage']
    };
  }
}

/**
 * Generate coverage recommendations
 * @param {number} expectedPaths - Expected number of paths
 * @param {number} actualScenarios - Actual number of scenarios
 * @param {number} decisionPoints - Number of decision points
 * @returns {Array} List of recommendations
 */
function generateCoverageRecommendations(expectedPaths, actualScenarios, decisionPoints) {
  const recommendations = [];
  
  if (actualScenarios < expectedPaths) {
    recommendations.push(`Generate ${expectedPaths - actualScenarios} more test scenarios to cover all paths`);
  }
  
  if (decisionPoints > 0 && actualScenarios < decisionPoints * 2) {
    recommendations.push(`Consider creating separate scenarios for each decision branch`);
  }
  
  if (actualScenarios === 0) {
    recommendations.push('No test scenarios found. Generate comprehensive test coverage.');
  }
  
  if (actualScenarios >= expectedPaths) {
    recommendations.push('Good path coverage achieved. Consider adding edge case scenarios.');
  }
  
  return recommendations;
}

/**
 * Validate if AI-generated complexity values are reasonable
 * @param {string} requirementText - The requirement text
 * @param {string} complexityString - The complexity string from AI
 * @returns {Object} Validation result with warnings and suggestions
 */
function validateComplexityValues(requirementText, complexityString) {
  const validation = {
    isValid: true,
    warnings: [],
    suggestions: [],
    expectedComplexity: null
  };

  try {
    // Parse the complexity string
    const complexityMatch = complexityString.match(/CC:\s*(\d+),\s*Decision Points:\s*(\d+),\s*Activities:\s*(\d+),\s*Paths:\s*(\d+)/);
    
    if (!complexityMatch) {
      validation.isValid = false;
      validation.warnings.push('Complexity format is invalid. Expected: "CC: X, Decision Points: Y, Activities: Z, Paths: W"');
      return validation;
    }

    const [, cc, decisionPoints, activities, paths] = complexityMatch.map(Number);
    
    // Validate the formula: CC = Decision Points - Activities + 2
    const calculatedCC = decisionPoints - activities + 2;
    if (cc !== calculatedCC) {
      validation.isValid = false;
      validation.warnings.push(`Complexity calculation error: CC should be ${calculatedCC} (Decision Points: ${decisionPoints} - Activities: ${activities} + 2), but got ${cc}`);
    }

    // Check for reasonable values based on requirement content
    const text = requirementText.toLowerCase();
    
    // Simple requirements (login, basic CRUD)
    if (text.includes('login') || text.includes('logout') || text.includes('view') || text.includes('display')) {
      if (cc > 3) {
        validation.warnings.push('Complexity seems too high for a simple requirement. Consider reviewing.');
        validation.suggestions.push('Expected: CC: 1-3 for simple operations');
      }
    }
    
    // Form validation requirements
    if (text.includes('validate') || text.includes('check') || text.includes('verify')) {
      if (cc < 2 || cc > 6) {
        validation.warnings.push('Complexity seems unusual for validation logic. Consider reviewing.');
        validation.suggestions.push('Expected: CC: 2-6 for validation requirements');
      }
    }
    
    // Workflow requirements
    if (text.includes('workflow') || text.includes('process') || text.includes('approval') || text.includes('step')) {
      if (cc < 3) {
        validation.warnings.push('Complexity seems too low for a workflow requirement. Consider reviewing.');
        validation.suggestions.push('Expected: CC: 3+ for workflow requirements');
      }
    }

    // Check if paths make sense
    if (paths < cc) {
      validation.warnings.push('Number of paths should typically be >= cyclomatic complexity');
      validation.suggestions.push('Paths should cover all decision branches');
    }

    // Check for extreme values
    if (cc > 50) {
      validation.warnings.push('Extremely high complexity detected. Consider breaking down the requirement.');
      validation.suggestions.push('Break complex requirements into smaller, manageable pieces');
    }

    if (decisionPoints > 100) {
      validation.warnings.push('Very high number of decision points. Consider simplifying the logic.');
      validation.suggestions.push('Review if all decision points are necessary');
    }

    // Generate expected complexity based on content analysis
    const expectedCC = analyzeRequirementComplexity(requirementText);
    validation.expectedComplexity = expectedCC;

    if (Math.abs(cc - expectedCC) > 5) {
      validation.warnings.push(`Complexity differs significantly from expected (${expectedCC}). Consider reviewing.`);
    }

  } catch (error) {
    validation.isValid = false;
    validation.warnings.push(`Error parsing complexity: ${error.message}`);
  }

  return validation;
}

/**
 * Analyze requirement text to estimate expected complexity
 * @param {string} requirementText - The requirement text
 * @returns {number} Estimated cyclomatic complexity
 */
function analyzeRequirementComplexity(requirementText) {
  const text = requirementText.toLowerCase();
  let complexity = 1; // Base complexity

  // Add complexity for different patterns
  if (text.includes('if') || text.includes('when') || text.includes('condition')) complexity += 1;
  if (text.includes('validate') || text.includes('check')) complexity += 2;
  if (text.includes('workflow') || text.includes('process')) complexity += 3;
  if (text.includes('approval') || text.includes('step')) complexity += 2;
  if (text.includes('integration') || text.includes('api')) complexity += 2;
  if (text.includes('error') || text.includes('exception')) complexity += 1;
  if (text.includes('loop') || text.includes('repeat')) complexity += 2;
  if (text.includes('parallel') || text.includes('concurrent')) complexity += 3;

  return Math.min(complexity, 20); // Cap at reasonable maximum
}

module.exports = {
  analyzeWorkflowContent,
  generateComplexityDescription,
  analyzeBPMNContent,
  categorizeRequirementComplexity,
  validateTestCoverage,
  generateCoverageRecommendations,
  validateComplexityValues,
  analyzeRequirementComplexity,
  WORKFLOW_KEYWORDS
};
