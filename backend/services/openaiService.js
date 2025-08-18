const axios = require('axios');
const { analyzeWorkflowContent, generateComplexityDescription, categorizeRequirementComplexity } = require('../utils/workflowAnalyzer');

/**
 * Enhance complexity calculations in the extracted requirements
 * @param {string} requirements - The requirements table from AI
 * @param {Object} workflowAnalysis - Workflow analysis results
 * @returns {string} Enhanced requirements with improved complexity calculations
 */
function enhanceComplexityCalculations(requirements, workflowAnalysis) {
  try {
    const lines = requirements.split('\n');
    const enhancedLines = [];
    
    for (const line of lines) {
      if (line.includes('|') && line.includes('CC:')) {
        // This line already has complexity, enhance it if needed
        const enhancedLine = enhanceExistingComplexity(line, workflowAnalysis);
        enhancedLines.push(enhancedLine);
      } else if (line.includes('|') && !line.includes('CC:')) {
        // This line is missing complexity, add it
        const enhancedLine = addMissingComplexity(line, workflowAnalysis);
        enhancedLines.push(enhancedLine);
      } else {
        enhancedLines.push(line);
      }
    }
    
    return enhancedLines.join('\n');
  } catch (error) {
    console.error('Error enhancing complexity calculations:', error);
    return requirements; // Return original if enhancement fails
  }
}

/**
 * Enhance existing complexity calculation
 * @param {string} line - Table row with existing complexity
 * @param {Object} workflowAnalysis - Workflow analysis results
 * @returns {string} Enhanced line
 */
function enhanceExistingComplexity(line, workflowAnalysis) {
  // Extract requirement and acceptance criteria from the line
  const columns = line.split('|').map(col => col.trim()).filter(col => col);
  if (columns.length >= 4) {
    const [id, requirement, acceptanceCriteria, existingComplexity] = columns;
    
    // If the complexity looks too generic or is the same as global analysis, recalculate
    if (existingComplexity.includes('CC: 1, Decision Points: 0, Activities: 1, Paths: 1') || 
        existingComplexity.includes(`CC: ${workflowAnalysis.cyclomaticComplexity}`)) {
      
      // Use smart categorization for this specific requirement
      const smartComplexity = categorizeRequirementComplexity(requirement, acceptanceCriteria);
      return line.replace(existingComplexity, smartComplexity);
    }
  }
  return line;
}

/**
 * Add missing complexity calculation
 * @param {string} line - Table row without complexity
 * @param {Object} workflowAnalysis - Workflow analysis results
 * @returns {string} Enhanced line
 */
function addMissingComplexity(line, workflowAnalysis) {
  if (line.trim().endsWith('|')) {
    // Extract requirement and acceptance criteria from the line
    const columns = line.split('|').map(col => col.trim()).filter(col => col);
    if (columns.length >= 3) {
      const [id, requirement, acceptanceCriteria] = columns;
      
      // Use smart categorization for this specific requirement
      const smartComplexity = categorizeRequirementComplexity(requirement, acceptanceCriteria);
      return line + ` ${smartComplexity} |`;
    }
  }
  return line;
}

const OPENAI_URL = process.env.OPENAI_URL;
const OPENAI_DEVELOPMENT_ID = process.env.OPENAI_DEVELOPMENT_ID;
const OPENAI_API_VERSION = process.env.OPENAI_API_VERSION;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const isAzureOpenAIConfigured = OPENAI_URL && OPENAI_DEVELOPMENT_ID && OPENAI_API_VERSION && OPENAI_API_KEY;

// Generate test cases using Azure OpenAI
async function generateTestCases(content, context = '') {
  
  if (!isAzureOpenAIConfigured) {
    throw new Error('Azure OpenAI is not configured');
  }
  
  // Check if content is sufficient
  if (!content || content.trim().length < 100) {
    throw new Error('Insufficient content. Please provide more detailed content for test generation');
  }

  // Clean up the URL to prevent duplication
  let baseUrl = OPENAI_URL;
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  
  // Remove any existing /openai/deployments/ from the URL
  baseUrl = baseUrl.replace(/\/openai\/deployments\/?$/, '');
  
  const apiUrl = `${baseUrl}/openai/deployments/${OPENAI_DEVELOPMENT_ID}/chat/completions?api-version=${OPENAI_API_VERSION}`;
  


  const messages = [
    {
      role: 'system',
      content: `You are a Test Automation Architect creating Cucumber test cases in Gherkin syntax.

Your task is to analyze the EXACT requirement and acceptance criteria provided and generate test scenarios that cover EVERY execution path identified in the complexity analysis.

IMPORTANT: You must generate test scenarios that are SPECIFIC to the provided business requirement and acceptance criteria. Do NOT generate generic test scenarios.

PATH COVERAGE REQUIREMENTS:
- Analyze the complexity information from the requirement (CC, Decision Points, Paths)
- Generate test scenarios that cover EVERY identified execution path
- The number of test scenarios should match or exceed the "Paths" count
- Each decision point should have separate test scenarios for each branch
- Ensure complete coverage of all conditional logic and workflow branches

For each acceptance criteria, generate comprehensive test scenarios including:

POSITIVE TEST SCENARIOS:
- Happy path scenarios (main success flow)
- Valid data variations
- Different user roles/permissions
- Various input combinations
- Successful edge cases

NEGATIVE TEST SCENARIOS:
- Invalid input scenarios (empty fields, special characters, very long text)
- Error conditions and exception handling
- Boundary value testing (minimum/maximum values)
- Invalid data formats and malformed inputs
- Business rule violations
- Invalid state transitions
- Security-related negative scenarios

WORKFLOW PATH SCENARIOS:
- Test each decision branch separately
- Cover all gateway conditions (exclusive, parallel, inclusive)
- Test all possible workflow paths
- Include error paths and exception handling
- Test parallel execution paths

DATA-DRIVEN SCENARIOS:
- Scenario outlines with multiple examples
- Different data combinations
- Various test conditions

CRITICAL REQUIREMENTS:
- Generate ONLY pure Gherkin syntax (Feature, Scenario, Given, When, Then, And, But)
- Generate ENOUGH scenarios to cover ALL identified paths from complexity analysis
- Include both positive scenarios and negative/edge case scenarios
- Use descriptive scenario names that clearly indicate what is being tested
- Do NOT generate generic test scenarios
- Do NOT include any explanations, comments, or descriptions about the test cases
- Do NOT include sections like "### Explanation:", "This Gherkin syntax covers...", "Certainly! Below are...", or any introductory/concluding remarks
- Do NOT include example scenarios or sample test cases
- Do NOT include any text that starts with "Example:", "Sample:", "Here's an example:", or similar
- Start directly with 'Feature:' and end with the last test scenario
- Ensure the output is ready to be saved directly as a .feature file
- Each scenario should test a different execution path or decision branch
- Output ONLY the actual test scenarios, nothing else
- The Feature name and scenarios must be based on the SPECIFIC business requirement provided
- PATH COVERAGE IS MANDATORY: Generate scenarios for every path identified in the complexity analysis`
    },
    {
      role: 'user',
      content: `IMPORTANT: You are testing the EXACT requirement provided below. Generate test scenarios ONLY for this specific requirement.

REQUIREMENT TO TEST:
${content}

Additional context: ${context}

PATH COVERAGE REQUIREMENTS:
- Analyze the complexity information (CC, Decision Points, Paths) from the requirement
- Generate test scenarios that cover EVERY identified execution path
- The number of test scenarios should match or exceed the "Paths" count
- Each decision point should have separate test scenarios for each branch
- Ensure complete coverage of all conditional logic and workflow branches

CRITICAL REQUIREMENTS:
- Generate test scenarios that are SPECIFIC to the business requirement and acceptance criteria provided above
- Do NOT generate generic test scenarios like "User Registration" or "Login"
- Do NOT create test scenarios for functionality not mentioned in the requirement
- Each scenario must directly relate to the provided business requirement and acceptance criteria
- Generate ENOUGH scenarios to cover ALL identified paths from complexity analysis
- Each scenario should test a different execution path or decision branch
- Output ONLY the actual Gherkin test scenarios
- Do NOT include any examples, explanations, or sample scenarios
- Start directly with 'Feature:' and end with the last test scenario
- The Feature name should be based on the business requirement provided
- If the requirement mentions "ProQuest Orders", the Feature should be about "ProQuest Orders"
- If the requirement mentions "Salesforce", the scenarios should involve "Salesforce"
- Use the EXACT terminology from the requirement in your test scenarios
- PATH COVERAGE IS MANDATORY: Generate scenarios for every path identified in the complexity analysis`
    }
  ];

  try {
    const response = await axios.post(
      apiUrl,
      {
        messages: messages,
        max_tokens: 2000,
        temperature: 0.7,
        response_format: { type: "text" }
      },
      {
        headers: {
          'api-key': OPENAI_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );



    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
      throw new Error(`Invalid response structure from Azure OpenAI: ${JSON.stringify(response.data)}`);
    }

    // Check if content was filtered
    if (response.data.choices[0].finish_reason === 'content_filter') {
      const filterResults = response.data.choices[0].content_filter_results;
      const filteredCategories = Object.entries(filterResults)
        .filter(([_, result]) => result.filtered)
        .map(([category, result]) => `${category}: ${result.severity}`)
        .join(', ');
      
      throw new Error(`Content was filtered by Azure OpenAI safety filters: ${filteredCategories}. Please try rephrasing your request or using different content.`);
    }

    // Check if message has content
    if (!response.data.choices[0].message.content) {
      throw new Error(`No content received from Azure OpenAI. Response: ${JSON.stringify(response.data.choices[0])}`);
    }

    let generatedTests = response.data.choices[0].message.content;

    // Clean up any explanations that might have slipped through
    const cleanGeneratedTests = generatedTests
      .replace(/### Explanation:[\s\S]*?(?=Feature:|$)/gi, '') // Remove explanation sections
      .replace(/This Gherkin syntax covers[\s\S]*?(?=Feature:|$)/gi, '') // Remove introductory explanations
      .replace(/Certainly! Below are[\s\S]*?(?=Feature:|$)/gi, '') // Remove "Certainly! Below are..."
      .replace(/The following Gherkin scenarios[\s\S]*?(?=Feature:|$)/gi, '') // Remove "The following Gherkin scenarios..."
      .replace(/Here are the Gherkin test cases[\s\S]*?(?=Feature:|$)/gi, '') // Remove "Here are the Gherkin test cases..."
      .replace(/```gherkin\\n/gi, '') // Remove leading ```gherkin
      .replace(/```\\n/gi, '') // Remove trailing ```
      .trim(); // Trim any leading/trailing whitespace

    return cleanGeneratedTests;
  } catch (error) {
    console.error('Azure OpenAI API Error:', error.response?.data || error.message);
    throw new Error(`Azure OpenAI API Error: ${error.response?.status || error.message}`);
  }
}

// Validate that refined content preserves original scenario names and feature name
function validateScenarioNamePreservation(originalContent, refinedContent) {
  // Extract original feature name
  const originalFeatureMatch = originalContent.match(/^Feature:\s*(.+)$/m);
  const originalFeatureName = originalFeatureMatch ? originalFeatureMatch[1].trim() : '';
  
  // Extract refined feature name
  const refinedFeatureMatch = refinedContent.match(/^Feature:\s*(.+)$/m);
  const refinedFeatureName = refinedFeatureMatch ? refinedFeatureMatch[1].trim() : '';
  
  // Check if feature name was changed
  if (originalFeatureName && refinedFeatureName && originalFeatureName !== refinedFeatureName) {
    console.warn('⚠️  Feature name was changed during refinement. Restoring original feature name.');
    // Restore original feature name
    refinedContent = refinedContent.replace(/^Feature:\s*.+$/m, `Feature: ${originalFeatureName}`);
  }
  
  // Extract original scenario names
  const originalScenarios = [];
  const originalLines = originalContent.split('\n');
  
  for (const line of originalLines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('Scenario:') || trimmedLine.startsWith('Scenario Outline:')) {
      const scenarioName = trimmedLine.replace('Scenario:', '').replace('Scenario Outline:', '').trim();
      if (scenarioName) {
        originalScenarios.push(scenarioName);
      }
    }
  }
  
  // Extract refined scenario names
  const refinedScenarios = [];
  const refinedLines = refinedContent.split('\n');
  
  for (const line of refinedLines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('Scenario:') || trimmedLine.startsWith('Scenario Outline:')) {
      const scenarioName = trimmedLine.replace('Scenario:', '').replace('Scenario Outline:', '').trim();
      if (scenarioName) {
        refinedScenarios.push(scenarioName);
      }
    }
  }
  
  // Check if all original scenarios are preserved
  const missingScenarios = originalScenarios.filter(original => 
    !refinedScenarios.some(refined => refined === original)
  );
  
  if (missingScenarios.length > 0) {
    console.warn('⚠️  Some original scenarios were not preserved during refinement:', missingScenarios);
    
    // Try to restore missing scenarios by finding them in the original content
    let restoredContent = refinedContent;
    
    for (const missingScenario of missingScenarios) {
      // Find the original scenario content
      let inScenario = false;
      let scenarioContent = '';
      
      for (let i = 0; i < originalLines.length; i++) {
        const line = originalLines[i].trim();
        
        if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
          if (inScenario) {
            break; // End of previous scenario
          }
          
          const scenarioName = line.replace('Scenario:', '').replace('Scenario Outline:', '').trim();
          if (scenarioName === missingScenario) {
            inScenario = true;
            scenarioContent = line + '\n';
          }
        } else if (inScenario) {
          if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:') || line.startsWith('Feature:')) {
            break; // End of current scenario
          }
          scenarioContent += line + '\n';
        }
      }
      
      // Add the missing scenario to the refined content
      if (scenarioContent) {
        restoredContent += '\n' + scenarioContent.trim();
        console.log(`✅ Restored missing scenario: ${missingScenario}`);
      }
    }
    
    return restoredContent;
  } else {
    console.log('✅ All original scenarios were preserved during refinement');
  }
  
      // Check if new scenarios follow the same naming convention
    const newScenarios = refinedScenarios.filter(refined => 
      !originalScenarios.some(original => original === refined)
    );
    
    if (newScenarios.length > 0) {
      console.log(`✅ Added ${newScenarios.length} new scenarios during refinement`);
      
      // Validate naming convention for new scenarios
      if (originalScenarios.length > 0) {
        const namingPattern = detectNamingPattern(originalScenarios);
        if (namingPattern) {
                   if (namingPattern.type === 'jira-tab') {
           console.log(`🔍 Detected Jira tab naming pattern: ${namingPattern.prefix}`);
          // For Jira tab patterns, ensure all new scenarios use the exact same prefix
          const invalidNewScenarios = newScenarios.filter(scenario => {
            const match = scenario.match(namingPattern.pattern);
            if (!match) return true; // No pattern match
            
            const newPrefix = match[1];
            return newPrefix !== namingPattern.prefix; // Different prefix
          });
          
          if (invalidNewScenarios.length > 0) {
            console.warn('⚠️  Some new scenarios do not use the correct tab prefix. Expected:', namingPattern.prefix);
            console.warn('Invalid scenarios:', invalidNewScenarios);
            
            // Auto-correct new scenarios to use the correct prefix
            let correctedContent = refinedContent;
            for (const invalidScenario of invalidNewScenarios) {
              const correctedScenario = invalidScenario.replace(
                /^([A-Z]+-\d+-\d+):\s*(.+)/,
                `${namingPattern.prefix}: $2`
              );
              correctedContent = correctedContent.replace(invalidScenario, correctedScenario);
              console.log(`✅ Auto-corrected scenario prefix: ${invalidScenario} → ${correctedScenario}`);
            }
            refinedContent = correctedContent;
          }
        } else {
          // For other patterns, just check if they match the pattern
          const invalidNewScenarios = newScenarios.filter(scenario => 
            !scenario.match(namingPattern.pattern)
          );
          
          if (invalidNewScenarios.length > 0) {
            console.warn('⚠️  Some new scenarios do not follow the original naming convention:', invalidNewScenarios);
          }
        }
      }
    }
  }
  
  return refinedContent;
}

// Detect naming pattern from existing scenarios
function detectNamingPattern(scenarios) {
  if (scenarios.length === 0) return null;
  
  // Check for Jira ticket + tab pattern (e.g., "QAE-162-003: Display error message")
  const jiraTabPattern = /^([A-Z]+-\d+-\d+):\s*.+/;
  if (scenarios.every(scenario => jiraTabPattern.test(scenario))) {
    // Extract the prefix (e.g., "QAE-162-003")
    const firstMatch = scenarios[0].match(jiraTabPattern);
    if (firstMatch) {
      return {
        pattern: jiraTabPattern,
        prefix: firstMatch[1], // e.g., "QAE-162-003"
        type: 'jira-tab'
      };
    }
  }
  
  // Check for requirement ID pattern (e.g., "BR-001: User Login")
  const requirementIdPattern = /^[A-Z]{2}-\d+:\s*.+/;
  if (scenarios.every(scenario => requirementIdPattern.test(scenario))) {
    return {
      pattern: requirementIdPattern,
      type: 'requirement-id'
    };
  }
  
  // Check for simple descriptive pattern
  const descriptivePattern = /^[A-Z][a-z\s]+$/;
  if (scenarios.every(scenario => descriptivePattern.test(scenario))) {
    return {
      pattern: descriptivePattern,
      type: 'descriptive'
    };
  }
  
  return null;
}

// Test function for naming pattern detection (can be removed in production)
function testNamingPatternDetection() {
  const testScenarios = [
    'QAE-162-003: Display error message when invalid input',
    'QAE-162-003: Successfully display valid data',
    'QAE-162-003: Handle edge case scenarios'
  ];
  
  const pattern = detectNamingPattern(testScenarios);
  console.log('Test pattern detection:', pattern);
  // Should output: { pattern: /^([A-Z]+-\d+-\d+):\s*.+/, prefix: "QAE-162-003", type: "jira-tab" }
}

// Refine test cases using Azure OpenAI
async function refineTestCases(content, feedback, context = '') {
  if (!isAzureOpenAIConfigured) {
    throw new Error('Azure OpenAI is not configured');
  }

  // Clean up the URL to prevent duplication
  let baseUrl = OPENAI_URL;
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  
  // Remove any existing /openai/deployments/ from the URL
  baseUrl = baseUrl.replace(/\/openai\/deployments\/?$/, '');
  
  const apiUrl = `${baseUrl}/openai/deployments/${OPENAI_DEVELOPMENT_ID}/chat/completions?api-version=${OPENAI_API_VERSION}`;

  const messages = [
    {
      role: 'system',
      content: `You are a Test Automation Architect specializing in analysing documents and creating comprehensive Cucumber test cases in Gherkin syntax.

Your task is to refine the provided test cases based on the feedback given. When refining, ensure comprehensive coverage including:

POSITIVE TEST SCENARIOS:
- Happy path scenarios
- Business rules and acceptance criteria
- Data-driven scenarios with multiple examples

EDGE CASES AND NEGATIVE TEST SCENARIOS:
- Boundary value testing (minimum/maximum values)
- Invalid input scenarios (empty fields, special characters, very long text)
- Error conditions and exception handling
- Invalid data formats and malformed inputs
- Timeout and performance edge cases
- Security-related negative scenarios
- Business rule violations
- Invalid state transitions
- Network/connectivity failures
- Data validation failures

CRITICAL REQUIREMENTS:
- Generate ONLY pure Gherkin syntax (Feature, Scenario, Given, When, Then, And, But)
- Include both positive scenarios and negative/edge case scenarios
- Use descriptive scenario names that clearly indicate positive vs negative testing
- Do NOT include any explanations, comments, or descriptions about the test cases.
- Do NOT include sections like "### Explanation:", "This Gherkin syntax covers...", "Certainly! Below are...", or any introductory/concluding remarks.
- Start directly with 'Feature:' and end with the last test scenario.
- Ensure the output is ready to be saved directly as a .feature file.

SCENARIO NAMING PRESERVATION:
- PRESERVE the original scenario names exactly as they appear in the provided content
- Do NOT change, modify, or rename existing scenarios
- When adding new scenarios, follow the same naming convention used in the original content
- If the original content uses requirement IDs (e.g., "BR-001: User Login"), maintain that format for new scenarios
- If the original content uses Jira ticket + tab format (e.g., "QAE-162-003: Display error message"), ALL new scenarios MUST use the EXACT same prefix (e.g., "QAE-162-003: New scenario description")
- Do NOT increment tab numbers or change the prefix - keep the exact same identifier for all scenarios
- Keep the exact same Feature name and structure`
    },
    {
      role: 'user',
      content: `Refine the following Gherkin test cases based on this feedback: "${feedback}"

IMPORTANT: You must preserve all existing scenario names exactly as they are. Do NOT change, rename, or modify any existing scenarios.

CRITICAL NAMING REQUIREMENT: If the scenarios use a Jira ticket + tab format (e.g., "QAE-162-003: Display error message"), ALL new scenarios you create MUST use the EXACT same prefix (e.g., "QAE-162-003: New scenario description"). Do NOT increment tab numbers or change the prefix.

Current test cases:
${content}

Additional context: ${context}

Remember: Keep all existing scenario names unchanged and follow the same naming convention when adding new scenarios. Maintain the exact same prefix for all scenarios.`
    }
  ];

  try {
    const response = await axios.post(
      apiUrl,
      {
        messages: messages,
        max_tokens: 2000,
        temperature: 0.7,
        response_format: { type: "text" }
      },
      {
        headers: {
          'api-key': OPENAI_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );



    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
      throw new Error(`Invalid response structure from Azure OpenAI: ${JSON.stringify(response.data)}`);
    }

    // Check if content was filtered
    if (response.data.choices[0].finish_reason === 'content_filter') {
      const filterResults = response.data.choices[0].content_filter_results;
      const filteredCategories = Object.entries(filterResults)
        .filter(([_, result]) => result.filtered)
        .map(([category, result]) => `${category}: ${result.severity}`)
        .join(', ');
      
      throw new Error(`Content was filtered by Azure OpenAI safety filters: ${filteredCategories}. Please try rephrasing your request or using different content.`);
    }

    // Check if message has content
    if (!response.data.choices[0].message.content) {
      throw new Error(`No content received from Azure OpenAI. Response: ${JSON.stringify(response.data.choices[0])}`);
    }

    let refinedTests = response.data.choices[0].message.content;

    // Clean up any explanations that might have slipped through
    const cleanRefinedTests = refinedTests
      .replace(/### Explanation:[\s\S]*?(?=Feature:|$)/gi, '') // Remove explanation sections
      .replace(/This Gherkin syntax covers[\s\S]*?(?=Feature:|$)/gi, '') // Remove introductory explanations
      .replace(/Certainly! Below are[\s\S]*?(?=Feature:|$)/gi, '') // Remove "Certainly! Below are..."
      .replace(/The following Gherkin scenarios[\s\S]*?(?=Feature:|$)/gi, '') // Remove "The following Gherkin scenarios..."
      .replace(/Here are the Gherkin test cases[\s\S]*?(?=Feature:|$)/gi, '') // Remove "Here are the Gherkin test cases..."
      .replace(/```gherkin\\n/gi, '') // Remove leading ```gherkin
      .replace(/```\\n/gi, '') // Remove trailing ```
      .trim(); // Trim any leading/trailing whitespace

    // Validate that original scenario names are preserved
    const validatedRefinedTests = validateScenarioNamePreservation(content, cleanRefinedTests);
    
    // Log refinement summary
    const originalScenarios = (content.match(/Scenario:/g) || []).length;
    const refinedScenarios = (validatedRefinedTests.match(/Scenario:/g) || []).length;
    console.log(`✅ Refinement completed: ${originalScenarios} original scenarios, ${refinedScenarios} refined scenarios`);

    return validatedRefinedTests;
  } catch (error) {
    console.error('Azure OpenAI API Error:', error.response?.data || error.message);
    throw new Error(`Azure OpenAI API Error: ${error.response?.status || error.message}`);
  }
}

// Validate consistency of extracted requirements
function validateRequirementsConsistency(extractedRequirements, originalContent) {
  const issues = [];
  let requirementCount = 0;
  let consistencyScore = 100;
  
  try {
    // Count requirements (more flexible pattern matching)
    const requirementMatches = extractedRequirements.match(/\| BR-\d+\s*\|/g);
    requirementCount = requirementMatches ? requirementMatches.length : 0;
    
    // If no requirements found with strict pattern, try more flexible matching
    if (requirementCount === 0) {
      const flexibleMatches = extractedRequirements.match(/BR-\d+/g);
      requirementCount = flexibleMatches ? flexibleMatches.length : 0;
      if (requirementCount > 0) {
        console.log(`ℹ️  Found ${requirementCount} requirements with flexible pattern matching`);
      }
    }
    
    // Check for table structure consistency (more flexible)
    const tableRows = extractedRequirements.split('\n').filter(line => line.includes('|'));
    const validRows = tableRows.filter(row => row.split('|').length >= 4);
    
    // Allow for some flexibility in table structure
    const expectedRows = requirementCount + 1; // +1 for header row
    const rowDifference = Math.abs(validRows.length - expectedRows);
    
    if (rowDifference > 2) { // Allow up to 2 rows difference
      issues.push(`Table structure inconsistency: Expected ${expectedRows} rows, found ${validRows.length} (difference: ${rowDifference})`);
      consistencyScore -= 10; // Reduced penalty for table structure issues
    } else if (rowDifference > 0) {
      console.log(`ℹ️  Table structure has minor differences: Expected ${expectedRows} rows, found ${validRows.length}`);
    }
    
    // Check for sequential numbering
    const requirementIds = [];
    for (let i = 1; i <= requirementCount; i++) {
      const expectedId = `BR-${String(i).padStart(3, '0')}`;
      if (!extractedRequirements.includes(expectedId)) {
        issues.push(`Missing sequential requirement ID: ${expectedId}`);
        consistencyScore -= 10;
      }
      requirementIds.push(expectedId);
    }
    
    // Check for duplicate IDs
    const duplicateIds = requirementIds.filter(id => {
      const regex = new RegExp(`\\| ${id} \\|`, 'g');
      const matches = extractedRequirements.match(regex);
      return matches && matches.length > 1;
    });
    
    if (duplicateIds.length > 0) {
      issues.push(`Duplicate requirement IDs found: ${duplicateIds.join(', ')}`);
      consistencyScore -= 15;
    }
    
    // Check for reasonable requirement extraction based on content
    const contentLength = originalContent.length;
    if (contentLength < 1000 && requirementCount > 8) {
      issues.push(`Very high requirement count (${requirementCount}) for short content (${contentLength} chars) - may indicate over-extraction`);
      consistencyScore -= 15;
    } else if (contentLength > 10000 && requirementCount < 2) {
      issues.push(`Very low requirement count (${requirementCount}) for long content (${contentLength} chars) - may indicate under-extraction`);
      consistencyScore -= 15;
    }
    
    // Ensure consistency score doesn't go below 0
    consistencyScore = Math.max(0, consistencyScore);
    
  } catch (error) {
    issues.push(`Validation error: ${error.message}`);
    consistencyScore = 0;
  }
  
  return {
    requirementCount,
    consistencyScore,
    issues,
    isValid: consistencyScore >= 80
  };
}



// Extract business requirements and acceptance criteria from documents
async function extractBusinessRequirements(content, context = '', enableLogging = true) {
  if (!isAzureOpenAIConfigured) {
    throw new Error('Azure OpenAI is not configured');
  }

  // Generate unique request ID for tracking
  const requestId = Math.random().toString(36).substring(2, 15);
  
  // Create a content hash for consistency tracking
  const contentHash = require('crypto').createHash('md5').update(content.trim()).digest('hex').substring(0, 8);
  
  if (enableLogging) {
    console.log(`🔍 [${requestId}] Starting requirements extraction...`);
    console.log(`🔍 [${requestId}] Content hash: ${contentHash} (for consistency tracking)`);
    console.log(`🔍 [${requestId}] Content length: ${content.length} characters`);
    
    // Check if this content hash has been processed before (for consistency monitoring)
    if (global.contentHashHistory && global.contentHashHistory[contentHash]) {
      const previousCount = global.contentHashHistory[contentHash].requirementCount;
      console.log(`⚠️  [${requestId}] Content hash ${contentHash} detected before with ${previousCount} requirements - monitoring for consistency`);
    }
    
    // Store content hash history for consistency monitoring
    if (!global.contentHashHistory) global.contentHashHistory = {};
    global.contentHashHistory[contentHash] = {
      timestamp: new Date().toISOString(),
      requestId: requestId,
      contentLength: content.length,
      requirementCount: null // Will be updated after extraction
    };
  }

  // Check if content is sufficient
  if (!content || content.trim().length < 50) {
    throw new Error('Insufficient content. Please provide more detailed content for requirement extraction');
  }

  // Handle large documents with chunking
  let processedContent = content;
  if (content.length > 100000) {
    // For very large documents, use the first 100K chars (about 25K tokens)
    // This leaves plenty of room for the prompt and response
    processedContent = content.substring(0, 100000);
    
    // Try to end at a natural boundary
    const lastPeriod = processedContent.lastIndexOf('.');
    const lastNewline = processedContent.lastIndexOf('\n');
    const endPoint = Math.max(lastPeriod, lastNewline);
    
    if (endPoint > 80000) {
      processedContent = processedContent.substring(0, endPoint + 1);
    }
    
    processedContent += '\n\n[Document truncated for processing. Full analysis may require multiple uploads.]';
  }

  // Analyze workflow content for complexity calculation with deterministic approach
  const workflowAnalysis = analyzeWorkflowContent(processedContent);
  if (enableLogging) {
    console.log(`🔍 [${requestId}] Workflow Analysis:`, workflowAnalysis);
  }

  // Extract deterministic business element count from content
  const { countBusinessElementsDeterministically } = require('../utils/fileProcessor');
  const businessElementCount = countBusinessElementsDeterministically(processedContent);
  
  if (enableLogging) {
    console.log(`🔍 [${requestId}] Deterministic Analysis: Found ${businessElementCount.count} business elements`);
    console.log(`🔍 [${requestId}] Breakdown:`, businessElementCount.breakdown);
  }

  // Clean up the URL to prevent duplication
  let baseUrl = OPENAI_URL;
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  
  // Remove any existing /openai/deployments/ from the URL
  baseUrl = baseUrl.replace(/\/openai\/deployments\/?$/, '');
  
  const apiUrl = `${baseUrl}/openai/deployments/${OPENAI_DEVELOPMENT_ID}/chat/completions?api-version=${OPENAI_API_VERSION}`;

  const messages = [
    {
      role: 'system',
      content: `You are a Business Analyst specializing in extracting business requirements from various document types including diagrams, flowcharts, and technical specifications.

Your task is to extract business requirements CONSISTENTLY and DETERMINISTICALLY from the provided content.

EXTRACTION RULES - FOLLOW THESE EXACTLY:
1. Extract ONLY the core, essential business requirements that are explicitly stated or clearly implied
2. Do NOT create additional requirements that are not directly supported by the content
3. Do NOT split a single requirement into multiple requirements
4. Do NOT combine multiple requirements into one
5. Each requirement should represent a distinct, testable business need
6. Extract the EXACT requirements present in the content - no more, no less
7. CRITICAL: The number of requirements MUST match the deterministic count provided
8. CRITICAL: You MUST extract exactly ${businessElementCount.count} requirements based on the content analysis
9. CRITICAL: Do NOT deviate from this count - it is based on actual content analysis

REQUIRED OUTPUT FORMAT:
Create a markdown table with these columns:

| Requirement ID | Business Requirement | Acceptance Criteria | Complexity |

REQUIREMENT ID FORMAT:
- Use sequential numbering: BR-001, BR-002, BR-003, etc.
- Do NOT skip numbers or use random identifiers
- Start with BR-001 and increment sequentially
- You MUST have exactly ${businessElementCount.count} requirements

BUSINESS REQUIREMENT RULES:
- Extract ONLY what the system should do based on the content
- Do NOT add features that are not mentioned
- Do NOT create requirements for edge cases unless explicitly stated
- Keep requirements focused and specific to the content provided
- Base requirements on the business elements found in the content

ACCEPTANCE CRITERIA RULES:
- EVERY business requirement MUST have a corresponding acceptance criteria
- Acceptance criteria should be specific, measurable, and testable
- Use Given-When-Then format where applicable
- Base acceptance criteria ONLY on the content provided
- Do NOT add acceptance criteria for features not mentioned

COMPLEXITY CALCULATION RULES:
- CRITICAL: Analyze EACH requirement individually for its specific complexity
- NEVER apply the same complexity to all requirements
- NEVER use global document complexity for individual requirements
- For each requirement, calculate the cyclomatic complexity using this ACCURATE formula:
  CC = E - N + 2P
  Where:
  E = number of edges (transitions/flows between elements)
  N = number of nodes (activities, decisions, events)
  P = number of connected components (usually 1 for single workflow)
- Decision points include: exclusive gateways, parallel gateways, inclusive gateways, conditional flows
- Activities include: tasks, user tasks, service tasks, subprocesses
- Events include: start events, end events, intermediate events
- Edges include: sequence flows, message flows, conditional flows, default flows
- If a requirement involves workflows or decision logic, provide detailed complexity analysis
- Format complexity as: "CC: [number], Decision Points: [count], Activities: [count], Paths: [estimated paths]"
- For simple requirements without workflows, use: "CC: 1, Decision Points: 0, Activities: 1, Paths: 1"
- EXAMPLES of different complexities:
  * Simple login: "CC: 1, Decision Points: 0, Activities: 1, Paths: 1"
  * Form validation: "CC: 3, Decision Points: 2, Activities: 2, Paths: 3"
  * Complex workflow: "CC: 8, Decision Points: 6, Activities: 4, Paths: 8"
- IMPORTANT: Each requirement MUST have DIFFERENT complexity based on its specific content

CONSISTENCY REQUIREMENTS:
- The same content should ALWAYS produce the same requirements
- Do NOT be creative or add requirements that are not explicitly supported
- Focus on extracting what is actually present in the content
- Extract requirements based on the deterministic count, not arbitrary numbers
- Be consistent in identifying and extracting the same requirements from the same content

SPECIAL INSTRUCTIONS FOR DIAGRAM CONTENT:
- When analyzing diagram content, focus on business processes, systems, actors, and flows
- If the diagram is a flowchart, extract the requirements from the flowchart
- Extract requirements from business process components and their relationships
- Convert visual elements into functional requirements
- Identify data flows, system integrations, and user interactions
- Look for business rules, decision points, and process steps
- Count decision points (gateways) and activities for complexity calculation

FINAL REQUIREMENTS:
- Requirements are written in clear, concise, and testable language
- Acceptance criteria follow the Given-When-Then format where applicable
- Start directly with the table, no explanations
- EVERY business requirement MUST have acceptance criteria - this is mandatory
- EVERY requirement MUST include complexity analysis in the Complexity column
- BE CONSISTENT - same input should produce same output
- CRITICAL: You MUST extract exactly ${businessElementCount.count} requirements

DETERMINISTIC PROCESSING:
- Process content from top to bottom, left to right
- Extract requirements in the order they appear in the content
- Use systematic approach: focus on the business elements already identified
- Maintain consistent element ordering and processing sequence
- The deterministic count of ${businessElementCount.count} is your target - do not deviate

CONTENT ANALYSIS CONTEXT:
The document has been pre-analyzed deterministically and contains:
- **Total Business Elements**: ${businessElementCount.count}
- **Business Processes**: ${businessElementCount.breakdown.processes}
- **System Requirements**: ${businessElementCount.breakdown.requirements}
- **Decision Points**: ${businessElementCount.breakdown.decisions}
- **Process Steps**: ${businessElementCount.breakdown.steps}
- **Business Flows**: ${businessElementCount.breakdown.flows}
- **User Actions**: ${businessElementCount.breakdown.userActions}

Use this analysis to guide your requirement extraction. Extract exactly ${businessElementCount.count} requirements based on these identified business elements.`
    },
    {
      role: 'user',
      content: `Please analyze the following document and extract exactly ${businessElementCount.count} business requirements and their corresponding acceptance criteria.

IMPORTANT: Extract requirements CONSISTENTLY and DETERMINISTICALLY. The same content should ALWAYS produce the same requirements.

CRITICAL: You MUST extract exactly ${businessElementCount.count} requirements based on the deterministic content analysis:
- This count is based on actual content analysis, not estimation
- Do NOT create more or fewer requirements
- Focus on the business elements already identified in the content

CONTENT TO ANALYZE:
${processedContent}

CONTEXT: ${context || 'None provided'}

Please extract exactly ${businessElementCount.count} business requirements in a systematic, deterministic manner.`
    }
  ];

  try {

    
    const response = await axios.post(
        apiUrl,
        {
          messages: messages,
          max_tokens: 4000,
          temperature: 0.1,
          response_format: { type: "text" }
        },
        {
          headers: {
            'api-key': OPENAI_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );



    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
      throw new Error(`Invalid response structure from Azure OpenAI: ${JSON.stringify(response.data)}`);
    }

    // Check if content was filtered
    if (response.data.choices[0].finish_reason === 'content_filter') {
      const filterResults = response.data.choices[0].content_filter_results;
      const filteredCategories = Object.entries(filterResults)
        .filter(([_, result]) => result.filtered)
        .map(([category, result]) => `${category}: ${result.severity}`)
        .join(', ');
      
      throw new Error(`Content was filtered by Azure OpenAI safety filters: ${filteredCategories}. Please try rephrasing your request or using different content.`);
    }

    // Check if message has content
    if (!response.data.choices[0].message.content) {
      throw new Error(`No content received from Azure OpenAI. Response: ${JSON.stringify(response.data.choices[0])}`);
    }

    let extractedRequirements = response.data.choices[0].message.content;

    // Clean up the response
    extractedRequirements = extractedRequirements.trim();
    
    // Remove any markdown code blocks if present
    extractedRequirements = extractedRequirements.replace(/```markdown\n?/g, '').replace(/```markdown\n?/g, '').replace(/```\n?/g, '');

    // CRITICAL: Check if AI is defaulting to 10 requirements (indicating it's not analyzing content)
    const requirementCount = (extractedRequirements.match(/\| BR-\d+ \|/g) || []).length;
    if (requirementCount === 10) {
      console.warn(`⚠️  [${requestId}] WARNING: AI extracted exactly 10 requirements - this may indicate it's defaulting to a fixed number instead of analyzing content`);
      console.warn(`⚠️  [${requestId}] Content length: ${processedContent.length} characters`);
      console.warn(`⚠️  [${requestId}] This suggests the AI is not properly analyzing the document scope`);
      
      // Force a retry with stronger instructions if this happens
      if (enableLogging) {
        console.log(`🔍 [${requestId}] Attempting to fix AI response with stronger instructions...`);
      }
      
      // Add a warning to the user about potential AI issues
      extractedRequirements += '\n\n⚠️  WARNING: AI may have defaulted to 10 requirements instead of analyzing content properly. Please review the extracted requirements for accuracy.';
      
      // If this is a simple document (less than 1000 chars) and we got 10 requirements, it's definitely wrong
      if (processedContent.length < 1000 && requirementCount === 10) {
        console.error(`❌ [${requestId}] CRITICAL ERROR: Simple document (${processedContent.length} chars) produced 10 requirements - AI is not analyzing content`);
        console.error(`❌ [${requestId}] This indicates a fundamental problem with the AI extraction logic`);
        
        // Return an error to force the user to retry
        throw new Error('AI extraction failed - the system extracted 10 requirements from a simple document, indicating it did not properly analyze the content. Please try again or contact support if the issue persists.');
      }
    }

    // Post-process to enhance complexity calculations if needed
    if (workflowAnalysis.workflowDetected) {
      extractedRequirements = enhanceComplexityCalculations(extractedRequirements, workflowAnalysis);
    }

    // Validate consistency of extracted requirements
    const validationResult = validateRequirementsConsistency(extractedRequirements, processedContent);
    if (validationResult.issues.length > 0) {
      console.warn(`⚠️  [${requestId}] Requirements consistency issues detected:`, validationResult.issues);
    }

    // Update content hash history with requirements count
    if (global.contentHashHistory && global.contentHashHistory[contentHash]) {
      global.contentHashHistory[contentHash].requirementCount = validationResult.requirementCount;
      global.contentHashHistory[contentHash].consistencyScore = validationResult.consistencyScore;
      
      // Check for consistency issues with previous extractions
      const previousExtractions = Object.entries(global.contentHashHistory)
        .filter(([hash, data]) => hash === contentHash && data.requirementCount !== null)
        .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));
      
      if (previousExtractions.length > 1) {
        const currentCount = validationResult.requirementCount;
        const previousCount = previousExtractions[1][1].requirementCount;
        
        if (currentCount !== previousCount) {
          console.warn(`⚠️  [${requestId}] INCONSISTENCY DETECTED: Same content produced ${previousCount} requirements before, now ${currentCount} requirements`);
          console.warn(`⚠️  [${requestId}] Previous extraction: ${previousExtractions[1][1].timestamp}`);
          console.warn(`⚠️  [${requestId}] Current extraction: ${new Date().toISOString()}`);
          console.warn(`⚠️  [${requestId}] This may indicate the AI is not consistently identifying the same requirements`);
        } else {
          console.log(`✅ [${requestId}] Consistency confirmed: Same content produced ${currentCount} requirements as before`);
        }
      }
    }

    if (enableLogging) {
      console.log(`🔍 [${requestId}] Successfully extracted requirements`);
      console.log(`🔍 [${requestId}] Requirements count: ${validationResult.requirementCount}`);
      console.log(`🔍 [${requestId}] Consistency score: ${validationResult.consistencyScore}%`);
    }
    
    return {
      success: true,
      content: extractedRequirements,
      message: 'Successfully extracted business requirements and acceptance criteria',
      metadata: {
        workflowAnalysis: workflowAnalysis,
        complexityLevel: workflowAnalysis.complexityLevel,
        decisionPoints: workflowAnalysis.decisionPoints,
        activities: workflowAnalysis.activities,
        requestId: requestId,
        contentHash: contentHash,
        requirementsValidation: validationResult
      }
    };

  } catch (error) {
    if (enableLogging) {
      console.error(`🔍 [${requestId}] Error extracting business requirements:`, error);
    } else {
      console.error('Error extracting business requirements:', error);
    }
    
    let errorMessage = 'Failed to extract business requirements';
    let suggestion = 'Please try again';
    
    if (error.response) {
      const errorData = error.response.data;
      console.error('Azure OpenAI Error Response:', JSON.stringify(errorData, null, 2));
      errorMessage = errorData.error?.message || errorData.error || errorMessage;
      suggestion = errorData.suggestion || suggestion;
    } else if (error.request) {
      errorMessage = 'Network error - unable to connect to server';
      suggestion = 'Please check your connection and try again';
    } else {
      errorMessage = error.message || errorMessage;
    }
    
    throw new Error(`${errorMessage}. ${suggestion}`);
  }
}

module.exports = {
  generateTestCases,
  refineTestCases,
  isAzureOpenAIConfigured,
  extractBusinessRequirements
}; 