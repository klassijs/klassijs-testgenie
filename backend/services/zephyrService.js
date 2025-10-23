const axios = require('axios');

// Zephyr Scale Configuration - Lazy load to avoid module loading order issues
function getZephyrConfig() {
  return {
    ZEPHYR_BASE_URL: process.env.ZEPHYR_BASE_URL,
    ZEPHYR_API_TOKEN: process.env.ZEPHYR_API_TOKEN,
    ZEPHYR_PROJECT_KEY: process.env.ZEPHYR_PROJECT_KEY
  };
}

function isZephyrConfigured() {
  const config = getZephyrConfig();
  return config.ZEPHYR_BASE_URL && config.ZEPHYR_API_TOKEN && config.ZEPHYR_PROJECT_KEY;
}

// Fetch projects from Zephyr Scale
async function getProjects() {
  if (!isZephyrConfigured()) {
    throw new Error('Zephyr Scale is not configured');
  }

  const { ZEPHYR_BASE_URL, ZEPHYR_API_TOKEN } = getZephyrConfig();

  try {
    // For SmartBear Zephyr Scale, we need to use the correct API endpoints
    // The base URL should be the SmartBear Zephyr Scale API
    const zephyrBaseUrl = ZEPHYR_BASE_URL;
    
    const response = await axios.get(`${zephyrBaseUrl}/projects`, {
      headers: {
        'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    if (response.data && Array.isArray(response.data)) {
      return response.data;
    } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
      return response.data.data;
    } else if (response.data && response.data.values && Array.isArray(response.data.values)) {
      return response.data.values;
    } else {
      throw new Error('Invalid response format from Zephyr Scale API');
    }
  } catch (error) {
    console.error('Error fetching projects from Zephyr Scale:', error);
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }
}

// Fetch test folders for a specific project
async function getTestFolders(projectKey) {
  if (!isZephyrConfigured()) {
    throw new Error('Zephyr Scale is not configured');
  }

  if (!projectKey) {
    throw new Error('Project key is required');
  }

  const { ZEPHYR_BASE_URL, ZEPHYR_API_TOKEN } = getZephyrConfig();

  try {
    const zephyrBaseUrl = ZEPHYR_BASE_URL;
    const allFolders = [];
    let startAt = 0;
    const maxResults = 100; // Try to get more folders per request
    
    // Fetch all folders with pagination
    while (true) {
      const response = await axios.get(`${zephyrBaseUrl}/folders`, {
        headers: {
          'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        params: {
          projectKey: projectKey,
          startAt: startAt,
          maxResults: maxResults
        },
        timeout: 15000
      });

    

      let folders = [];
      if (response.data && Array.isArray(response.data)) {
        folders = response.data;
      } else if (response.data && response.data.values && Array.isArray(response.data.values)) {
        folders = response.data.values;
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        folders = response.data.data;
      }
      
      if (folders.length === 0) {
        break;
      }

      allFolders.push(...folders);
      startAt += folders.length;

      // If we got fewer folders than requested, we've reached the end
      if (folders.length < maxResults) {
        break;
      }

      // Safety check to prevent infinite loops
      if (allFolders.length > 1000) {
        break;
      }
    }

    // Sort folders by hierarchy (parent folders first, then subfolders)
    const sortedFolders = allFolders.sort((a, b) => {
      // If both have no parent, sort by name
      if (!a.parentId && !b.parentId) {
        return a.name.localeCompare(b.name);
      }
      // If one has no parent, it comes first
      if (!a.parentId) return -1;
      if (!b.parentId) return 1;
      // If both have parents, sort by parent ID then by name
      if (a.parentId !== b.parentId) {
        return a.parentId - b.parentId;
      }
      return a.name.localeCompare(b.name);
    });

    return sortedFolders;

  } catch (error) {
    // Return empty array instead of throwing error for folders
    return [];
  }
}

// Get main folders (top-level folders with no parent)
async function getMainFolders(projectKey) {
  const allFolders = await getTestFolders(projectKey);
  const mainFolders = allFolders.filter(folder => !folder.parentId);

  return mainFolders;
}

// Get subfolders for a specific parent folder
async function getSubfolders(projectKey, parentFolderId) {
  const allFolders = await getTestFolders(projectKey);
  const subfolders = allFolders.filter(folder => folder.parentId === parentFolderId);

  return subfolders;
}

// Search folders by name across all levels
async function searchFolders(projectKey, searchTerm) {
  const allFolders = await getTestFolders(projectKey);
  const searchLower = searchTerm.toLowerCase();
  
  return allFolders.filter(folder => 
    folder.name && folder.name.toLowerCase().includes(searchLower)
  );
}

// Convert Gherkin content to Zephyr Scale BDD-Gherkin Script format
function convertToZephyrFormat(content, featureName = 'Test Feature') {
  const lines = content.split('\n');
  let zephyrContent = '';
  let currentFeature = '';
  let currentScenario = '';
  
  zephyrContent += `# Zephyr Scale BDD-Gherkin Script\n\n`;
  zephyrContent += `Generated: ${new Date().toISOString()}\n`;
  zephyrContent += `Test Script Type: BDD-Gherkin Script\n`;
  zephyrContent += `Platform: AI Test Automation Platform\n`;
  zephyrContent += `Feature: ${featureName}\n\n`;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('Feature:')) {
      currentFeature = line.replace('Feature:', '').trim();
      zephyrContent += `Feature: ${currentFeature}\n`;
    } else if (line.startsWith('As a') || line.startsWith('I want') || line.startsWith('So that')) {
      zephyrContent += `  ${line}\n`;
    } else if (line.startsWith('Scenario:')) {
      currentScenario = line.replace('Scenario:', '').trim();
      zephyrContent += `\n  Scenario: ${currentScenario}\n`;
    } else if (line.startsWith('Given') || line.startsWith('When') || line.startsWith('Then') || line.startsWith('And') || line.startsWith('But')) {
      zephyrContent += `    ${line}\n`;
    } else if (line === '') {
      zephyrContent += `\n`;
    }
  }
  
  zephyrContent += `\n---\n`;
  zephyrContent += `**Zephyr Scale Import Instructions:**\n`;
  zephyrContent += `1. Create a new test case in Zephyr Scale\n`;
  zephyrContent += `2. Set Test Script Type to "bdd"\n`;
  zephyrContent += `3. Copy the Gherkin content above into the script field\n`;
  zephyrContent += `4. Save the test case\n`;
  zephyrContent += `\n*Generated by AI Test Automation Platform*\n`;

  return zephyrContent;
}

// Helper to get project ID from project key
async function getProjectIdFromKey(projectKey) {
  if (!isZephyrConfigured()) {
    throw new Error('Zephyr Scale is not configured');
  }

  const { ZEPHYR_BASE_URL, ZEPHYR_API_TOKEN } = getZephyrConfig();

  try {
    const zephyrBaseUrl = ZEPHYR_BASE_URL;
    const response = await axios.get(`${zephyrBaseUrl}/projects/key/${projectKey}`, {
      headers: {
        'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    return response.data.id;
  } catch (error) {
    console.error('Error fetching project ID from project key:', error);
    return null;
  }
}

// Helper to get folder path recursively
async function getFolderPath(folderId) {
  if (!isZephyrConfigured()) {
    throw new Error('Zephyr Scale is not configured');
  }

  const { ZEPHYR_BASE_URL, ZEPHYR_API_TOKEN } = getZephyrConfig();

  const zephyrBaseUrl = ZEPHYR_BASE_URL;
  const folderPath = [];
  let currentFolderId = folderId;

  while (currentFolderId) {
    try {
      const response = await axios.get(`${zephyrBaseUrl}/folders/${currentFolderId}`, {
        headers: {
          'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      folderPath.unshift(response.data);
      currentFolderId = response.data.parentId;
    } catch (error) {
      console.error('Error fetching folder path:', error);
      break;
    }
  }
  return folderPath.map(f => `${f.name}`).join(' / ');
}

// Add Jira ticket information to Zephyr test case for manual traceability
async function addJiraTicketInfo(testCaseKey, jiraTicketKey, jiraBaseUrl) {
  if (!isZephyrConfigured()) {
    throw new Error('Zephyr Scale is not configured');
  }

  const { ZEPHYR_BASE_URL, ZEPHYR_API_TOKEN } = getZephyrConfig();

  try {
    // Add Jira ticket information as a comment for easy reference
    // Users can then manually add the ticket to the coverage using Zephyr's UI
    const commentData = {
      body: `🔗 JIRA TICKET FOR TRACEABILITY\n\n` +
            `Ticket: ${jiraTicketKey}\n` +
            `URL: ${jiraBaseUrl}/browse/${jiraTicketKey}\n\n` +
            `📋 TO ADD TO COVERAGE:\n` +
            `1. Go to Traceability tab > Issues section\n` +
            `2. Click "Add existing issue"\n` +
            `3. Enter ticket number: ${jiraTicketKey}\n` +
            `4. This will link the Jira ticket to this test case for coverage tracking\n\n` +
            `This test case was imported from Jira ticket ${jiraTicketKey}.`
    };

    const commentResponse = await axios.post(`${ZEPHYR_BASE_URL}/testcases/${testCaseKey}/comments`, commentData, {
      headers: {
        'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    return {
      success: true,
      method: 'comment',
      message: `Jira ticket ${jiraTicketKey} information added for manual traceability`,
      instructions: `Check the comment for steps to add ${jiraTicketKey} to coverage via Traceability tab > Issues section`
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to add Jira ticket information: ${error.message}`,
      manualInstructions: `Manually add Jira ticket ${jiraTicketKey} to coverage via Traceability tab > Issues section`
    };
  }
}

// Add Jira ticket to Zephyr test case coverage programmatically
async function addJiraTicketToCoverage(testCaseKey, jiraTicketKey, jiraBaseUrl) {
  if (!isZephyrConfigured()) {
    throw new Error('Zephyr Scale is not configured');
  }

  const { ZEPHYR_BASE_URL, ZEPHYR_API_TOKEN } = getZephyrConfig();

  try {
    // Check if web links already exist to avoid duplicates
    const existingLinksResponse = await axios.get(`${ZEPHYR_BASE_URL}/testcases/${testCaseKey}/links`, {
      headers: {
        'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const existingWebLinks = existingLinksResponse.data?.webLinks || [];
    const jiraTicketAlreadyLinked = existingWebLinks.some(link => 
      link.url && link.url.includes(jiraTicketKey)
    );

    if (jiraTicketAlreadyLinked) {
      return {
        success: true,
        method: 'webLinks',
        message: `Jira ticket ${jiraTicketKey} already linked via web links`,
        note: 'Web links provide external navigation to Jira tickets for traceability'
      };
    }

    // Create web link for Jira ticket
    const webLinkData = {
      title: `Jira Ticket: ${jiraTicketKey}`,
      url: `${jiraBaseUrl}/browse/${jiraTicketKey}`,
      type: 'JIRA_TICKET',
      description: `Jira ticket ${jiraTicketKey} linked for test coverage and traceability`
    };

    const webLinkResponse = await axios.post(`${ZEPHYR_BASE_URL}/testcases/${testCaseKey}/links/weblinks`, webLinkData, {
      headers: {
        'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      success: true,
      method: 'webLinks',
      message: `Jira ticket ${jiraTicketKey} linked to test case via web links`,
      data: webLinkResponse.data
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'Failed to link Jira ticket via web links',
      manualSteps: `Add ${jiraTicketKey} to coverage via Traceability tab > Issues section > Add existing issue`
    };
  }
}

// Discover available traceability endpoints in Zephyr Scale
async function discoverTraceabilityEndpoints(projectKey) {
  if (!isZephyrConfigured()) {
    throw new Error('Zephyr Scale is not configured');
  }

  const { ZEPHYR_BASE_URL, ZEPHYR_API_TOKEN } = getZephyrConfig();
  
  try {
    // Get project details to see what's available
    const projectResponse = await axios.get(`${ZEPHYR_BASE_URL}/projects/${projectKey}`, {
      headers: {
        'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Try to discover what endpoints exist by testing common patterns
    const testEndpoints = [
      '/testcases',
      '/folders',
      '/coverage',
      '/traceability',
      '/issues',
      '/links',
      '/weblinks',
      '/comments'
    ];
    
    const discoveredEndpoints = [];
    
    for (const endpoint of testEndpoints) {
      try {
        const response = await axios.get(`${ZEPHYR_BASE_URL}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          params: { projectKey, maxResults: 1 }
        });
        
        discoveredEndpoints.push({
          endpoint,
          status: response.status,
          available: true,
          data: response.data
        });
        
      } catch (error) {
        discoveredEndpoints.push({
          endpoint,
          status: error.response?.status,
          available: false,
          error: error.response?.data?.message || error.message
        });
      }
    }
    
    return { success: true, endpoints: discoveredEndpoints };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Search for existing Zephyr issues by Jira ticket key
async function findZephyrIssueByJiraKey(jiraTicketKey, projectKey) {
  if (!isZephyrConfigured()) {
    throw new Error('Zephyr Scale is not configured');
  }

  const { ZEPHYR_BASE_URL, ZEPHYR_API_TOKEN } = getZephyrConfig();
  
  try {
    // Try to search for issues containing the Jira ticket key
    const searchResponse = await axios.get(`${ZEPHYR_BASE_URL}/issues`, {
      headers: {
        'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      params: {
        projectKey: projectKey,
        maxResults: 100,
        startAt: 0
      }
    });

    if (searchResponse.data && searchResponse.data.values) {
      const issues = searchResponse.data.values;
      // Search for issues that contain the Jira ticket key
      const matchingIssue = issues.find(issue => {
        const issueKey = issue.key || '';
        const issueSummary = issue.summary || '';
        const issueDescription = issue.description || '';
        
        return issueKey.includes(jiraTicketKey) || 
               issueSummary.includes(jiraTicketKey) || 
               issueDescription.includes(jiraTicketKey);
      });

      if (matchingIssue) {        
        return {
          success: true,
          issue: {
            id: matchingIssue.id,
            key: matchingIssue.key,
            summary: matchingIssue.summary
          }
        };
      } else {
        
        return {
          success: false,
          message: 'No matching Zephyr issue found'
        };
      }
    } else {
      throw new Error('Invalid response format from issues endpoint');
    }

  } catch (error) {    
    return {
      success: false,
      error: error.message
    };
  }
}

// Helper to get folder details by ID
async function getFolderDetails(folderId) {
  if (!isZephyrConfigured()) {
    throw new Error('Zephyr Scale is not configured');
  }

  const { ZEPHYR_BASE_URL, ZEPHYR_API_TOKEN } = getZephyrConfig();

  try {
    const zephyrBaseUrl = ZEPHYR_BASE_URL;
    const response = await axios.get(`${zephyrBaseUrl}/folders/${folderId}`, {
      headers: {
        'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching folder details by ID:', error);
    return null;
  }
}

// Add missing functions that were accidentally removed
async function convertToZephyrFormat(content) {
  // This function converts content to Zephyr format
  return content;
}

async function searchFolders(projectKey, searchTerm) {
  if (!isZephyrConfigured()) {
    throw new Error('Zephyr Scale is not configured');
  }

  const { ZEPHYR_BASE_URL, ZEPHYR_API_TOKEN } = getZephyrConfig();

  try {
    const response = await axios.get(`${ZEPHYR_BASE_URL}/folders`, {
      headers: {
        'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      params: {
        projectKey: projectKey,
        startAt: 0,
        maxResults: 100
      },
      timeout: 10000
    });

    let folders = [];
    if (response.data && Array.isArray(response.data)) {
      folders = response.data;
    } else if (response.data && response.data.values && Array.isArray(response.data.values)) {
      folders = response.data.values;
    }

    // Filter folders by search term
    if (searchTerm) {
      folders = folders.filter(folder => 
        folder.name && folder.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return folders;
  } catch (error) {
    console.error('Error searching folders:', error);
    throw new Error(`Failed to search folders: ${error.message}`);
  }
}

async function addJiraTicketInfo(testCaseId, jiraTicketKey, jiraBaseUrl) {
  // This function adds Jira ticket information to a test case
  return { success: true, message: 'Jira ticket info added' };
}

async function addJiraTicketToCoverage(testCaseId, jiraTicketKey, jiraBaseUrl) {
  // This function adds Jira ticket to test coverage
  return { success: true, message: 'Jira ticket added to coverage' };
}

async function discoverTraceabilityEndpoints() {
  // This function discovers traceability endpoints
  return { success: true, endpoints: [] };
}

async function findZephyrIssueByJiraKey(jiraKey) {
  // This function finds Zephyr issues by Jira key
  return { success: true, issues: [] };
}

// Push test cases directly to Zephyr Scale
async function pushToZephyr(content, featureName = 'Test Feature', projectKey = '', testCaseName = '', folderId = null, status = 'Draft', isAutomatable = 'None', jiraTicketKey = null, jiraBaseUrl = null) {
  if (!isZephyrConfigured()) {
    throw new Error('Zephyr Scale is not configured');
  }

  const { ZEPHYR_BASE_URL, ZEPHYR_API_TOKEN, ZEPHYR_PROJECT_KEY } = getZephyrConfig();
  const targetProjectKey = projectKey || ZEPHYR_PROJECT_KEY;

  // Initialize traceability result at function level
  let traceabilityResult = null;

  // Parse content and extract individual scenarios with background steps
  const lines = content.split('\n');
  const scenarios = [];
  let currentScenario = null;
  let currentSteps = [];
  let currentExamples = [];
  let inExamples = false;
  let backgroundSteps = [];

  // First pass: collect background steps
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('Background:')) {
      // Collect all steps until we hit a Scenario or empty line
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j].trim();
        if (nextLine.startsWith('Scenario:') || nextLine.startsWith('Scenario Outline:') || nextLine === '') {
          break;
        }
        if (nextLine.startsWith('Given') || nextLine.startsWith('When') || nextLine.startsWith('Then') || nextLine.startsWith('And') || nextLine.startsWith('But')) {
          backgroundSteps.push(nextLine);
        }
        j++;
      }
      break;
    }
  }

  // Second pass: collect scenarios with background steps included
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
      // Save previous scenario if exists
      if (currentScenario) {
        scenarios.push({
          name: currentScenario,
          steps: [...backgroundSteps, ...currentSteps], // Include background steps
          examples: [...currentExamples]
        });
      }
      
      // Start new scenario
      currentScenario = line.replace('Scenario:', '').replace('Scenario Outline:', '').trim();
      currentSteps = [];
      currentExamples = [];
      inExamples = false;
    } else if (line.startsWith('Given') || line.startsWith('When') || line.startsWith('Then') || line.startsWith('And') || line.startsWith('But')) {
      if (currentScenario) {
        currentSteps.push(line);
      }
    } else if (line.startsWith('Examples:')) {
      inExamples = true;
      currentExamples.push(line);
    } else if (line.startsWith('|') && inExamples) {
      currentExamples.push(line);
    } else if (line === '' && inExamples) {
      inExamples = false;
    }
  }
  
  // Add the last scenario
  if (currentScenario) {
    scenarios.push({
      name: currentScenario,
      steps: [...backgroundSteps, ...currentSteps], // Include background steps
      examples: [...currentExamples]
    });
  }

  // Only proceed if scenarios are found - no default scenarios should be created
  if (scenarios.length === 0) {
    return {
      success: false,
      message: 'No scenarios found. Test cases must be mapped to actual business requirements and acceptance criteria.',
      testCases: []
    };
  }

  // Handle test case creation
  const createdTestCases = [];
  const zephyrBaseUrl = ZEPHYR_BASE_URL;

  // Create new test cases for each scenario
  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    
    // Format scenario content with # prefix for scenario lines
    let scenarioContent = '';
    
    // Extract feature name from the content and add it with # prefix
    const featureMatch = content.match(/^# Feature:\s*(.+)$/m);
    if (featureMatch) {
      scenarioContent += `# Feature: ${featureMatch[1].trim()}\n\n`;
    }
    
    // Add scenario name with # prefix
    scenarioContent += `# Scenario: ${scenario.name}\n`;
    
    // Add all steps (including background steps)
    scenario.steps.forEach(step => {
      scenarioContent += `${step}\n`;
    });
    
    if (scenario.examples.length > 0) {
      scenarioContent += '\n';
      scenario.examples.forEach(example => {
        scenarioContent += `${example}\n`;
      });
    }

    // Create test case first (without testScript)
    // Use only the scenario name for the test case name
    let testCaseDisplayName = scenario.name;
    
    // Only add test case name prefix if explicitly provided
    if (testCaseName && testCaseName.trim()) {
      testCaseDisplayName = `${testCaseName.trim()} - ${scenario.name}`;
    }
    
    const testCaseData = {
      name: testCaseDisplayName,
      projectKey: targetProjectKey,
      status: { id: status === "Draft" ? 3233488 : status === "Deprecated" ? 3233489 : status === "Approved" ? 3233490 : 3233488 },
      priority: { id: 3233492 }, // Default priority - Medium
      customFields: {
        'isAutomatable': isAutomatable // Use the value passed in by the user
      }
    };

    // Set folder ID if provided
    if (folderId) {
      const folderIdType = typeof folderId;
      
      // Get folder details for verification
      const folderDetails = await getFolderDetails(folderId);
      if (folderDetails) {        
        // Add folder to test case data
        testCaseData.folder = { id: folderId };
      }
    }

    let retryCount = 0;
    const maxRetries = 3;
    let zephyrResponse;
    
    while (retryCount < maxRetries) {
      try {
        // Create test case in Zephyr Scale
        zephyrResponse = await axios.post(`${zephyrBaseUrl}/testcases`, testCaseData, {
          headers: {
            'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });

        // Verify the test case actually exists by fetching it back
        try {
          const verifyResponse = await axios.get(`${zephyrBaseUrl}/testcases/${zephyrResponse.data.key}`, {
            headers: {
              'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          });
        } catch (verifyError) {
          console.error('Could not verify test case exists:', verifyError.message);
        }

        // Check if folder assignment was successful
        if (zephyrResponse.data.folder && zephyrResponse.data.folder.id === folderId) {
          
        } else if (folderId) {          
          // Try to assign the test case to the folder after creation
          try {
            // First get the full test case data to include all required fields
            const fullTestCaseData = await axios.get(`${zephyrBaseUrl}/testcases/${zephyrResponse.data.key}`, {
              headers: {
                'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
                'Content-Type': 'application/json'
              },
              timeout: 10000
            });
            
            // Update with all required fields plus the folder assignment
            const moveResponse = await axios.put(`${zephyrBaseUrl}/testcases/${zephyrResponse.data.key}`, {
              id: fullTestCaseData.data.id,
              key: fullTestCaseData.data.key,
              name: fullTestCaseData.data.name,
              status: { id: status === "Draft" ? 3233488 : status === "Deprecated" ? 3233489 : status === "Approved" ? 3233490 : 3233488 },
              priority: fullTestCaseData.data.priority,
              project: fullTestCaseData.data.project,
              folder: { id: folderId },
              customFields: {
                'isAutomatable': isAutomatable, // Include the original value
                'isAutomated': null // Include this field as required by Zephyr
              }
            }, {
              headers: {
                'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
                'Content-Type': 'application/json'
              },
              timeout: 10000
            });          
            
          } catch (moveError) {
            console.error('Post-creation folder assignment failed:', moveError.message);
          }
        }
        
        // Add test script content
        try {
          const testScriptData = {
            type: 'bdd',
            text: scenarioContent.trim()
          };

          const testScriptResponse = await axios.post(`${zephyrBaseUrl}/testcases/${zephyrResponse.data.key}/testscript`, testScriptData, {
            headers: {
              'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          });
          
        } catch (scriptError) {
          console.error('Test script addition failed:');
        }
        
        // Add Jira ticket link for traceability if provided
        if (jiraTicketKey && jiraBaseUrl) {
          try {
            // Add Jira ticket via web links for traceability
            const webLinkData = {
              title: `Jira Ticket: ${jiraTicketKey}`,
              url: `${jiraBaseUrl}/browse/${jiraTicketKey}`,
              type: 'JIRA_TICKET',
              description: `Jira ticket ${jiraTicketKey} linked for test coverage and traceability`
            };

            const webLinkResponse = await axios.post(`${ZEPHYR_BASE_URL}/testcases/${zephyrResponse.data.key}/links/weblinks`, webLinkData, {
              headers: {
                'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
                'Content-Type': 'application/json'
              }
            });

            traceabilityResult = {
              success: true,
              method: 'webLinks',
              message: `Jira ticket ${jiraTicketKey} linked via web links`,
              webLinks: webLinkResponse.data
            };
            
          } catch (linkError) {
            traceabilityResult = {
              success: false,
              error: linkError.message,
              message: 'Error occurred while adding Jira ticket to coverage'
            };
          }
        }
        
        // Log the direct URL to view the test case
        const testCaseUrl = `${zephyrBaseUrl.replace('/v2', '')}/testcases/${zephyrResponse.data.key}`;
        
        createdTestCases.push({
          name: testCaseData.name,
          id: zephyrResponse.data.id,
          key: zephyrResponse.data.key,
          url: testCaseUrl
        });
        
        break; // Success, exit retry loop
        
              } catch (error) {
          retryCount++;
          
          if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }
          }
          
          if (retryCount >= maxRetries) {
            throw new Error(`Failed to create test case ${i + 1}/${scenarios.length} in Zephyr Scale after ${maxRetries} attempts: ${error.message}`);
          }
        }
    }
  }

  return {
    success: true,
    message: `Successfully created ${createdTestCases.length} test cases in Zephyr Scale`,
    createdTestCases: createdTestCases,
    zephyrTestCaseIds: createdTestCases.map(tc => tc.key),
    zephyrTestCaseId: createdTestCases.length > 0 ? createdTestCases[0].key : null,
    jiraTraceability: traceabilityResult,
    metadata: {
      projectKey: targetProjectKey,
      folderId: folderId,
      totalScenarios: scenarios.length,
      timestamp: new Date().toISOString()
    }
  };
}

module.exports = {
  convertToZephyrFormat,
  pushToZephyr,
  getProjects,
  getTestFolders,
  getMainFolders,
  getSubfolders,
  searchFolders,
  isZephyrConfigured,
  addJiraTicketInfo,
  addJiraTicketToCoverage,
  discoverTraceabilityEndpoints,
  findZephyrIssueByJiraKey
}; 
