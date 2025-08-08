const axios = require('axios');

// Zephyr Scale Configuration
const ZEPHYR_BASE_URL = process.env.ZEPHYR_BASE_URL;
const ZEPHYR_API_TOKEN = process.env.ZEPHYR_API_TOKEN;
const ZEPHYR_PROJECT_KEY = process.env.ZEPHYR_PROJECT_KEY;

const isZephyrConfigured = ZEPHYR_BASE_URL && ZEPHYR_API_TOKEN && ZEPHYR_PROJECT_KEY;

// Fetch projects from Zephyr Scale
async function getProjects() {
  if (!isZephyrConfigured) {
    throw new Error('Zephyr Scale is not configured');
  }

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
  if (!isZephyrConfigured) {
    throw new Error('Zephyr Scale is not configured');
  }

  if (!projectKey) {
    throw new Error('Project key is required');
  }

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

// Push test cases directly to Zephyr Scale
async function pushToZephyr(content, featureName = 'Test Feature', projectKey = '', testCaseName = '', folderId = null, status = 'Draft', isAutomatable = 'None', testCaseIds = null) {
  if (!isZephyrConfigured) {
    throw new Error('Zephyr Scale is not configured');
  }

  const targetProjectKey = projectKey || ZEPHYR_PROJECT_KEY;

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

  // If no scenarios found, create a default one
  if (scenarios.length === 0) {
    scenarios.push({
      name: featureName,
      steps: [
        'Given the user is on the page',
        'When the user performs an action',
        'Then the user should see the expected result'
      ],
      examples: []
    });
  }

      // Handle test case creation/update
    const createdTestCases = [];
    const zephyrBaseUrl = ZEPHYR_BASE_URL;
    const endpoint = `${zephyrBaseUrl}/testcases`;

    if (testCaseIds && Array.isArray(testCaseIds) && testCaseIds.length > 0 && testCaseIds.every(id => id !== null && id !== undefined)) {
      // Update existing test cases - update each test case with its corresponding scenario
      for (let i = 0; i < Math.min(scenarios.length, testCaseIds.length); i++) {
        const scenario = scenarios[i];
        const testCaseId = testCaseIds[i];
        
        if (!testCaseId) continue; // Skip if no test case ID for this scenario
        
        let scenarioContent = '';
        scenarioContent += `# Scenario: ${scenario.name}\n`;
        scenario.steps.forEach(step => {
          scenarioContent += `${step}\n`;
        });
        if (scenario.examples.length > 0) {
          scenarioContent += '\n';
          scenario.examples.forEach(example => {
            scenarioContent += `${example}\n`;
          });
        }

        let retryCount = 0;
        const maxRetries = 3;
        let zephyrResponse;
        
        while (retryCount < maxRetries) {
          try {
            // First get the existing test case data
            const existingTestCaseResponse = await axios.get(`${endpoint}/${testCaseId}`, {
              headers: {
                'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
                'Content-Type': 'application/json'
              },
              timeout: 30000
            });
            
            // Update existing test case - include required fields
            const updateData = {
              id: existingTestCaseResponse.data.id,
              key: existingTestCaseResponse.data.key,
              name: existingTestCaseResponse.data.name, // Keep the original name
              project: {
                id: existingTestCaseResponse.data.project.id
              },
              status: {
                id: status === "Draft" ? 3233488 : status === "Deprecated" ? 3233489 : 3233490
              },
              priority: {
                id: 3233492
              },
              customFields: {
                'isAutomatable': isAutomatable,
                'isAutomated': null
              }
            };
            

            
            zephyrResponse = await axios.put(`${endpoint}/${testCaseId}`, updateData, {
              headers: {
                'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
                'Content-Type': 'application/json'
              },
              timeout: 30000
            });
          
            // Now add the test script to the updated test case
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
        
        // Update the test case status
        try {
          // Try different approaches for status update
          const statusUpdateData = {
            id: zephyrResponse.data.id,
            key: zephyrResponse.data.key,
            name: scenario.name,
            project: {
              id: 177573
            },
            priority: {
              id: 3233492
            },
            status: {
              id: status === "Draft" ? 3233488 : status === "Deprecated" ? 3233489 : 3233490
            },
            customFields: {
              'isAutomatable': isAutomatable,
              'isAutomated': null
            }
          };
          
          const statusUpdateResponse = await axios.put(`${zephyrBaseUrl}/testcases/${zephyrResponse.data.key}`, statusUpdateData, {
            headers: {
              'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          });
          
        } catch (statusError) {
          // Status update failed, continue silently
        }
        
      } catch (scriptError) {
        // Test script addition failed, continue silently
      }
      
      // Log the direct URL to view the test case
      const testCaseUrl = `${zephyrBaseUrl.replace('/v2', '')}/testcases/${zephyrResponse.data.key}`;
      
            createdTestCases.push({
              name: scenario.name,
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
              throw new Error(`Failed to update test case ${i + 1} in Zephyr Scale after ${maxRetries} attempts: ${error.message}`);
            }
          }
        }
      }
  
  } else {
    // Create new test cases for each scenario
    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      
      // Format scenario content with # prefix for scenario lines
      let scenarioContent = '';
      
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
      const testCaseData = {
        name: testCaseName && testCaseName.trim() ? `${testCaseName.trim()} - ${scenario.name}` : `${featureName} - ${scenario.name}`,
        projectKey: targetProjectKey,
        status: status,
        priority: 'Medium', // Default priority
        customFields: {
          'isAutomatable': isAutomatable
        }
      };

      // Add folder ID if specified
      if (folderId) {
        testCaseData.folderId = folderId;
      }

      let retryCount = 0;
      const maxRetries = 3;
      let zephyrResponse;
      
      while (retryCount < maxRetries) {
        try {
          // Create new test case
          zephyrResponse = await axios.post(endpoint, testCaseData, {
            headers: {
              'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 second timeout
          });
        
          // Now add the test script to the created test case
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
            
            
            
            // Update the test case status
            try {
              // Try different approaches for status update
              const statusUpdateData = {
                id: zephyrResponse.data.id,
                key: zephyrResponse.data.key,
                name: testCaseData.name,
                project: {
                  id: 177573
                },
                priority: {
                  id: 3233492
                },
                status: {
                  id: status === "Draft" ? 3233488 : status === "Deprecated" ? 3233489 : 3233490
                },
                customFields: {
                  'isAutomatable': isAutomatable,
                  'isAutomated': null
                }
              };
              
              const statusUpdateResponse = await axios.put(`${zephyrBaseUrl}/testcases/${zephyrResponse.data.key}`, statusUpdateData, {
                headers: {
                  'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
                  'Content-Type': 'application/json'
                },
                timeout: 30000
              });
              
            } catch (statusError) {
              // Status update failed, continue silently
            }
            
          } catch (scriptError) {
            // Test script addition failed, continue silently
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
  }



  return {
    success: true,
    message: testCaseIds ? `Successfully updated ${createdTestCases.length} test cases in Zephyr Scale` : `Successfully created ${createdTestCases.length} test cases in Zephyr Scale`,
    createdTestCases: createdTestCases,
    zephyrTestCaseIds: testCaseIds || (createdTestCases.length > 0 ? createdTestCases.map(tc => tc.key) : []),
    zephyrTestCaseId: testCaseIds ? testCaseIds[0] : (createdTestCases.length > 0 ? createdTestCases[0].key : null),
    metadata: {
      originalContentLength: content.length,
      totalScenarios: scenarios.length,
      featureName: featureName,
      testCaseName: testCaseName,
      projectKey: targetProjectKey,
      folderId: folderId,
      isUpdate: !!testCaseIds,
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
  isZephyrConfigured
}; 