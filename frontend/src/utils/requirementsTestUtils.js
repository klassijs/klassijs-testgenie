// Requirements and Test Generation utility functions for TestGenerator component
/**
 * Generates test cases from requirements
 * @param {string} content - Content containing requirements
 * @param {Function} setStatus - Function to set status message
 * @param {Function} setIsLoading - Function to set loading state
 * @param {Function} setIsGenerating - Function to set generating state
 * @param {Function} parseRequirementsTable - Function to parse requirements table
 * @param {Function} validateTestCoverage - Function to validate test coverage
 * @param {Function} setRequirementsSource - Function to set requirements source
 * @param {Function} setJiraTicketPrefix - Function to set JIRA ticket prefix
 * @param {Function} setJiraTicketInfo - Function to set JIRA ticket info
 * @param {Function} setFeatureTabs - Function to set feature tabs
 * @param {Function} setActiveTab - Function to set active tab
 * @param {Function} setEditableFeatures - Function to set editable features
 * @param {Function} setGeneratedTests - Function to set generated tests
 * @param {Function} setExtractedRequirements - Function to set extracted requirements
 * @param {Function} setContent - Function to set content
 * @param {Function} setShowModal - Function to set show modal
 * @param {string} requirementsSource - Source of requirements
 * @param {string} jiraTicketPrefix - JIRA ticket prefix
 * @param {Object} jiraTicketInfo - JIRA ticket information
 * @param {string} context - Context for generation
 * @param {string} currentDocumentName - Current document name
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<void>}
 */
export const generateTests = async (
  content,
  setStatus,
  setIsLoading,
  setIsGenerating,
  parseRequirementsTable,
  validateTestCoverage,
  setRequirementsSource,
  setJiraTicketPrefix,
  setJiraTicketInfo,
  setFeatureTabs,
  setActiveTab,
  setEditableFeatures,
  setGeneratedTests,
  setExtractedRequirements,
  setContent,
  setShowModal,
  requirementsSource,
  jiraTicketPrefix,
  jiraTicketInfo,
  context,
  currentDocumentName,
  API_BASE_URL
) => {
  // Check if we have content to generate tests from
  if (!content.trim()) {
    setStatus({ type: 'error', message: 'No content in the text area. Please insert requirements or enter content first.' });
    return;
  }
  
  setIsLoading(true);
  setIsGenerating(true);
  setStatus(null);
  
  try {
    // Parse requirements from the content
    const requirements = parseRequirementsTable(content, requirementsSource, jiraTicketPrefix, jiraTicketInfo, setJiraTicketPrefix, setJiraTicketInfo);
    
    if (requirements.length === 0) {
      setStatus({ type: 'error', message: 'No requirements found in the content. Please ensure you have a requirements table with Requirement ID, Business Requirement, and Acceptance Criteria columns.' });
      return;
    }
    
    // Generate tests for each requirement
    const generatedFeatures = [];
    
    for (const req of requirements) {
      const testContent = `REQUIREMENT TO TEST:
Requirement ID: ${req.id}
Business Requirement: ${req.requirement}
Acceptance Criteria: ${req.acceptanceCriteria}

GENERATE COMPREHENSIVE TEST SCENARIOS FOR THIS SPECIFIC REQUIREMENT.

CRITICAL REQUIREMENTS:
1. Feature line must start with # in this format:
   # Feature: [Feature Name Based on Requirement]

2. Each scenario title must include the requirement ID in this format:
   Scenario: ${req.id}: [Specific Scenario Description]

3. COMPREHENSIVE PATH COVERAGE:
   - Analyze the complexity information (CC, Decision Points, Paths) from the requirement
   - Generate test scenarios that cover EVERY identified execution path
   - The number of test scenarios MUST match or exceed the "Paths" count from complexity analysis
   - Each decision point should have separate test scenarios for each branch
   - Ensure complete coverage of all conditional logic and workflow branches

4. TEST SCENARIO TYPES REQUIRED:

   POSITIVE TEST SCENARIOS:
   - Happy path scenarios (main success flow)
   - Valid data variations and combinations
   - Different user roles/permissions if applicable
   - Successful edge cases and boundary conditions
   - Various valid input combinations

   NEGATIVE TEST SCENARIOS:
   - Invalid input scenarios (empty fields, special characters, very long text)
   - Error conditions and exception handling
   - Boundary value testing (minimum/maximum values, limits)
   - Invalid data formats and malformed inputs
   - Business rule violations
   - Invalid state transitions
   - Security-related negative scenarios

   WORKFLOW PATH SCENARIOS:
   - Test each decision branch separately
   - Cover all gateway conditions (exclusive, parallel, inclusive)
   - Test all possible workflow paths
   - Include error paths and exception handling
   - Test parallel execution paths if applicable

   DATA-DRIVEN SCENARIOS:
   - Use Scenario Outline with Examples for multiple data combinations
   - Test various test conditions and data variations
   - Cover different business scenarios

5. COMPLEXITY ANALYSIS INTEGRATION:
   - If complexity information exists: Use it to determine the minimum number of scenarios
   - If no complexity info: Analyze the requirement to identify decision points and paths
   - Ensure the number of scenarios covers all identified paths
   - Add complexity analysis as comments if not present

6. SCENARIO QUALITY REQUIREMENTS:
   - Each scenario must test a different execution path or decision branch
   - Scenarios must be specific to the provided business requirement
   - Do NOT generate generic test scenarios
   - Use natural, business-focused scenario names that describe the specific business case being tested
   - Do NOT use technical labels like "Positive Test", "Negative Test", "Edge Case", etc.
   - Instead, use descriptive names like "User successfully logs in with valid credentials", "System displays error for invalid email format", "Application handles maximum input length"
   - Include both success and failure scenarios naturally
   - Ensure edge cases and boundary conditions are covered with business-focused names

EXAMPLE STRUCTURE:
# Feature: [Specific Feature Based on Requirement]
# Complexity: CC: X, Decision Points: Y, Paths: Z

Scenario: ${req.id}: [Specific business scenario description]
Given [precondition]
When [action]
Then [expected result]

Scenario: ${req.id}: [Another specific business scenario]
Given [precondition]
When [action]
Then [expected result]

Scenario: ${req.id}: [Different business scenario variation]
Given [precondition]
When [action]
Then [expected result]

# Continue with more scenarios to cover ALL identified paths

CRITICAL: Generate ENOUGH test scenarios to cover ALL identified paths from the complexity analysis. The number of scenarios should match or exceed the "Paths" count.

SCENARIO NAMING GUIDELINES:
- Use natural, business-focused language in scenario names
- Avoid technical terms like "Positive Test", "Negative Test", "Edge Case", "Data-Driven Test"
- Instead, describe the specific business scenario being tested
- Examples of good names: "User successfully completes order", "System validates required fields", "Application handles network timeout"
- Examples of names to avoid: "Positive Test - Happy Path", "Negative Test - Invalid Input", "Edge Case - Boundary Condition"`;
      
      const response = await fetch(`${API_BASE_URL}/api/generate-tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          content: testContent, 
          context: context,
          documentName: currentDocumentName
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Create a descriptive title that includes requirement ID and summary
        const requirementSummary = req.requirement.length > 50 
          ? req.requirement.substring(0, 50) + '...' 
          : req.requirement;
        
        const scenarioTitle = `${req.id}: ${requirementSummary}`;
        
        generatedFeatures.push({
          title: scenarioTitle,
          content: data.content,
          requirement: req.requirement,
          acceptanceCriteria: req.acceptanceCriteria,
          requirementId: req.id // Store the requirement ID separately for reference
        });
      } else {
        console.error(`Failed to generate tests for ${req.id}`);
      }
    }
    
    if (generatedFeatures.length > 0) {
      // Validate test coverage for each requirement
      const validationResults = generatedFeatures.map(feature => {
        const coverage = validateTestCoverage(feature.content, feature.requirement, feature.acceptanceCriteria);
        return {
          ...feature,
          coverage: coverage
        };
      });
      
      // Set requirements source for generated tests
      setRequirementsSource('upload');
      setJiraTicketPrefix(''); // Clear any Jira ticket prefix
      setJiraTicketInfo({}); // Clear any Jira ticket info
      
      // Set the feature tabs
      setFeatureTabs(validationResults);
      setActiveTab(0);
      
      // Set editable features
      const editableFeaturesObj = {};
      validationResults.forEach((feature, index) => {
        editableFeaturesObj[index] = feature.content;
      });
      setEditableFeatures(editableFeaturesObj);
      
      // Set overall generated tests (combined)
      const allTests = validationResults.map(f => f.content).join('\n\n');
      setGeneratedTests(allTests);
      
      // Show coverage summary
      const totalScenarios = validationResults.reduce((sum, f) => sum + f.coverage.scenarioCount, 0);
      const totalPaths = validationResults.reduce((sum, f) => sum + f.coverage.expectedPaths, 0);
      const coveragePercentage = totalPaths > 0 ? Math.round((totalScenarios / totalPaths) * 100) : 0;
      
      // Clear requirements, generated test content, and the test generation textarea content
      setExtractedRequirements('');
      setGeneratedTests('');
      setContent('');
      
      setShowModal(true);
      setStatus({ 
        type: 'success', 
        message: `Generated ${totalScenarios} test scenarios for ${generatedFeatures.length} requirements! Coverage: ${coveragePercentage}% of expected paths.` 
      });
    } else {
      setStatus({ type: 'error', message: 'Failed to generate test cases for any requirements' });
    }
  } catch (error) {
    let errorMessage = 'Failed to generate test cases';
    let suggestion = 'Please try again';
    
    if (error.response) {
      const errorData = error.response.data;
      errorMessage = errorData.error || errorMessage;
      suggestion = errorData.suggestion || suggestion;
    } else if (error.request) {
      errorMessage = 'Network error - unable to connect to server';
      suggestion = 'Please check your connection and try again';
    } else {
      errorMessage = error.message || errorMessage;
    }
    
    setStatus({ type: 'error', message: `${errorMessage}. ${suggestion}` });
  } finally { 
    setIsLoading(false);
    setIsGenerating(false);
  }
};

/**
 * Refines existing test cases
 * @param {string} generatedTests - Generated test content
 * @param {Function} setStatus - Function to set status message
 * @param {Function} setIsLoading - Function to set loading state
 * @param {Array} featureTabs - Array of feature tabs
 * @param {number} activeTab - Active tab index
 * @param {Object} editableFeatures - Editable features object
 * @param {Function} setFeatureTabs - Function to set feature tabs
 * @param {Function} setEditableFeatures - Function to set editable features
 * @param {Function} setGeneratedTests - Function to set generated tests
 * @param {string} context - Context for refinement
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<void>}
 */
export const refineTests = async (
  generatedTests,
  setStatus,
  setIsLoading,
  featureTabs,
  activeTab,
  editableFeatures,
  setFeatureTabs,
  setEditableFeatures,
  setGeneratedTests,
  context,
  API_BASE_URL
) => {
  if (!generatedTests || !generatedTests.trim()) {
    setStatus({ type: 'error', message: 'No test cases available to refine' });
    return;
  }

  setIsLoading(true);
  setStatus({ type: 'info', message: 'Refining test cases...' });

  try {
    const currentFeature = featureTabs[activeTab];
    const currentContent = editableFeatures[activeTab] || currentFeature.content;
    
    const response = await fetch(`${API_BASE_URL}/api/refine-tests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: currentContent,
        feedback: 'Please improve the test cases based on best practices',
        context: context
      })
    });

    const data = await response.json();

    if (data.success) {
      // Update the specific feature
      const updatedFeatures = [...featureTabs];
      updatedFeatures[activeTab] = {
        ...updatedFeatures[activeTab],
        content: data.content
      };
      setFeatureTabs(updatedFeatures);
      
      // Update editable features
      setEditableFeatures(prev => ({
        ...prev,
        [activeTab]: data.content
      }));
      
      // Update overall generated tests
      const allTests = updatedFeatures.map(f => f.content).join('\n\n');
      setGeneratedTests(allTests);
      
      setStatus({ type: 'success', message: `Refined test cases for "${currentFeature.title}"!` });
    } else {
      setStatus({ type: 'error', message: data.error || 'Failed to refine test cases' });
    }
  } catch (error) {
    setStatus({ type: 'error', message: 'Failed to refine test cases. Please try again.' });
  } finally {
    setIsLoading(false);
  }
};