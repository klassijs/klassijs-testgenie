// Utility functions for TestGenerator component
/**
 * Parses requirements table content and extracts structured requirements
 * @param {string} requirementsContent - The content containing requirements table
 * @param {string} requirementsSource - Source of requirements ('upload' or 'jira')
 * @param {string} jiraTicketPrefix - JIRA ticket prefix for ID generation
 * @param {Object} jiraTicketInfo - JIRA ticket information object
 * @param {Function} setJiraTicketPrefix - Function to set JIRA ticket prefix
 * @param {Function} setJiraTicketInfo - Function to set JIRA ticket info
 * @returns {Array} Array of requirement objects
 */
export const parseRequirementsTable = (requirementsContent, requirementsSource = 'upload', jiraTicketPrefix = '', jiraTicketInfo = {}, setJiraTicketPrefix = null, setJiraTicketInfo = null) => {
  // Validate requirements source consistency
  if (requirementsSource === 'upload' && (jiraTicketPrefix || Object.keys(jiraTicketInfo).length > 0)) {
    if (setJiraTicketPrefix) setJiraTicketPrefix('');
    if (setJiraTicketInfo) setJiraTicketInfo({});
  }
  
  const requirements = [];
  const lines = requirementsContent.split('\n');
  
  let inTable = false;
  let tableLines = [];
  
  // Find the table section by looking for the header
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // check for key words in the right order
    if (line.includes('|') && 
        line.toLowerCase().includes('requirement id') && 
        line.toLowerCase().includes('business requirement') && 
        line.toLowerCase().includes('acceptance criteria')) {
      inTable = true;
      continue;
    }
    
    if (inTable) {
      // Skip separator lines (lines with just dashes and pipes)
      if (line.trim().match(/^[\s\-|]+$/)) {
        continue;
      }
      
      // If we hit a completely empty line, check if there are more requirements below
      if (line.trim() === '') {
        // Look ahead a few lines to see if there are more requirements
        let hasMoreRequirements = false;
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const nextLine = lines[j];
          if (nextLine.includes('|') && nextLine.split('|').filter(col => col.trim()).length >= 3) {
            hasMoreRequirements = true;
            break;
          }
        }
        
        if (!hasMoreRequirements) {
          break; // End of table
        }
      }
      
      // Add any line that contains table data
      if (line.includes('|')) {
        tableLines.push(line);
      }
    }
  }
  
  // Parse table rows
  let requirementCounter = 0; // Use a separate counter for requirement IDs
  
  for (let i = 0; i < tableLines.length; i++) {
    const line = tableLines[i];
    const columns = line.split('|').map(col => col.trim()).filter(col => col);
    
    if (columns.length >= 3) {
      const [id, requirement, acceptanceCriteria] = columns;
      
      // Skip header row and separator rows (more flexible detection)
      if (id.toLowerCase().includes('requirement id') || 
          id.toLowerCase().includes('business requirement') ||
          id.toLowerCase().includes('acceptance criteria') ||
          id === '---' ||
          id.includes('---') ||
          requirement.includes('---') ||
          acceptanceCriteria.includes('---') ||
          id === '' ||
          requirement === '' ||
          acceptanceCriteria === '') {
        continue;
      }
      
      // Generate requirement ID based on source
      let generatedId;
      if (requirementsSource === 'jira' && jiraTicketPrefix) {
        // For Jira: use ticket prefix + sequential number
        requirementCounter++; // Increment counter for each valid requirement
        generatedId = `${jiraTicketPrefix}-${String(requirementCounter).padStart(3, '0')}`;
      } else {
        // For uploaded documents: use BR prefix
        requirementCounter++; // Increment counter for each valid requirement
        generatedId = `TG-${String(requirementCounter).padStart(3, '0')}`;
      }
      
      requirements.push({
        id: generatedId,
        requirement: requirement,
        acceptanceCriteria: acceptanceCriteria,
        complexity: columns[3] || 'CC: 1, Paths: 1'
      });
    }
  }
  
  return requirements;
};

/**
 * Validates test coverage against requirements and acceptance criteria
 * @param {string} testContent - The generated test content
 * @param {string} requirement - The business requirement
 * @param {string} acceptanceCriteria - The acceptance criteria
 * @returns {Object} Coverage analysis results
 */
export const validateTestCoverage = (testContent, requirement, acceptanceCriteria) => {
  try {
    const lines = testContent.split('\n');
    let scenarioCount = 0;
    let featureName = '';
    let complexityInfo = null;
    
    // Parse the test content
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Count scenarios
      if (trimmedLine.startsWith('Scenario:') || trimmedLine.startsWith('Scenario Outline:')) {
        scenarioCount++;
      }
      
      // Extract feature name
      if (trimmedLine.startsWith('Feature:')) {
        featureName = trimmedLine.replace('Feature:', '').trim();
      }
      
      // Extract complexity information
      if (trimmedLine.includes('CC:') || trimmedLine.includes('Paths:')) {
        complexityInfo = trimmedLine;
      }
    }
    
    // Analyze requirement complexity if not provided
    let expectedPaths = 1; // Default minimum
    if (complexityInfo) {
      const pathsMatch = complexityInfo.match(/Paths:\s*(\d+)/i);
      if (pathsMatch) {
        expectedPaths = parseInt(pathsMatch[1]);
      }
    } else {
      // Estimate complexity based on requirement content
      const hasDecisionPoints = requirement.toLowerCase().includes('if') || 
                              requirement.toLowerCase().includes('when') || 
                              requirement.toLowerCase().includes('else') ||
                              acceptanceCriteria.toLowerCase().includes('if') ||
                              acceptanceCriteria.toLowerCase().includes('when') ||
                              acceptanceCriteria.toLowerCase().includes('else');
      
      const hasMultipleConditions = (requirement.match(/and|or|but/gi) || []).length > 0 ||
                                 (acceptanceCriteria.match(/and|or|but/gi) || []).length > 0;
      
      if (hasDecisionPoints || hasMultipleConditions) {
        expectedPaths = Math.max(2, Math.min(5, scenarioCount)); // Estimate 2-5 paths
      }
    }
    
    // Calculate coverage metrics
    const coveragePercentage = expectedPaths > 0 ? Math.round((scenarioCount / expectedPaths) * 100) : 100;
    const isAdequateCoverage = scenarioCount >= expectedPaths;
    
    // Identify missing test types
    const missingTestTypes = [];
    if (scenarioCount < 3) missingTestTypes.push('negative test cases');
    if (scenarioCount < 2) missingTestTypes.push('edge cases');
    if (scenarioCount < expectedPaths) missingTestTypes.push('path coverage');
    
    return {
      scenarioCount,
      expectedPaths,
      coveragePercentage,
      isAdequateCoverage,
      missingTestTypes,
      featureName,
      complexityInfo
    };
  } catch (error) {
    console.error('Error validating test coverage:', error);
    return {
      scenarioCount: 0,
      expectedPaths: 1,
      coveragePercentage: 0,
      isAdequateCoverage: false,
      missingTestTypes: ['validation failed'],
      featureName: '',
      complexityInfo: null
    };
  }
};

/**
 * Formats file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size string
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Builds a hierarchical folder tree structure
 * @param {Array} folders - Array of folder objects
 * @returns {Array} Root folders with nested children
 */
export const buildFolderTree = (folders) => {
  const folderMap = new Map();
  const rootFolders = [];
  
  // Create a map of all folders
  folders.forEach(folder => {
    folderMap.set(folder.id, { ...folder, children: [] });
  });
  
  // Build the tree structure
  folders.forEach(folder => {
    if (folder.parentId && folderMap.has(folder.parentId)) {
      folderMap.get(folder.parentId).children.push(folderMap.get(folder.id));
    } else {
      rootFolders.push(folderMap.get(folder.id));
    }
  });
  
  return rootFolders;
};

/**
 * Fetches loading images from the API
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<Array>} Array of loading images
 */
export const fetchLoadingImages = async (API_BASE_URL) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/loading-images`);
    const data = await response.json();
    
    if (data.success) {
      return data.images;
    } else {
      // Fallback to static images if API fails
      const fallbackImages = [
        { image: "the-documentation-that-shapes-them.png", title: "Analyzing Requirements" },
        { image: "Google's Updated Spam Policy - Repeated_.jpeg", title: "Creating Test Scenarios" },
        { image: "Paperwork Robot Stock Illustrations_.png", title: "Adding Edge Cases" },
        { image: "A robot eating a stack of pancakes with_.png", title: "Generating Negative Tests" }
      ];
      return fallbackImages;
    }
  } catch (error) {
    // Fallback to static images if API fails
    const fallbackImages = [
      { image: "the-documentation-that-shapes-them.png", title: "Analyzing Requirements" },
      { image: "Google's Updated Spam Policy - Repeated_.jpeg", title: "Creating Test Scenarios" },
      { image: "Paperwork Robot Stock Illustrations_.png", title: "Adding Edge Cases" },
      { image: "A robot eating a stack of pancakes with_.png", title: "Generating Negative Tests" }
    ];
    return fallbackImages;
  }
};

/**
 * Formats requirements for insertion with generated IDs
 * @param {Array} requirements - Array of requirement objects
 * @returns {string} Formatted requirements content
 */
export const formatRequirementsForInsertionWithGeneratedIds = (requirements) => {
  let formattedContent = 'Business Requirements:\n\n';
  
  // Add header row
  formattedContent += '| Requirement ID | Business Requirement | Acceptance Criteria | Complexity |\n';
  formattedContent += '|---|---|---|---|\n';
  
  // Add data rows with generated IDs
  requirements.forEach(req => {
    formattedContent += `| ${req.id} | ${req.requirement} | ${req.acceptanceCriteria} | ${req.complexity || 'CC: 1, Paths: 1'} |\n`;
  });
  
  return formattedContent.trim();
};

/**
 * Handles content download
 * @param {string} extractedRequirements - The requirements content to download
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<void>}
 */
export const handleDownloadContent = async (extractedRequirements, API_BASE_URL) => {
  try {
    // Generate Word document using backend API
    const response = await fetch(`${API_BASE_URL}/api/generate-word-doc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: extractedRequirements,
        title: 'Business Requirements'
      })
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'business-requirements.docx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } else {
      throw new Error('Failed to generate document');
    }
  } catch (error) {
    console.error('Error downloading content:', error);
    throw error;
  }
};

/**
 * Validates complexity values in requirements
 * @param {Array} requirements - Array of requirement objects
 * @returns {Array} Array of warning messages
 */
export const validateComplexityValues = (requirements) => {
  const warnings = [];
  
  requirements.forEach((req, index) => {
    const complexity = req.complexity || '';
    
    // Check if complexity follows the expected format
    const complexityMatch = complexity.match(/CC:\s*(\d+),\s*Decision Points:\s*(\d+),\s*Activities:\s*(\d+),\s*Paths:\s*(\d+)/);
    
    if (!complexityMatch) {
      warnings.push(`Requirement ${req.id}: Invalid complexity format. Expected: "CC: X, Decision Points: Y, Activities: Z, Paths: W"`);
      return;
    }
    
    const [, cc, decisionPoints, activities, paths] = complexityMatch.map(Number);
    
    // Validate the formula: CC = E - N + 2P (where E=edges, N=nodes, P=components)
    // For individual requirements, estimate edges and nodes
    const estimatedEdges = decisionPoints + 1; // At least one flow per decision point
    const estimatedNodes = decisionPoints + activities + 1; // Include start/end events
    const estimatedComponents = 1; // Single workflow component
    const calculatedCC = estimatedEdges - estimatedNodes + (2 * estimatedComponents);
    
    if (Math.abs(cc - calculatedCC) > 2) { // Allow some variance for estimation
      warnings.push(`Requirement ${req.id}: Complexity may be inaccurate. Estimated CC: ${calculatedCC} (E:${estimatedEdges} - N:${estimatedNodes} + 2P:${estimatedComponents}), got: ${cc}`);
    }
    
    // Check for reasonable values
    if (cc > 50) {
      warnings.push(`Requirement ${req.id}: Extremely high complexity (${cc}). Consider breaking down this requirement.`);
    }
    
    if (paths > 20) {
      warnings.push(`Requirement ${req.id}: Very high path count (${paths}). Consider simplifying the workflow.`);
    }
    
    if (decisionPoints > 10) {
      warnings.push(`Requirement ${req.id}: Many decision points (${decisionPoints}). Consider breaking into smaller requirements.`);
    }
  });
  
  return warnings;
};
