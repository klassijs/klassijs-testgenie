const axios = require('axios');
const { analyzeWorkflowContent, generateComplexityDescription, categorizeRequirementComplexity } = require('../utils/workflowAnalyzer');

// Retry helper function with exponential backoff for rate limiting
async function makeOpenAIRequest(apiUrl, requestData, headers, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(apiUrl, requestData, { headers });
      return response;
    } catch (error) {
      // If it's a 429 (rate limit) and we have retries left, wait and retry
      if (error.response?.status === 429 && attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.log(`⚠️  Rate limited (429). Retrying in ${waitTime/1000}s... (Attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // If it's not a 429 or we're out of retries, throw the error
      throw error;
    }
  }
}

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
- PATH COVERAGE IS MANDATORY: Generate scenarios for every path identified in the complexity analysis

DUPLICATION PREVENTION:
- CRITICAL: Do NOT generate scenarios with duplicate or nearly identical steps
- CRITICAL: Each scenario must test a UNIQUE execution path or decision branch
- CRITICAL: If two scenarios would have the same steps, combine them into one scenario with examples
- CRITICAL: Use Scenario Outline with Examples for similar scenarios with different data
- CRITICAL: Each scenario must add value and test something different
- CRITICAL: Avoid generating multiple scenarios that test the same functionality with minor wording changes

EXAMPLES OF WHAT NOT TO DO (DUPLICATE SCENARIOS):
❌ WRONG - Duplicate scenarios with same steps:
Scenario: BR-001: User navigates to journal issue and no option for "Silverchair - Journals" is displayed
Given I have navigated to a journal Issue package in Atlas
When I view the Workflow dropdown options
Then I do not see an option for "Silverchair - Journals"

Scenario: BR-001: User navigates to article package and no option for "Silverchair - Journals" is displayed
Given I have navigated to an Article package in Atlas
When I view the Workflow dropdown options
Then I do not see an option for "Silverchair - Journals"

✅ CORRECT - Single scenario with examples:
Scenario Outline: BR-001: User navigates to different package types and no option for "Silverchair - Journals" is displayed
Given I have navigated to a <package_type> package in Atlas
When I view the Workflow dropdown options
Then I do not see an option for "Silverchair - Journals"

Examples:
| package_type |
| journal Issue |
| Article |`
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
    const response = await makeOpenAIRequest(
      apiUrl,
      {
        messages: messages,
        max_tokens: 2000,
        temperature: 0.7,
        response_format: { type: "text" }
      },
      {
        'api-key': OPENAI_API_KEY,
        'Content-Type': 'application/json'
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

    // Remove duplicate scenarios
    const deduplicatedTests = removeDuplicateScenarios(cleanGeneratedTests);

    return deduplicatedTests;
  } catch (error) {
    console.error('Azure OpenAI API Error:', error.response?.data || error.message);
    throw new Error(`Azure OpenAI API Error: ${error.response?.status || error.message}`);
  }
}

// Remove duplicate scenarios from generated test cases and add spacing between scenarios
function removeDuplicateScenarios(gherkinContent) {
  const lines = gherkinContent.split('\n');
  const uniqueScenarios = [];
  const seenSteps = new Set();
  let currentScenario = null;
  let currentSteps = [];
  let inScenario = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this is a new scenario
    if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
      // Process previous scenario if exists
      if (currentScenario && currentSteps.length > 0) {
        const stepsKey = currentSteps.join('\n').toLowerCase().replace(/\s+/g, ' ').trim();
        if (!seenSteps.has(stepsKey)) {
          seenSteps.add(stepsKey);
          uniqueScenarios.push(currentScenario, ...currentSteps);
        }
      }
      
      // Start new scenario
      currentScenario = line;
      currentSteps = [];
      inScenario = true;
      continue;
    }
    
    // Check if we're still in a scenario
    if (inScenario) {
      if (line.startsWith('Feature:') || line.startsWith('Background:') || 
          (line.startsWith('Scenario:') && i > 0) || line.startsWith('Scenario Outline:')) {
        // End of current scenario
        inScenario = false;
        
        // Process the completed scenario
        if (currentScenario && currentSteps.length > 0) {
          const stepsKey = currentSteps.join('\n').toLowerCase().replace(/\s+/g, ' ').trim();
          if (!seenSteps.has(stepsKey)) {
            seenSteps.add(stepsKey);
            uniqueScenarios.push(currentScenario, ...currentSteps);
          }
        }
        
        // Reset for next scenario
        currentScenario = null;
        currentSteps = [];
      } else if (line && (line.startsWith('Given') || line.startsWith('When') || 
                          line.startsWith('Then') || line.startsWith('And') || 
                          line.startsWith('But') || line.startsWith('Examples:'))) {
        currentSteps.push(line);
      }
    }
    
    // Add non-scenario lines (Feature, Background, etc.)
    if (!inScenario) {
      uniqueScenarios.push(line);
    }
  }
  
  // Process the last scenario if exists
  if (currentScenario && currentSteps.length > 0) {
    const stepsKey = currentSteps.join('\n').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!seenSteps.has(stepsKey)) {
      seenSteps.add(stepsKey);
      uniqueScenarios.push(currentScenario, ...currentSteps);
    }
  }
  
  // Add spacing between scenarios for better readability
  const spacedScenarios = [];
  
  for (let i = 0; i < uniqueScenarios.length; i++) {
    const line = uniqueScenarios[i];
    
    // Check if this line starts a new scenario
    if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
      // Add a blank line before the scenario (except for the first one)
      if (i > 0) {
        spacedScenarios.push(''); // Add blank line before every scenario
      }
      spacedScenarios.push(line);
    } else {
      spacedScenarios.push(line);
    }
  }
  
  return spacedScenarios.join('\n');
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
    const response = await makeOpenAIRequest(
      apiUrl,
      {
        messages: messages,
        max_tokens: 2000,
        temperature: 0.7,
        response_format: { type: "text" }
      },
      {
        'api-key': OPENAI_API_KEY,
        'Content-Type': 'application/json'
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
function validateRequirementsConsistency(extractedRequirements, originalContent, businessElementCount = null) {
  const issues = [];
  let requirementCount = 0;
  let consistencyScore = 100;
  let deterministicCount = 0; // Define at function scope
  
  try {
    // Count requirements (more flexible pattern matching)
    const requirementMatches = extractedRequirements.match(/\|\s*BR-\d+\s*\|/g);
    requirementCount = requirementMatches ? requirementMatches.length : 0;
    
    // If no requirements found with flexible pattern, try even more flexible matching
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
    
    // Use the deterministic count for validation, not the AI-generated count
    deterministicCount = businessElementCount && businessElementCount.businessElements?.count ? businessElementCount.businessElements.count : requirementCount;
    const expectedRows = deterministicCount + 1; // +1 for header row
    const rowDifference = Math.abs(validRows.length - expectedRows);
    
    if (rowDifference > 2) { // Allow up to 2 rows difference
      issues.push(`Table structure inconsistency: Expected ${expectedRows} rows, found ${validRows.length} (difference: ${rowDifference})`);
      consistencyScore -= 10; // Reduced penalty for table structure issues
    } else if (rowDifference > 0) {
      console.log(`ℹ️  Table structure has minor differences: Expected ${expectedRows} rows, found ${validRows.length} (using deterministic count: ${deterministicCount})`);
    }
    
    // Check for sequential numbering - use deterministic count if available
    const checkCount = deterministicCount || requirementCount;
    const requirementIds = [];
    for (let i = 1; i <= checkCount; i++) {
      const expectedId = `BR-${String(i).padStart(3, '0')}`;
      if (!extractedRequirements.includes(expectedId)) {
        issues.push(`Missing sequential requirement ID: ${expectedId}`);
        consistencyScore -= 10;
      }
      requirementIds.push(expectedId);
    }
    
    // Check for duplicate IDs
    const duplicateIds = requirementIds.filter(id => {
      const regex = new RegExp(`\\|\\s*${id}\\s*\\|`, 'g');
      const matches = extractedRequirements.match(regex);
      return matches && matches.length > 1;
    });
    
    if (duplicateIds.length > 0) {
      issues.push(`Duplicate requirement IDs found: ${duplicateIds.join(', ')}`);
      consistencyScore -= 15;
    }
    
    // CRITICAL: Check that every requirement has acceptance criteria
    const requirementRows = validRows.filter(row => row.includes('BR-'));
    let missingAcceptanceCriteria = 0;
    
    requirementRows.forEach(row => {
      const columns = row.split('|').map(col => col.trim());
      if (columns.length >= 4) {
        const acceptanceCriteria = columns[2]; // 3rd column (0-indexed)
        if (!acceptanceCriteria || acceptanceCriteria.length < 10 || acceptanceCriteria === 'N/A' || acceptanceCriteria === '-') {
          missingAcceptanceCriteria++;
        }
      }
    });
    
    if (missingAcceptanceCriteria > 0) {
      issues.push(`CRITICAL: ${missingAcceptanceCriteria} requirements are missing proper acceptance criteria`);
      consistencyScore -= 25; // Heavy penalty for missing acceptance criteria
    }
    
    // CRITICAL: Check that every requirement has complete complexity information
    let incompleteComplexity = 0;
    
    requirementRows.forEach(row => {
      const columns = row.split('|').map(col => col.trim());
      if (columns.length >= 4) {
        const complexity = columns[3]; // 4th column (0-indexed)
        // Check if complexity has all required elements
        if (!complexity || 
            !complexity.includes('CC:') || 
            !complexity.includes('Decision Points:') || 
            !complexity.includes('Activities:') || 
            !complexity.includes('Paths:')) {
          incompleteComplexity++;
        }
      }
    });
    
    if (incompleteComplexity > 0) {
      issues.push(`CRITICAL: ${incompleteComplexity} requirements have incomplete complexity information`);
      consistencyScore -= 20; // Heavy penalty for incomplete complexity
    }
    
    // Check for reasonable requirement extraction based on content - use deterministic count if available
    const contentLength = originalContent.length;
    const validationCount = deterministicCount || requirementCount;
    if (contentLength < 1000 && validationCount > 8) {
      issues.push(`Very high requirement count (${validationCount}) for short content (${contentLength} chars) - may indicate over-extraction`);
      consistencyScore -= 15;
    } else if (contentLength > 10000 && validationCount < 2) {
      issues.push(`Very low requirement count (${validationCount}) for long content (${contentLength} chars) - may indicate under-extraction`);
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
    deterministicCount: deterministicCount || requirementCount,
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
  
  if (enableLogging) {
    console.log(`🔍 [${requestId}] Starting requirements extraction...`);
    console.log(`🔍 [${requestId}] Content length: ${content.length} characters`);
  }

  // Check if content is sufficient
  if (!content || content.trim().length < 50) {
    throw new Error('Insufficient content. Please provide more detailed content for requirement extraction');
  }

  // Check if this content comes from enhanced Visio analysis
  const isEnhancedVisioAnalysis = content.includes('# Enhanced Visio Flowchart Analysis') && 
                                  content.includes('Flowchart Metadata') &&
                                  content.includes('Total Business Elements:');
  
  let workflowAnalysis = null;
  let businessElementCount = null;
  
  if (isEnhancedVisioAnalysis) {
    // COMPLETELY REPLACE old workflow analysis with enhanced Visio analysis
    console.log(`🔍 [${requestId}] Enhanced Visio analysis detected - COMPLETELY REPLACING old workflow analysis`);
    
    // Extract business element count from enhanced analysis
    const businessElementMatch = content.match(/Total Business Elements: (\d+)/);
    const enhancedCount = businessElementMatch ? parseInt(businessElementMatch[1]) : 0;
    
    if (enhancedCount > 0) {
      console.log(`🔍 [${requestId}] Enhanced Visio Analysis: Found ${enhancedCount} business elements`);
      console.log(`🔍 [${requestId}] COMPLETELY REPLACING old workflow analysis with enhanced results`);
      
      // Extract comprehensive metadata from enhanced analysis
      const pagesMatch = content.match(/Total Pages: (\d+)/);
      const shapesMatch = content.match(/Total Shapes: (\d+)/);
      const connectorsMatch = content.match(/Total Connectors: (\d+)/);
      const complexityMatch = content.match(/Complexity Level: ([^\n]+)/);
      const decisionsMatch = content.match(/Decision Points: (\d+)/);
      const processesMatch = content.match(/Business Processes: (\d+)/);
      const stepsMatch = content.match(/Process Steps: (\d+)/);
      const flowsMatch = content.match(/Business Flows: (\d+)/);
      const userActionsMatch = content.match(/User Actions: (\d+)/);
      
      const enhancedMetadata = {
        totalPages: pagesMatch ? parseInt(pagesMatch[1]) : 0,
        totalShapes: shapesMatch ? parseInt(shapesMatch[1]) : 0,
        totalConnectors: connectorsMatch ? parseInt(connectorsMatch[1]) : 0,
        complexity: complexityMatch ? complexityMatch[1].trim() : 'Unknown',
        decisionPoints: decisionsMatch ? parseInt(decisionsMatch[1]) : 0,
        businessProcesses: processesMatch ? parseInt(processesMatch[1]) : 0,
        processSteps: stepsMatch ? parseInt(stepsMatch[1]) : 0,
        businessFlows: flowsMatch ? parseInt(flowsMatch[1]) : 0,
        userActions: userActionsMatch ? parseInt(userActionsMatch[1]) : 0,
        enhancedAnalysis: true,
        businessElementCount: enhancedCount
      };
      
      console.log(`🔍 [${requestId}] Enhanced Metadata:`, enhancedMetadata);
      
      // COMPLETELY REPLACE old workflow analysis with enhanced results
      workflowAnalysis = {
        workflowDetected: true,
        complexityLevel: enhancedMetadata.complexity,
        decisionPoints: enhancedMetadata.decisionPoints,
        activities: enhancedMetadata.processSteps,
        events: enhancedMetadata.businessProcesses,
        connectors: enhancedMetadata.totalConnectors,
        edges: enhancedMetadata.businessFlows,
        nodes: enhancedMetadata.totalShapes,
        components: enhancedMetadata.totalPages,
        totalElements: enhancedMetadata.totalShapes + enhancedMetadata.totalConnectors,
        cyclomaticComplexity: enhancedMetadata.decisionPoints + 1,
        enhancedAnalysis: true
      };
      
      businessElementCount = {
        count: enhancedCount,
        breakdown: {
          processes: enhancedMetadata.businessProcesses,
          requirements: enhancedCount,
          decisions: enhancedMetadata.decisionPoints,
          steps: enhancedMetadata.processSteps,
          flows: enhancedMetadata.businessFlows,
          userActions: enhancedMetadata.userActions
        },
        enhancedMetadata: enhancedMetadata
      };
      
      console.log(`🔍 [${requestId}] COMPLETELY REPLACED old workflow analysis with enhanced Visio results`);
      console.log(`🔍 [${requestId}] Enhanced Workflow Analysis:`, workflowAnalysis);
      console.log(`🔍 [${requestId}] Enhanced Business Element Count: ${elementCount}`);
    }
  }

  // Handle large documents with chunking
  let processedContent = content;
  let isChunked = false;
  
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
    isChunked = true;
  }

  // Only run old workflow analysis if NOT enhanced Visio analysis
  if (!isEnhancedVisioAnalysis) {
    // Analyze workflow content for complexity calculation with deterministic approach
    workflowAnalysis = analyzeWorkflowContent(processedContent);
    if (enableLogging) {
      console.log(`🔍 [${requestId}] Workflow Analysis:`, workflowAnalysis);
    }
  }

  // Extract deterministic business element count from content
  const { extractBusinessRequirements: universalExtract, calculateQualityScore } = require('../utils/universalBusinessExtractor');
  
  // Use balanced settings for all files to provide realistic counts
  const isVisioFile = processedContent.includes('Visio') || processedContent.includes('workflow') || processedContent.includes('flowchart');
  const extractionOptions = {
    minLineLength: isVisioFile ? 25 : 20, // Balanced minimum for Visio
    maxLineLength: 500,
    enableStrictMode: false, // Balanced mode for realistic counts
    includeLowPriority: true // Include low priority for comprehensive coverage
  };
  
  businessElementCount = universalExtract(processedContent, extractionOptions);
  
  // Extract the count for consistent use throughout the function
  let elementCount = businessElementCount.businessElements?.count || 0;
  
  if (enableLogging) {
    console.log(`🔍 [${requestId}] Final Business Element Count: ${elementCount}`);
    console.log(`🔍 [${requestId}] Breakdown:`, businessElementCount.businessElements?.breakdown || {});
    
    // CRITICAL: Check if the count seems reasonable
    const contentLength = processedContent.length;
    const requirementsPerChar = elementCount / contentLength;
    const requirementsPerK = requirementsPerChar * 1000;
    
    console.log(`🔍 [${requestId}] Content Analysis:`);
    console.log(`🔍 [${requestId}] - Content length: ${contentLength} characters`);
    console.log(`🔍 [${requestId}] - Requirements per character: ${requirementsPerChar.toFixed(6)}`);
    console.log(`🔍 [${requestId}] - Requirements per 1000 chars: ${requirementsPerK.toFixed(2)}`);
    
    // VSDX-specific safety: Apply quality selection FIRST (before capping)
    if (isVisioFile && elementCount > 100) { // Apply to any VSDX with significant count
      console.log(`🔍 [${requestId}] VSDX QUALITY SELECTION: Applying quality-based selection to ${elementCount} requirements BEFORE capping`);
      
      // Calculate quality scores for all elements
      const elementsWithScores = businessElementCount.businessElements.elements.map(element => ({
        ...element,
        qualityScore: calculateQualityScore(element)
      }));
      
      // ENHANCED QUALITY SELECTION: Use higher threshold for VSDX files
      const qualityThreshold = 50; // Only requirements with score >= 50
      const highQualityElements = elementsWithScores.filter(element => element.qualityScore >= qualityThreshold);
      
      if (highQualityElements.length > 0) {
        // Sort by quality score (highest first) and take top requirements
        const topQualityElements = highQualityElements
          .sort((a, b) => b.qualityScore - a.qualityScore)
          .slice(0, elementCount); // Keep same count, just improve quality
        
        // Log quality distribution
        const avgQuality = topQualityElements.reduce((sum, e) => sum + e.qualityScore, 0) / topQualityElements.length;
        console.log(`🔍 [${requestId}] VSDX QUALITY RESULTS: ${topQualityElements.length} requirements now have average quality score of ${avgQuality.toFixed(1)}/100 (threshold: ${qualityThreshold})`);
        
        // Update the elements with top quality requirements (keep same count)
        businessElementCount.businessElements.elements = topQualityElements;
        
        // Update count if we have fewer high-quality requirements
        if (topQualityElements.length < elementCount) {
          console.warn(`⚠️  [${requestId}] VSDX QUALITY: Reduced from ${elementCount} to ${topQualityElements.length} requirements due to quality threshold`);
          businessElementCount.businessElements.count = topQualityElements.length;
          elementCount = topQualityElements.length;
        }
      } else {
        // If no requirements meet quality threshold, use original but warn
        console.warn(`⚠️  [${requestId}] VSDX QUALITY: No requirements meet quality threshold ${qualityThreshold}, using original ${elementCount} requirements`);
      }
    }
    
    // Warn if the count seems unreasonably high and adjust if needed
    if (requirementsPerK > 10) {
      console.warn(`⚠️  [${requestId}] WARNING: Very high requirement density (${requirementsPerK.toFixed(2)} per 1000 chars) - deterministic count may be inflated`);
      console.warn(`⚠️  [${requestId}] This could explain why AI cannot extract ${elementCount} requirements`);
      
      // For extremely high densities, cap the count to a realistic number
      // BUT: If we have high-quality requirements, be more lenient
      if (requirementsPerK > 20) {
        let realisticCount;
        
        // If this is a VSDX file and we've already filtered for quality, be more lenient
        if (isVisioFile && elementCount < 1000) {
          // For VSDX with quality-filtered requirements, allow higher density
          realisticCount = Math.min(elementCount, Math.round(contentLength / 150)); // 1 requirement per 150 chars (more lenient)
          console.warn(`⚠️  [${requestId}] VSDX QUALITY-AWARE: High density but quality-filtered. Capping from ${elementCount} to ${realisticCount} (quality-aware extraction)`);
        } else {
          // For other files or unfiltered requirements, use stricter cap
          realisticCount = Math.min(elementCount, Math.round(contentLength / 200)); // 1 requirement per 200 chars max
          console.warn(`⚠️  [${requestId}] CRITICAL: Extremely high density detected. Capping count from ${elementCount} to ${realisticCount} for realistic extraction`);
        }
        
        // Update the count to be more realistic
        businessElementCount.businessElements.count = realisticCount;
        businessElementCount.businessElements.elements = businessElementCount.businessElements.elements.slice(0, realisticCount);
        
        // Update the elementCount variable to reflect the adjusted count
        elementCount = businessElementCount.businessElements.count;
      }
    }
    
    // Additional safety: Prevent massive inflation while maintaining improvements
    const maxReasonableImprovement = Math.round(contentLength / 150); // 1 requirement per 150 chars as absolute max (more conservative)
    console.log(`🔍 [${requestId}] SAFETY CHECK: elementCount=${elementCount}, maxReasonableImprovement=${maxReasonableImprovement}`);
    if (elementCount > maxReasonableImprovement) {
      const cappedCount = maxReasonableImprovement;
      console.warn(`⚠️  [${requestId}] SAFETY: Count ${elementCount} exceeds reasonable maximum. Capping to ${cappedCount} for realistic extraction`);
      
      // Update the count to be more realistic
      businessElementCount.businessElements.count = cappedCount;
      businessElementCount.businessElements.elements = businessElementCount.businessElements.elements.slice(0, cappedCount);
      elementCount = cappedCount;
    }
    
    // Final safety: Ensure improvements are reasonable (not massive inflation)
    const oldSystemEstimate = Math.round(contentLength / 200); // Rough estimate of old system
    let maxReasonableImprovementLimit;
    
    // If this is a VSDX file with quality-filtered requirements, be more lenient
    if (isVisioFile && elementCount < 1000) {
      maxReasonableImprovementLimit = Math.round(oldSystemEstimate * 1.5); // Max 50% improvement for quality VSDX (more lenient)
    } else {
      maxReasonableImprovementLimit = Math.round(oldSystemEstimate * 1.3); // Max 30% improvement (more conservative)
    }
    
    console.log(`🔍 [${requestId}] IMPROVEMENT SAFETY: elementCount=${elementCount}, oldSystemEstimate=${oldSystemEstimate}, maxReasonableImprovementLimit=${maxReasonableImprovementLimit} (${isVisioFile && elementCount < 1000 ? 'VSDX quality-aware' : 'standard'})`);
    if (elementCount > maxReasonableImprovementLimit) {
      const cappedCount = maxReasonableImprovementLimit;
      console.warn(`⚠️  [${requestId}] FINAL SAFETY: Count ${elementCount} exceeds reasonable improvement limit. Capping to ${cappedCount} (max ${isVisioFile && elementCount < 1000 ? '50%' : '30%'} improvement)`);
      
      // Update the count to be more realistic
      businessElementCount.businessElements.count = cappedCount;
      businessElementCount.businessElements.elements = businessElementCount.businessElements.elements.slice(0, cappedCount);
      elementCount = cappedCount;
    }
    
    // Log final elementCount after all safety mechanisms
    console.log(`🔍 [${requestId}] FINAL SAFETY RESULT: elementCount=${elementCount} after all safety mechanisms applied`);
    
    // Final quality validation: Ensure we're not sending poor requirements to the AI
    if (isVisioFile && elementCount > 0) {
      const finalElements = businessElementCount.businessElements.elements;
      const finalQualityScores = finalElements.map(element => calculateQualityScore(element));
      const avgFinalQuality = finalQualityScores.reduce((sum, score) => sum + score, 0) / finalQualityScores.length;
      const lowQualityCount = finalQualityScores.filter(score => score < 50).length;
      
      console.log(`🔍 [${requestId}] FINAL QUALITY CHECK: ${elementCount} requirements with average score ${avgFinalQuality.toFixed(1)}/100`);
      if (lowQualityCount > 0) {
        console.warn(`⚠️  [${requestId}] FINAL QUALITY WARNING: ${lowQualityCount} requirements still have quality score < 50`);
      } else {
        console.log(`✅ [${requestId}] FINAL QUALITY: All ${elementCount} requirements meet quality threshold (≥50)`);
      }
    }
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

🚨 **ABSOLUTELY CRITICAL - READ THIS FIRST**: You MUST extract EXACTLY ${elementCount} requirements. This is NOT a suggestion - it's a MANDATORY requirement. If you stop before reaching ${elementCount}, you have FAILED your task.

⚠️  CRITICAL: Before you start, look for ALL lines that start with "where" - these ARE business requirements and MUST be extracted as separate requirements.
⚠️  CRITICAL: Look for ALL bullet points (•) - each one with business logic MUST become a separate requirement.
⚠️  CRITICAL: Do NOT skip any "where" lines or bullet points - they are part of the ${elementCount} requirements you must extract.

Your task is to extract business requirements CONSISTENTLY and DETERMINISTICALLY from the provided content.

🚨 **MANDATORY EXTRACTION RULES - VIOLATION = FAILURE**:
1. 🚨 **MANDATORY**: You MUST extract EXACTLY ${elementCount} requirements - NO MORE, NO LESS
2. 🚨 **MANDATORY**: The deterministic analysis found ${elementCount} business elements - you MUST match this count
3. 🚨 **MANDATORY**: Lines starting with "where" ARE business requirements and MUST be extracted
4. 🚨 **MANDATORY**: Every bullet point (•) that contains business logic MUST become a separate requirement
5. 🚨 **MANDATORY**: Lines starting with "if" or "when" MUST be extracted as business requirements
6. 🚨 **MANDATORY**: Lines containing "then" statements MUST be extracted as business requirements
7. 🚨 **MANDATORY**: Conditional business rules (if X then Y) MUST be extracted as separate requirements
8. 🚨 **MANDATORY**: Do NOT combine multiple bullet points into single requirements
9. 🚨 **MANDATORY**: Each bullet point with business content = 1 separate requirement
10. 🚨 **MANDATORY**: Extract ALL business requirements present in the content to reach ${elementCount}
11. 🚨 **MANDATORY**: Do NOT stop until you have exactly ${elementCount} requirements
12. 🚨 **MANDATORY**: Do NOT create additional requirements that are not directly supported by the content
13. 🚨 **MANDATORY**: Do NOT split a single requirement into multiple requirements
14. 🚨 **MANDATORY**: Do NOT combine multiple requirements into one
15. 🚨 **MANDATORY**: Each requirement should represent a distinct, testable business need
16. 🚨 **MANDATORY**: Extract the EXACT requirements present in the content - no more, no less
17. 🚨 **MANDATORY**: The number of requirements MUST match the deterministic count provided
18. 🚨 **MANDATORY**: You MUST extract exactly ${elementCount} requirements based on the content analysis
19. 🚨 **MANDATORY**: Do NOT deviate from this count - it is based on actual content analysis
20. 🚨 **MANDATORY**: If you cannot find ${elementCount} requirements, you are not analyzing the content thoroughly enough

🚨 **SYSTEMATIC EXTRACTION STRATEGY - MANDATORY FOR ALL DOCUMENTS**:
21. 🚨 **MANDATORY**: Use a SYSTEMATIC approach - process the document LINE BY LINE
22. 🚨 **MANDATORY**: Extract requirements from EVERY paragraph, list, and bullet point
23. 🚨 **MANDATORY**: Do NOT skip any content - analyze EVERY line for potential requirements
24. 🚨 **MANDATORY**: Use a CHECKLIST approach: mark each requirement as you extract it
25. 🚨 **MANDATORY**: Count your requirements after each section to ensure you're on track
26. 🚨 **MANDATORY**: If you're falling behind, extract requirements more aggressively from remaining sections
27. 🚨 **MANDATORY**: Look for PATTERNS in requirements - similar requirements often appear in groups
28. 🚨 **MANDATORY**: Use the requirement count as your TARGET - extract until you reach exactly ${elementCount}
29. 🚨 **MANDATORY**: Do NOT stop until you have exactly ${elementCount} requirements
30. 🚨 **MANDATORY**: If you reach the end and don't have ${elementCount}, go back and extract more aggressively

🚨 **HIGH-DENSITY DOCUMENT EXTRACTION STRATEGY (${elementCount > 100 ? 'ENABLED' : 'N/A'})**:
${elementCount > 100 ? `
31. 🚨 **MANDATORY**: This is a HIGH-DENSITY document with ${elementCount} requirements - use SYSTEMATIC extraction
32. 🚨 **MANDATORY**: Process the document SECTION BY SECTION - do NOT try to extract all at once
33. 🚨 **MANDATORY**: For each section, extract ALL requirements before moving to the next section
34. 🚨 **MANDATORY**: Use a CHECKLIST approach: mark each requirement as you extract it
35. 🚨 **MANDATORY**: Count your requirements after each section to ensure you're on track
36. 🚨 **MANDATORY**: If you're falling behind, extract requirements more aggressively from remaining sections
37. 🚨 **MANDATORY**: Look for PATTERNS in requirements - similar requirements often appear in groups
38. 🚨 **MANDATORY**: Extract requirements from EVERY paragraph, list, and bullet point
39. 🚨 **MANDATORY**: Do NOT skip any content - analyze EVERY line for potential requirements
40. 🚨 **MANDATORY**: Use the requirement count as your TARGET - extract until you reach exactly ${elementCount}
` : ''}

🚨 **CRITICAL EXAMPLES - YOU MUST EXTRACT THESE AS SEPARATE REQUIREMENTS**:
• where Submission type is "preview" then content appears in UNPUBLISHED state → BR-001 (generate new acceptance criteria)
• where Submission type is "publish" then content appears in PUBLISHED state → BR-002 (generate new acceptance criteria)
• verify folder exclusion logic works as expected → BR-003 (use existing acceptance criteria if available)
• verify file exclusion logic works as expected → BR-004 (use existing acceptance criteria if available)

${elementCount > 100 ? `
🚨 **HIGH-DENSITY EXTRACTION EXAMPLES - EXTRACT EVERY SINGLE ONE**:
• "The system must validate user input" → BR-005 (extract as separate requirement)
• "Users can access their profiles" → BR-006 (extract as separate requirement)
• "Administrators manage permissions" → BR-007 (extract as separate requirement)
• "Data must be encrypted" → BR-008 (extract as separate requirement)
• "Reports are generated monthly" → BR-009 (extract as separate requirement)
• "Audit logs are maintained" → BR-010 (extract as separate requirement)

🚨 **PATTERN RECOGNITION FOR HIGH-DENSITY DOCUMENTS - EXTRACT ALL**:
- Look for repeated phrases: "must", "should", "will", "can", "need"
- Extract each numbered/bulleted item as a separate requirement
- Every conditional statement (if/when/where) = 1 requirement
- Every validation rule = 1 requirement
- Every user action = 1 requirement
- Every system behavior = 1 requirement
` : ''}

🚨 **ACCEPTANCE CRITERIA EXAMPLES**:
- For "where" lines: "Given a user submits content with type 'preview', When the submission is processed, Then the content appears in UNPUBLISHED state"
- For bullet points: "Given a user accesses the system, When folder exclusion logic is triggered, Then the excluded folders are properly filtered out"
- For existing criteria: Copy the exact "Given...When...Then" format from the document

🚨 **ACCEPTANCE CRITERIA HANDLING**:
- For requirements with existing acceptance criteria: COPY them exactly as written
- For "where" lines and bullet points without acceptance criteria: GENERATE new Given-When-Then format
- EACH "where" line = 1 requirement. EACH bullet point = 1 requirement. NEVER combine them.
- EVERY requirement MUST have acceptance criteria - NO EXCEPTIONS

🚨 **REQUIRED OUTPUT FORMAT**:
Create a markdown table with these EXACT columns and format:

| Requirement ID | Business Requirement | Acceptance Criteria | Complexity |
|----------------|----------------------|---------------------|------------|

🚨 **CRITICAL**: You MUST use the EXACT format above with pipe symbols (|) and dashes (-) for the table structure.
🚨 **CRITICAL**: Each requirement MUST be on a separate row starting with | BR-001 |, | BR-002 |, etc.
🚨 **CRITICAL**: Do NOT use any other table format - only the markdown table format shown above.

🚨 **REQUIREMENT ID FORMAT**:
- Use sequential numbering: BR-001, BR-002, BR-003, etc.
- Do NOT skip numbers or use random identifiers
- Start with BR-001 and increment sequentially
- 🚨 **MANDATORY**: You MUST have exactly ${elementCount} requirements

🚨 **BUSINESS REQUIREMENT RULES**:
- Extract ONLY what the system should do based on the content
- Do NOT add features that are not mentioned
- Do NOT create requirements for edge cases unless explicitly stated
- Keep requirements focused and specific to the content provided
- Base requirements on the business elements found in the content
- 🚨 **CRITICAL**: Lines starting with "where" ARE business requirements and MUST be extracted
- 🚨 **CRITICAL**: Conditional logic (if/when/where) represents business rules that MUST be extracted
- 🚨 **CRITICAL**: Every bullet point with business logic MUST become a separate requirement
- 🚨 **CRITICAL**: Do NOT skip any lines that contain business logic, conditions, or system behavior

🚨 **ACCEPTANCE CRITERIA RULES**:
- 🚨 **CRITICAL**: EVERY business requirement MUST have acceptance criteria - NO EXCEPTIONS
- 🚨 **CRITICAL**: Use EXISTING acceptance criteria from the document when available
- 🚨 **CRITICAL**: If a requirement already has acceptance criteria (like "Given...When...Then"), copy those EXACTLY
- 🚨 **CRITICAL**: For requirements without existing acceptance criteria (like "where" lines), generate new ones
- 🚨 **CRITICAL**: Generate new acceptance criteria for bullet points and "where" lines that don't have them
- 🚨 **CRITICAL**: Use Given-When-Then format for new acceptance criteria
- 🚨 **CRITICAL**: If you cannot create acceptance criteria for a requirement, DO NOT include that requirement
- 🚨 **CRITICAL**: Every row in your table MUST have all 4 columns filled: ID, Requirement, Acceptance Criteria, Complexity
- Acceptance criteria should be specific, measurable, and testable
- Base acceptance criteria ONLY on the content provided
- Do NOT add acceptance criteria for features not mentioned

🚨 **COMPLEXITY CALCULATION RULES**:
- 🚨 **CRITICAL**: Analyze EACH requirement individually for its specific complexity
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

🚨 **COMPLEXITY FORMAT - MANDATORY**:
- 🚨 **CRITICAL**: You MUST use the EXACT format: "CC: [number], Decision Points: [count], Activities: [count], Paths: [estimated paths]"
- 🚨 **CRITICAL**: Do NOT abbreviate or shorten the complexity format
- 🚨 **CRITICAL**: Do NOT use formats like "CC: 1, Paths: 1" - this is INVALID
- 🚨 **CRITICAL**: Every complexity entry MUST have all 4 elements: CC, Decision Points, Activities, Paths

🚨 **COMPLEXITY EXAMPLES - COPY EXACTLY**:
- Simple requirement: "CC: 1, Decision Points: 0, Activities: 1, Paths: 1"
- Medium complexity: "CC: 3, Decision Points: 2, Activities: 2, Paths: 3"
- Complex workflow: "CC: 8, Decision Points: 6, Activities: 4, Paths: 8"
- Conditional logic: "CC: 2, Decision Points: 1, Activities: 1, Paths: 2"

🚨 **VALIDATION**:
- If you cannot calculate all 4 elements, use "CC: 1, Decision Points: 0, Activities: 1, Paths: 1"
- NEVER output incomplete complexity information
- NEVER use abbreviated formats

🚨 **CONSISTENCY REQUIREMENTS**:
- The same content should ALWAYS produce the same requirements
- Do NOT be creative or add requirements that are not explicitly supported
- Focus on extracting what is actually present in the content
- Extract requirements based on the deterministic count, not arbitrary numbers
- Be consistent in identifying and extracting the same requirements from the same content

🚨 **SPECIAL INSTRUCTIONS FOR DIAGRAM CONTENT**:
- When analyzing diagram content, focus on business processes, systems, actors, and flows

🚨 **FINAL VALIDATION - MANDATORY**:
- 🚨 **MANDATORY**: Before submitting, count your requirements
- 🚨 **MANDATORY**: You MUST have exactly ${elementCount} requirements
- 🚨 **MANDATORY**: If you don't have ${elementCount}, you have FAILED
- 🚨 **MANDATORY**: Do NOT submit until you have exactly ${elementCount} requirements
- 🚨 **MANDATORY**: This is a BINARY requirement - either you have ${elementCount} or you FAIL

🚨 **REMEMBER**: Your ONLY goal is to extract exactly ${elementCount} requirements. Nothing else matters.`
    },
    {
      role: 'user',
      content: `Please analyze the following document and extract exactly ${elementCount} business requirements and their corresponding acceptance criteria.

IMPORTANT: Extract requirements CONSISTENTLY and DETERMINISTICALLY. The same content should ALWAYS produce the same requirements.

CRITICAL: You MUST extract exactly ${elementCount} requirements based on the deterministic content analysis:
- This count is based on actual content analysis, not estimation
- Do NOT create more or fewer requirements
- Focus on the business elements already identified in the content

CONTENT TO ANALYZE:
${processedContent}

CONTEXT: ${context || 'None provided'}

Please extract exactly ${elementCount} business requirements in a systematic, deterministic manner.`
    }
  ];

  try {

    // Making AI request to Azure OpenAI
    
    const response = await makeOpenAIRequest(
        apiUrl,
        {
          messages: messages,
          max_tokens: 8000, // Increased to handle larger requirement lists
          temperature: 0.1,
          response_format: { type: "text" }
        },
        {
          'api-key': OPENAI_API_KEY,
          'Content-Type': 'application/json'
        }
      );
      
    // AI response received successfully



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

    // AI response received

    // Clean up the response
    extractedRequirements = extractedRequirements.trim();
    
    // Remove any markdown code blocks if present
    extractedRequirements = extractedRequirements.replace(/```markdown\n?/g, '').replace(/```markdown\n?/g, '').replace(/```\n?/g, '');
    
    // Response cleaned

    // Check if AI extracted the correct number of requirements
    // Try multiple patterns to handle different AI output formats
    let requirementCount = 0;
    
    // Primary pattern: Standard markdown table format
    const standardMatches = extractedRequirements.match(/\|\s*BR-\d+\s*\|/g);
    if (standardMatches) {
      requirementCount = standardMatches.length;
      console.log(`🔍 [${requestId}] Found ${requirementCount} requirements with standard table format`);
    }
    
    // Fallback pattern: Just BR- numbers anywhere in the text
    if (requirementCount === 0) {
      const fallbackMatches = extractedRequirements.match(/BR-\d+/g);
      if (fallbackMatches) {
        requirementCount = fallbackMatches.length;
        console.log(`🔍 [${requestId}] Found ${requirementCount} requirements with fallback pattern`);
      }
    }
    
    // Alternative pattern: Look for numbered requirements in any format
    if (requirementCount === 0) {
      const numberedMatches = extractedRequirements.match(/(?:BR-|Requirement\s+)(\d+)/gi);
      if (numberedMatches) {
        requirementCount = numberedMatches.length;
        console.log(`🔍 [${requestId}] Found ${requirementCount} requirements with numbered pattern`);
      }
    }
    
    const expectedCount = elementCount;
    
    // CRITICAL: If AI didn't extract enough requirements, force a retry with stronger instructions
    if (requirementCount < expectedCount * 0.8) { // If we got less than 80% of expected
      console.warn(`⚠️  [${requestId}] CRITICAL: AI only extracted ${requirementCount}/${expectedCount} requirements (${Math.round(requirementCount/expectedCount*100)}%)`);
      console.warn(`⚠️  [${requestId}] Forcing retry with stronger instructions...`);
      
      // Add critical warning to user
      extractedRequirements += `\n\n🚨 CRITICAL: AI only extracted ${requirementCount} requirements out of ${expectedCount} expected.`;
      extractedRequirements += `\n\nThis indicates the AI is not analyzing the content thoroughly enough.`;
      extractedRequirements += `\n\nRecommendation: Regenerate requirements with the "Force Complete Analysis" option.`;
      
      // Set a flag for potential retry
      extractedRequirements += `\n\n⚠️  RETRY REQUIRED: Content analysis incomplete.`;
      
      // CRITICAL: Force a second attempt with even stronger instructions
      console.warn(`⚠️  [${requestId}] CRITICAL: Attempting forced retry with maximum strength instructions...`);
      
      try {
        const retryMessages = [
          {
            role: 'system',
            content: `🚨 CRITICAL SYSTEM INSTRUCTION - MAXIMUM REQUIREMENT EXTRACTION REQUIRED:

You are a Business Analyst with ONE CRITICAL MISSION: Extract EXACTLY ${elementCount} business requirements from the provided content.

🚨 MAXIMUM EXTRACTION RULES:
1. CRITICAL: You MUST extract EXACTLY ${elementCount} requirements - NO EXCEPTIONS
2. CRITICAL: The deterministic analysis found ${elementCount} business elements - you MUST match this count
3. CRITICAL: Do NOT stop until you have ${elementCount} requirements
4. CRITICAL: If you cannot find ${elementCount} requirements, you are missing content
5. CRITICAL: Analyze EVERY single line, paragraph, and section for business requirements
6. CRITICAL: Look for hidden requirements, implicit business rules, and process steps
7. CRITICAL: Extract requirements from diagrams, flowcharts, and visual elements
8. CRITICAL: Convert every business process, decision point, and activity into a requirement
9. CRITICAL: Do NOT skip any content - process everything thoroughly
10. CRITICAL: This is a MAXIMUM EFFORT extraction - leave no stone unturned

🚨 CONTENT ANALYSIS REQUIREMENTS:
- Document Length: ${processedContent.length} characters
- Expected Requirements: ${elementCount}
- Content Density: ${Math.round(elementCount / (processedContent.length / 1000))} requirements per 1000 characters
- Analysis Required: This document contains substantial business content that MUST be fully analyzed

🚨 EXTRACTION STRATEGY:
- Process content line by line
- Extract requirements from every business-related statement
- Convert process flows into individual requirements
- Extract requirements from decision points and activities
- Look for implicit business rules and constraints
- Convert every workflow step into a requirement
- Extract requirements from data flows and integrations

🚨 FINAL REQUIREMENT:
- You MUST extract EXACTLY ${elementCount} requirements
- Do NOT stop until you have ${elementCount} requirements
- If you cannot find ${elementCount} requirements, you are not analyzing thoroughly enough
- This is a MAXIMUM EFFORT extraction - leave no stone unturned`
          },
          {
            role: 'user',
            content: `🚨 CRITICAL: You previously extracted only ${requirementCount} requirements, but the deterministic analysis found ${elementCount} business elements.

This is UNACCEPTABLE. You MUST extract EXACTLY ${elementCount} requirements.

CONTENT TO ANALYZE (ANALYZE EVERY SINGLE CHARACTER):
${processedContent}

🚨 CRITICAL INSTRUCTION: Extract EXACTLY ${elementCount} requirements. Do NOT stop until you have ${elementCount} requirements. This is a MAXIMUM EFFORT extraction.`
          }
        ];

        console.log(`🔄 [${requestId}] Attempting forced retry with maximum strength instructions...`);
        
        const retryResponse = await makeOpenAIRequest(
          apiUrl,
          {
            messages: retryMessages,
            max_tokens: 12000, // Maximum tokens for retry
            temperature: 0.0, // Zero temperature for maximum consistency
            response_format: { type: "text" }
          },
          {
            'api-key': OPENAI_API_KEY,
            'Content-Type': 'application/json'
          }
        );

        if (retryResponse.data && retryResponse.data.choices && retryResponse.data.choices[0] && retryResponse.data.choices[0].message) {
          const retryRequirements = retryResponse.data.choices[0].message.content.trim();
          
          console.log(`🔄 [${requestId}] Retry response received, length: ${retryRequirements.length} characters`);
          console.log(`🔄 [${requestId}] Retry response preview: ${retryRequirements.substring(0, 500)}...`);
          
          // Check retry count
          const retryCount = (retryRequirements.match(/\|\s*BR-\d+\s*\|/g) || []).length;
          console.log(`🔄 [${requestId}] Retry extracted ${retryCount} requirements`);
          
          if (retryCount > requirementCount) {
            console.log(`✅ [${requestId}] Retry successful! Got ${retryCount} requirements instead of ${requirementCount}`);
            extractedRequirements = retryRequirements;
            requirementCount = retryCount;
            
            // Update the success message
            extractedRequirements += `\n\n✅ RETRY SUCCESSFUL: Extracted ${retryCount} requirements (previous: ${requirementCount})`;
          } else if (retryCount === 0) {
            console.error(`❌ [${requestId}] Retry failed completely - extracted 0 requirements`);
            console.error(`❌ [${requestId}] Retry response: ${retryRequirements}`);
            
            // Try a simpler retry approach
            console.log(`🔄 [${requestId}] Attempting simplified retry...`);
            
            const simpleRetryMessages = [
              {
                role: 'system',
                content: `You are a Business Analyst. Extract EXACTLY ${elementCount} business requirements from the content. Use simple, clear language.`
              },
              {
                role: 'user',
                content: `Extract exactly ${elementCount} business requirements from this content. Start with BR-001 and go to BR-${elementCount}. Keep requirements simple and clear.

Content: ${processedContent.substring(0, 20000)}`
              }
            ];
            
            try {
              const simpleRetryResponse = await makeOpenAIRequest(
                apiUrl,
                {
                  messages: simpleRetryMessages,
                  max_tokens: 8000,
                  temperature: 0.1,
                  response_format: { type: "text" }
                },
                {
                  'api-key': OPENAI_API_KEY,
                  'Content-Type': 'application/json'
                }
              );
              
              if (simpleRetryResponse.data && simpleRetryResponse.data.choices && simpleRetryResponse.data.choices[0] && simpleRetryResponse.data.choices[0].message) {
                const simpleRetryRequirements = simpleRetryResponse.data.choices[0].message.content.trim();
                const simpleRetryCount = (simpleRetryRequirements.match(/\|\s*BR-\d+\s*\|/g) || []).length;
                
                console.log(`🔄 [${requestId}] Simple retry extracted ${simpleRetryCount} requirements`);
                
                if (simpleRetryCount > requirementCount) {
                  console.log(`✅ [${requestId}] Simple retry successful! Got ${simpleRetryCount} requirements`);
                  extractedRequirements = simpleRetryRequirements;
                  requirementCount = simpleRetryCount;
                  extractedRequirements += `\n\n✅ SIMPLE RETRY SUCCESSFUL: Extracted ${simpleRetryCount} requirements`;
                } else {
                  console.warn(`⚠️  [${requestId}] Simple retry also failed: ${simpleRetryCount} requirements`);
                  extractedRequirements += `\n\n⚠️  SIMPLE RETRY FAILED: Still only ${simpleRetryCount} requirements extracted.`;
                }
              }
            } catch (simpleRetryError) {
              console.error(`❌ [${requestId}] Simple retry also failed:`, simpleRetryError);
              extractedRequirements += `\n\n❌ SIMPLE RETRY FAILED: ${simpleRetryError.message}`;
            }
          } else {
            console.warn(`⚠️  [${requestId}] Retry failed to improve count: ${retryCount} vs ${requirementCount}`);
            extractedRequirements += `\n\n⚠️  RETRY ATTEMPTED: Still only ${retryCount} requirements extracted.`;
          }
        } else {
          console.error(`❌ [${requestId}] Retry response structure invalid:`, retryResponse.data);
          extractedRequirements += `\n\n❌ RETRY FAILED: Invalid response structure from AI.`;
        }
      } catch (retryError) {
        console.error(`❌ [${requestId}] Retry failed:`, retryError);
        extractedRequirements += `\n\n❌ RETRY FAILED: ${retryError.message}`;
      }
    }
    
    // Debug: Let's see exactly what the AI generated
    console.log(`🔍 [${requestId}] AI Response Preview (first 1000 chars):`);
    console.log(extractedRequirements.substring(0, 1000));
    console.log(`🔍 [${requestId}] Looking for BR- pattern in response...`);
    console.log(`🔍 [${requestId}] Raw regex match result:`, extractedRequirements.match(/\|\s*BR-\d+\s*\|/g));
    console.log(`🔍 [${requestId}] Alternative pattern (BR-\\d+):`, extractedRequirements.match(/BR-\d+/g));
    console.log(`🔍 [${requestId}] Lines containing 'BR-':`, extractedRequirements.split('\n').filter(line => line.includes('BR-')).length);
    console.log(`🔍 [${requestId}] Table structure analysis:`);
    console.log(`🔍 [${requestId}] - Total lines:`, extractedRequirements.split('\n').length);
    console.log(`🔍 [${requestId}] - Lines with |:`, extractedRequirements.split('\n').filter(line => line.includes('|')).length);
    console.log(`🔍 [${requestId}] - First few table lines:`, extractedRequirements.split('\n').filter(line => line.includes('|')).slice(0, 5));
    
    // Requirement count check completed
    
    if (requirementCount !== expectedCount) {
      console.warn(`⚠️  [${requestId}] WARNING: AI extracted ${requirementCount} requirements but expected ${expectedCount}`);
      console.warn(`⚠️  [${requestId}] Content length: ${processedContent.length} characters`);
      
      // CRITICAL: Always warn about mismatches and provide guidance
      if (Math.abs(requirementCount - expectedCount) > 2) {
        console.warn(`⚠️  [${requestId}] CRITICAL MISMATCH: AI extracted ${requirementCount} requirements but expected ${expectedCount}`);
        console.warn(`⚠️  [${requestId}] This indicates the AI is not following the deterministic count requirement`);
        
        // 🚨 IMPLEMENT CHUNKED EXTRACTION SYSTEM
        const extractionRate = (requirementCount / expectedCount) * 100;
        console.log(`🔍 [${requestId}] CHUNKED EXTRACTION: AI extracted ${extractionRate.toFixed(1)}% of requirements. Implementing 1/3 chunked extraction...`);
        
        // Always do 3 passes of 1/3 each for complete coverage
        console.log(`🚀 [${requestId}] CHUNKED EXTRACTION: Starting 3-pass extraction (1/3 each) for complete coverage`);
        
        try {
            // Calculate chunk sizes - always 3 equal parts
            const totalRequirements = expectedCount;
            const chunkSize = Math.ceil(totalRequirements / 3);
            
            console.log(`🔍 [${requestId}] CHUNKED EXTRACTION: Breaking ${totalRequirements} total requirements into 3 chunks of ~${chunkSize} each`);
            
            let allExtractedRequirements = [];
            
            // Pass 1: Extract first 1/3 (BR-001 to BR-090 for 270 reqs)
            console.log(`🔍 [${requestId}] CHUNKED EXTRACTION: Pass 1 - Extracting first ${chunkSize} requirements (BR-001 to BR-${chunkSize})...`);
            const pass1Requirements = await extractRemainingRequirements(
              requestId,
              processedContent,
              businessElementCount,
              chunkSize,
              '', // No previous requirements for first pass
              enableLogging,
              apiUrl,
              OPENAI_API_KEY,
              1, // pass number
              'first third'
            );
            
            if (pass1Requirements && pass1Requirements.length > 0) {
              console.log(`✅ [${requestId}] CHUNKED EXTRACTION: Pass 1 successful - extracted ${pass1Requirements.length} requirements`);
              allExtractedRequirements = allExtractedRequirements.concat(pass1Requirements);
            } else {
              console.warn(`⚠️  [${requestId}] CHUNKED EXTRACTION: Pass 1 failed - continuing with other passes`);
            }
            
            // Pass 2: Extract second 1/3 (BR-091 to BR-180 for 270 reqs)
            console.log(`🔍 [${requestId}] CHUNKED EXTRACTION: Pass 2 - Extracting second ${chunkSize} requirements (BR-${chunkSize + 1} to BR-${chunkSize * 2})...`);
            const pass2Requirements = await extractRemainingRequirements(
              requestId,
              processedContent,
              businessElementCount,
              chunkSize,
              allExtractedRequirements.map(req => `| ${req.id} | ${req.requirement} | ${req.acceptanceCriteria} | ${req.complexity} |`).join('\n'),
              enableLogging,
              apiUrl,
              OPENAI_API_KEY,
              2, // pass number
              'second third'
            );
            
            if (pass2Requirements && pass2Requirements.length > 0) {
              console.log(`✅ [${requestId}] CHUNKED EXTRACTION: Pass 2 successful - extracted ${pass2Requirements.length} requirements`);
              allExtractedRequirements = allExtractedRequirements.concat(pass2Requirements);
            } else {
              console.warn(`⚠️  [${requestId}] CHUNKED EXTRACTION: Pass 2 failed - continuing with final pass`);
            }
            
            // Pass 3: Extract final 1/3 (BR-181 to BR-270 for 270 reqs)
            const remainingForPass3 = totalRequirements - allExtractedRequirements.length;
            if (remainingForPass3 > 0) {
              console.log(`🔍 [${requestId}] CHUNKED EXTRACTION: Pass 3 - Extracting final ${remainingForPass3} requirements (BR-${chunkSize * 2 + 1} to BR-${totalRequirements})...`);
              const pass3Requirements = await extractRemainingRequirements(
                requestId,
                processedContent,
                businessElementCount,
                remainingForPass3,
                allExtractedRequirements.map(req => `| ${req.id} | ${req.requirement} | ${req.acceptanceCriteria} | ${req.complexity} |`).join('\n'),
                enableLogging,
                apiUrl,
                OPENAI_API_KEY,
                3, // pass number
                'final third'
              );
              
              if (pass3Requirements && pass3Requirements.length > 0) {
                console.log(`✅ [${requestId}] CHUNKED EXTRACTION: Pass 3 successful - extracted ${pass3Requirements.length} requirements`);
                allExtractedRequirements = allExtractedRequirements.concat(pass3Requirements);
              } else {
                console.warn(`⚠️  [${requestId}] CHUNKED EXTRACTION: Pass 3 failed`);
              }
            }
            
            // Combine all passes
            if (allExtractedRequirements.length > 0) {
              console.log(`✅ [${requestId}] CHUNKED EXTRACTION: All 3 passes completed - extracted ${allExtractedRequirements.length}/${totalRequirements} total requirements`);
              
              // Create comprehensive final output
              const finalRequirements = createFinalRequirementsTable(allExtractedRequirements, totalRequirements);
              const finalCount = countRequirements(finalRequirements);
              
              console.log(`🎯 [${requestId}] CHUNKED EXTRACTION: Final result: ${finalCount}/${totalRequirements} requirements (${((finalCount/totalRequirements)*100).toFixed(1)}%)`);
              
              // Update extractedRequirements with comprehensive result
              extractedRequirements = finalRequirements;
              
              // Update requirementCount for validation
              requirementCount = finalCount;
            } else {
              console.warn(`⚠️  [${requestId}] CHUNKED EXTRACTION: All 3 passes failed - continuing with original ${requirementCount} requirements`);
            }
          } catch (chunkError) {
            console.error(`❌ [${requestId}] CHUNKED EXTRACTION: Error during chunked extraction:`, chunkError);
            console.log(`🔍 [${requestId}] CHUNKED EXTRACTION: Continuing with original ${requirementCount} requirements`);
          }
        
        // Add a critical warning to the user about the mismatch
        extractedRequirements += `\n\n🚨 CRITICAL WARNING: AI extracted ${requirementCount} requirements, but the deterministic analysis found ${expectedCount} business elements.`;
        extractedRequirements += `\n\nThis suggests the AI did not analyze the content thoroughly enough.`;
        extractedRequirements += `\n\nExpected: ${expectedCount} requirements`;
        extractedRequirements += `\n\nExtracted: ${requirementCount} requirements`;
        extractedRequirements += `\n\nRecommendation: Regenerate requirements to get the full count.`;
      }
    } else {
      console.log(`✅ [${requestId}] AI correctly extracted ${requirementCount} requirements as expected`);
    }

    // Post-process to enhance complexity calculations if needed
    if (workflowAnalysis && workflowAnalysis.workflowDetected) {
      extractedRequirements = enhanceComplexityCalculations(extractedRequirements, workflowAnalysis);
    }

    // Validate consistency of extracted requirements
    const validationResult = validateRequirementsConsistency(extractedRequirements, processedContent, businessElementCount);
    if (validationResult.issues.length > 0) {
      console.warn(`⚠️  [${requestId}] Requirements consistency issues detected:`, validationResult.issues);
    }

    // No caching - always process fresh for accuracy

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
        complexityLevel: workflowAnalysis ? workflowAnalysis.complexityLevel : 'N/A',
        decisionPoints: workflowAnalysis ? workflowAnalysis.decisionPoints : 'N/A',
        activities: workflowAnalysis ? workflowAnalysis.activities : 'N/A',
        requestId: requestId,
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

/**
 * 🚀 CHUNKED EXTRACTION SYSTEM: Extract remaining requirements when AI stops early
 * @param {string} requestId - Request identifier
 * @param {string} content - Original content to analyze
 * @param {Object} businessElementCount - Business element analysis
 * @param {number} remainingCount - Number of requirements still needed
 * @param {string} alreadyExtracted - Requirements already extracted
 * @param {boolean} enableLogging - Whether to enable logging
 * @param {string} apiUrl - OpenAI API URL
 * @param {string} apiKey - OpenAI API key
 * @param {number} chunkNumber - Which chunk this is (1, 2, or 3)
 * @param {string} chunkPosition - Position description ('first', 'second', 'final')
 * @returns {Array} Array of remaining requirements
 */
async function extractRemainingRequirements(requestId, content, businessElementCount, remainingCount, alreadyExtracted, enableLogging, apiUrl, apiKey, chunkNumber, chunkPosition) {
  try {
    console.log(`🔍 [${requestId}] CHUNKED EXTRACTION: Extracting Chunk ${chunkNumber} (${chunkPosition}) - ${remainingCount} requirements...`);
    
    // Calculate starting BR number for this chunk
    const startBRNumber = businessElementCount.businessElements.count - remainingCount + 1;
    const endBRNumber = businessElementCount.businessElements.count;
    
    // Create a focused prompt for this specific chunk
    const remainingPrompt = `🚨 CRITICAL: You are extracting Chunk ${chunkNumber} (${chunkPosition}) of missing requirements. 
    
    You MUST extract exactly ${remainingCount} business requirements from this content.
    
    CONTENT TO ANALYZE:
    ${content}
    
    REQUIREMENTS ALREADY EXTRACTED (DO NOT DUPLICATE):
    ${alreadyExtracted}
    
    🚨 MANDATORY: Extract exactly ${remainingCount} ADDITIONAL requirements that are NOT in the already extracted list.
    🚨 MANDATORY: Start numbering from BR-${startBRNumber} and continue to BR-${endBRNumber}.
    🚨 MANDATORY: Do NOT duplicate any requirements from the already extracted list.
    🚨 MANDATORY: Focus on business requirements that were missed in the first pass.
    🚨 MANDATORY: This is Chunk ${chunkNumber} of 3 - extract only your assigned portion.
    
    Use the same format:
    | Requirement ID | Business Requirement | Acceptance Criteria | Complexity |
    |----------------|----------------------|---------------------|------------|
    
    Extract exactly ${remainingCount} requirements starting from BR-${startBRNumber}.`;
    
    // Create the proper request structure for makeOpenAIRequest
    const messages = [
      {
        role: 'system',
        content: `You are a Business Analyst specializing in extracting business requirements. You MUST extract exactly ${remainingCount} requirements in the specified format for Chunk ${chunkNumber} (${chunkPosition}).`
      },
      {
        role: 'user',
        content: remainingPrompt
      }
    ];
    
    // Validate configuration parameters
    if (!apiKey || !apiUrl) {
      throw new Error('OpenAI configuration parameters not provided to chunked extraction function.');
    }
    
    // Make the request for remaining requirements using the same structure as main extraction
    const remainingResponse = await makeOpenAIRequest(
      apiUrl,
      {
        messages: messages,
        max_tokens: 8000,
        temperature: 0.1,
        response_format: { type: "text" }
      },
      {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      }
    );
    
    if (remainingResponse && remainingResponse.data && remainingResponse.data.choices && remainingResponse.data.choices[0] && remainingResponse.data.choices[0].message) {
      // Parse the remaining requirements
      const remainingRequirements = parseRequirementsFromResponse(remainingResponse.data.choices[0].message.content);
      console.log(`🔍 [${requestId}] CHUNKED EXTRACTION: Chunk ${chunkNumber} parsed ${remainingRequirements.length} requirements`);
      return remainingRequirements;
    }
    
    return [];
  } catch (error) {
    console.error(`❌ [${requestId}] CHUNKED EXTRACTION: Error extracting Chunk ${chunkNumber}:`, error);
    return [];
  }
}

/**
 * 🔗 Combine original and remaining requirements into a single comprehensive list
 * @param {string} originalRequirements - Original requirements table
 * @param {Array} remainingRequirements - Additional requirements to add
 * @param {number} expectedTotal - Expected total count
 * @returns {string} Combined requirements table
 */
function combineRequirements(originalRequirements, remainingRequirements, expectedTotal) {
  try {
    // Remove the header row from remaining requirements if it exists
    const cleanRemaining = remainingRequirements.filter(req => req.id && req.id.startsWith('BR-'));
    
    // Create the combined table
    let combinedTable = originalRequirements;
    
    // Add remaining requirements
    cleanRemaining.forEach(req => {
      const newRow = `| ${req.id} | ${req.requirement} | ${req.acceptanceCriteria} | ${req.complexity} |`;
      combinedTable += '\n' + newRow;
    });
    
    // Add summary footer
    combinedTable += `\n\n🎯 CHUNKED EXTRACTION COMPLETE: ${originalRequirements.split('BR-').length - 1 + cleanRemaining.length}/${expectedTotal} requirements extracted`;
    
    return combinedTable;
  } catch (error) {
    console.error('Error combining requirements:', error);
    return originalRequirements;
  }
}

/**
 * 🎯 Create comprehensive final requirements table from all chunks
 * @param {Array} allRequirements - All extracted requirements from all passes
 * @param {number} totalExpected - Total expected requirements
 * @returns {string} Complete requirements table
 */
function createFinalRequirementsTable(allRequirements, totalExpected) {
  try {
    // Sort requirements by BR number
    const sortedRequirements = allRequirements.sort((a, b) => {
      const aNum = parseInt(a.id.replace('BR-', ''));
      const bNum = parseInt(b.id.replace('BR-', ''));
      return aNum - bNum;
    });
    
    // Create the comprehensive table
    let finalTable = `| Requirement ID | Business Requirement | Acceptance Criteria | Complexity |\n`;
    finalTable += `|----------------|----------------------|---------------------|------------|\n`;
    
    // Add all requirements in order
    sortedRequirements.forEach(req => {
      const newRow = `| ${req.id} | ${req.requirement} | ${req.acceptanceCriteria} | ${req.complexity} |`;
      finalTable += newRow + '\n';
    });
    
    // Add summary footer
    finalTable += `\n\n🎯 3-PASS CHUNKED EXTRACTION COMPLETE: ${sortedRequirements.length}/${totalExpected} requirements extracted`;
    finalTable += `\n\n✅ Pass 1: First 1/3 of requirements`;
    finalTable += `\n✅ Pass 2: Second 1/3 of requirements`;
    finalTable += `\n✅ Pass 3: Final 1/3 of requirements`;
    
    return finalTable;
  } catch (error) {
    console.error('Error creating final requirements table:', error);
    return 'Error creating final requirements table';
  }
}

/**
 * 📊 Count requirements in a requirements table
 * @param {string} requirementsTable - Requirements table string
 * @returns {number} Count of requirements
 */
function countRequirements(requirementsTable) {
  try {
    const brMatches = requirementsTable.match(/BR-\d+/g);
    return brMatches ? brMatches.length : 0;
  } catch (error) {
    console.error('Error counting requirements:', error);
    return 0;
  }
}

/**
 * 🔍 Parse requirements from AI response
 * @param {string} response - AI response content
 * @returns {Array} Array of parsed requirements
 */
function parseRequirementsFromResponse(response) {
  try {
    const requirements = [];
    const lines = response.split('\n');
    
    for (const line of lines) {
      if (line.includes('|') && line.includes('BR-')) {
        const parts = line.split('|').map(part => part.trim()).filter(part => part);
        
        if (parts.length >= 4) {
          requirements.push({
            id: parts[0],
            requirement: parts[1],
            acceptanceCriteria: parts[2],
            complexity: parts[3]
          });
        }
      }
    }
    
    return requirements;
  } catch (error) {
    console.error('Error parsing requirements from response:', error);
    return [];
  }
}

module.exports = {
  generateTestCases,
  refineTestCases,
  isAzureOpenAIConfigured,
  extractBusinessRequirements,
  makeOpenAIRequest
}; 