import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Test Generation Utilities
 * Handles test case generation, validation, parsing, and refinement
 */

/**
 * Parse requirements table from content
 * @param {string} requirementsContent - Requirements content
 * @returns {Array} - Parsed requirements array
 */
export const parseRequirementsTable = (requirementsContent) => {
  const requirements = [];
  const lines = requirementsContent.split('\n');
  
  let inTable = false;
  let headers = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this is a table header
    if (line.includes('|') && (line.toLowerCase().includes('requirement') || line.toLowerCase().includes('id'))) {
      inTable = true;
      headers = line.split('|').map(h => h.trim()).filter(h => h);
      continue;
    }
    
    // Check if this is a table separator
    if (inTable && line.includes('|') && line.includes('---')) {
      continue;
    }
    
    // Parse table rows
    if (inTable && line.includes('|') && !line.includes('---')) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      
      if (cells.length >= 2) {
        const requirement = {
          id: cells[0] || '',
          requirement: cells[1] || '',
          acceptanceCriteria: cells[2] || '',
          complexity: cells[3] || 'Medium',
          priority: cells[4] || 'Medium'
        };
        
        requirements.push(requirement);
      }
    }
    
    // Stop parsing if we hit an empty line or non-table content
    if (inTable && line === '') {
      break;
    }
  }
  
  return requirements;
};

/**
 * Generate test cases from requirements
 * @param {string} content - Requirements content
 * @param {string} context - Context for generation
 * @param {Function} setIsLoading - Function to set loading state
 * @param {Function} setIsGenerating - Function to set generating state
 * @param {Function} setStatus - Function to set status
 * @param {Function} setGeneratedTests - Function to set generated tests
 * @param {Function} setFeatureTabs - Function to set feature tabs
 * @param {Function} setEditableFeatures - Function to set editable features
 * @param {Function} setExtractedRequirements - Function to clear extracted requirements
 * @param {Function} setGeneratedTests - Function to clear generated tests
 * @param {Function} setContent - Function to clear content
 * @returns {Promise<void>}
 */
export const generateTests = async (
  content,
  context,
  setIsLoading,
  setIsGenerating,
  setStatus,
  setGeneratedTests,
  setFeatureTabs,
  setEditableFeatures,
  setExtractedRequirements,
  setContent
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
    const requirements = parseRequirementsTable(content);
    
    if (requirements.length === 0) {
      setStatus({ type: 'error', message: 'No valid requirements found. Please check the format of your requirements table.' });
      return;
    }
    
    setStatus({ type: 'info', message: `Generating test cases for ${requirements.length} requirements...` });
    
    // Generate test cases for each requirement
    const generatedFeatures = [];
    const validationResults = [];
    
    for (let i = 0; i < requirements.length; i++) {
      const requirement = requirements[i];
      
      try {
        const response = await axios.post(`${API_BASE_URL}/api/generate-tests`, {
          content: `Requirement: ${requirement.requirement}\n\nAcceptance Criteria: ${requirement.acceptanceCriteria}`,
          context: context,
          requirementId: requirement.id,
          complexity: requirement.complexity || 'Medium',
          priority: requirement.priority || 'Medium'
        });
        
        if (response.data.success) {
          const testContent = response.data.content;
          
          // Validate test coverage
          const coverage = validateTestCoverage(testContent, requirement.requirement, requirement.acceptanceCriteria);
          
          const feature = {
            title: requirement.id || `REQ-${String(i + 1).padStart(3, '0')}`,
            content: testContent,
            originalContent: requirement.requirement,
            coverage: coverage
          };
          
          generatedFeatures.push(feature);
          validationResults.push({
            requirement: requirement.requirement,
            coverage: coverage
          });
        } else {
          console.error(`Failed to generate tests for requirement ${requirement.id}:`, response.data.error);
        }
      } catch (error) {
        console.error(`Error generating tests for requirement ${requirement.id}:`, error);
      }
    }
    
    if (generatedFeatures.length > 0) {
      // Add new features to existing tabs
      setFeatureTabs(prev => {
        const updatedTabs = [...prev, ...generatedFeatures];
        return updatedTabs;
      });
      
      // Initialize editable features for new sections
      setEditableFeatures(prev => {
        const editableFeaturesObj = {};
        generatedFeatures.forEach((feature, index) => {
          const globalIndex = (prev?.length || 0) + index;
          editableFeaturesObj[globalIndex] = feature.content;
        });
        return { ...prev, ...editableFeaturesObj };
      });
      
      // Combine all test content
      const allTestContent = generatedFeatures.map(f => f.content).join('\n\n---\n\n');
      setGeneratedTests(allTestContent);
      
      // Show coverage summary
      const totalScenarios = validationResults.reduce((sum, f) => sum + f.coverage.scenarioCount, 0);
      const totalPaths = validationResults.reduce((sum, f) => sum + f.coverage.expectedPaths, 0);
      const coveragePercentage = totalPaths > 0 ? Math.round((totalScenarios / totalPaths) * 100) : 0;
      
      // Clear requirements, generated test content, and the test generation textarea content
      setExtractedRequirements('');
      setGeneratedTests('');
      setContent('');
      
      setStatus({ 
        type: 'success', 
        message: `Generated ${totalScenarios} test scenarios for ${generatedFeatures.length} requirements! Coverage: ${coveragePercentage}% of expected paths.` 
      });
    } else {
      setStatus({ type: 'error', message: 'Failed to generate test cases for any requirements' });
    }
  } catch (error) {
    let errorMessage = 'Failed to generate test cases';
    
    if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    setStatus({ type: 'error', message: errorMessage });
  } finally {
    setIsLoading(false);
    setIsGenerating(false);
  }
};

/**
 * Refine existing test cases
 * @param {string} content - Current test content
 * @param {string} context - Context for refinement
 * @param {Function} setIsLoading - Function to set loading state
 * @param {Function} setStatus - Function to set status
 * @param {Function} setEditableFeatures - Function to update editable features
 * @param {Function} setFeatureTabs - Function to update feature tabs
 * @param {number} activeTab - Current active tab index
 * @param {string} currentDocumentName - Current document name
 * @returns {Promise<void>}
 */
export const refineTests = async (
  content,
  context,
  setIsLoading,
  setStatus,
  setEditableFeatures,
  setFeatureTabs,
  activeTab,
  currentDocumentName
) => {
  if (!content || !content.trim()) {
    setStatus({ type: 'error', message: 'No test cases available to refine' });
    return;
  }

  setIsLoading(true);
  setStatus({ type: 'info', message: 'Refining test cases...' });

  try {
    const response = await axios.post(`${API_BASE_URL}/api/refine-tests`, {
      content: content,
      feedback: 'Please improve the test cases based on best practices',
      context: context
    });

    if (response.data.success) {
      const refinedContent = response.data.content;
      
      // Update the editable features
      setEditableFeatures(prev => ({
        ...prev,
        [activeTab]: refinedContent
      }));
      
      // Update the feature tabs
      setFeatureTabs(prev => {
        const updatedTabs = [...prev];
        updatedTabs[activeTab] = {
          ...updatedTabs[activeTab],
          content: refinedContent
        };
        return updatedTabs;
      });
      
      // Save refined tests to cache if we have a current document
      if (currentDocumentName) {
        try {
          await axios.post(`${API_BASE_URL}/api/save-edited-tests`, {
            documentName: currentDocumentName,
            tests: refinedContent
          });
          setStatus({ type: 'success', message: 'Test cases refined and saved to cache!' });
        } catch (error) {
          console.error('Failed to save refined tests to cache:', error);
          setStatus({ type: 'success', message: 'Test cases refined!' });
        }
      } else {
        setStatus({ type: 'success', message: 'Test cases refined!' });
      }
    } else {
      setStatus({ type: 'error', message: response.data.error || 'Failed to refine test cases' });
    }
  } catch (error) {
    console.error('Error refining tests:', error);
    setStatus({ 
      type: 'error', 
      message: error.response?.data?.error || 'Failed to refine test cases' 
    });
  } finally {
    setIsLoading(false);
  }
};

/**
 * Validate test coverage
 * @param {string} testContent - Test case content
 * @param {string} requirement - Requirement text
 * @param {string} acceptanceCriteria - Acceptance criteria text
 * @returns {Object} - Coverage analysis
 */
export const validateTestCoverage = (testContent, requirement, acceptanceCriteria) => {
  const scenarios = (testContent.match(/Scenario:/g) || []).length;
  const givenSteps = (testContent.match(/Given /g) || []).length;
  const whenSteps = (testContent.match(/When /g) || []).length;
  const thenSteps = (testContent.match(/Then /g) || []).length;
  
  // Estimate expected paths based on requirement complexity
  const requirementWords = requirement.split(' ').length;
  const criteriaWords = acceptanceCriteria.split(' ').length;
  const expectedPaths = Math.max(2, Math.ceil((requirementWords + criteriaWords) / 20));
  
  const coveragePercentage = expectedPaths > 0 ? Math.round((scenarios / expectedPaths) * 100) : 100;
  
  return {
    scenarioCount: scenarios,
    givenSteps,
    whenSteps,
    thenSteps,
    expectedPaths,
    coveragePercentage: Math.min(coveragePercentage, 100)
  };
};

/**
 * Validate complexity values
 * @param {Array} requirements - Array of requirements
 * @returns {Array} - Requirements with validated complexity values
 */
export const validateComplexityValues = (requirements) => {
  return requirements.map(req => ({
    ...req,
    complexity: ['Low', 'Medium', 'High'].includes(req.complexity) ? req.complexity : 'Medium',
    priority: ['Low', 'Medium', 'High'].includes(req.priority) ? req.priority : 'Medium'
  }));
};

/**
 * Format requirements for insertion with generated IDs
 * @param {Array} requirements - Array of requirements
 * @returns {string} - Formatted requirements table
 */
export const formatRequirementsForInsertionWithGeneratedIds = (requirements) => {
  if (!requirements || requirements.length === 0) {
    return '';
  }
  
  // Generate IDs for requirements that don't have them
  const requirementsWithIds = requirements.map((req, index) => ({
    ...req,
    id: req.id || `REQ-${String(index + 1).padStart(3, '0')}`
  }));
  
  // Create the table header
  const headers = ['ID', 'Requirement', 'Acceptance Criteria', 'Complexity', 'Priority'];
  const headerRow = '| ' + headers.join(' | ') + ' |';
  const separatorRow = '|' + headers.map(() => '---').join('|') + '|';
  
  // Create table rows
  const rows = requirementsWithIds.map(req => {
    return `| ${req.id} | ${req.requirement} | ${req.acceptanceCriteria} | ${req.complexity} | ${req.priority} |`;
  });
  
  return [headerRow, separatorRow, ...rows].join('\n');
};
