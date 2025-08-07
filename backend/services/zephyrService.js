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
    
    console.log(`Fetching projects from SmartBear Zephyr Scale API: ${zephyrBaseUrl}/projects`);
    
    const response = await axios.get(`${zephyrBaseUrl}/projects`, {
      headers: {
        'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    if (response.data && Array.isArray(response.data)) {
      console.log(`Successfully fetched ${response.data.length} projects from SmartBear Zephyr Scale`);
      return response.data;
    } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
      console.log(`Successfully fetched ${response.data.data.length} projects from SmartBear Zephyr Scale`);
      return response.data.data;
    } else if (response.data && response.data.values && Array.isArray(response.data.values)) {
      console.log(`Successfully fetched ${response.data.values.length} projects from SmartBear Zephyr Scale`);
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
    
    console.log(`Fetching ALL folders for project ${projectKey} from SmartBear Zephyr Scale API (with pagination)`);
    
    // Fetch all folders with pagination
    while (true) {
      console.log(`Fetching folders starting at ${startAt}...`);
      
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

      console.log(`Fetched ${folders.length} folders in this batch`);
      
      if (folders.length === 0) {
        console.log('No more folders to fetch');
        break;
      }

      allFolders.push(...folders);
      startAt += folders.length;

      // If we got fewer folders than requested, we've reached the end
      if (folders.length < maxResults) {
        console.log('Reached end of folder list');
        break;
      }

      // Safety check to prevent infinite loops
      if (allFolders.length > 1000) {
        console.log('Reached safety limit of 1000 folders, stopping');
        break;
      }
    }

    console.log(`Successfully fetched ${allFolders.length} total folders for project ${projectKey}`);
    console.log('Complete folders data:', JSON.stringify(allFolders, null, 2));
    
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
    console.error(`Error fetching folders for project ${projectKey}:`, error);
    // Return empty array instead of throwing error for folders
    return [];
  }
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
async function pushToZephyr(content, featureName = 'Test Feature', projectKey = '', testCaseName = '', folderId = null, status = 'Draft', isAutomatable = 'None') {
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

  // Create individual test cases for each scenario
  const createdTestCases = [];
  const zephyrBaseUrl = ZEPHYR_BASE_URL;
  const endpoint = `${zephyrBaseUrl}/testcases`;

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
    
    while (retryCount < maxRetries) {
      try {
        console.log(`Creating test case ${i + 1}/${scenarios.length} at SmartBear Zephyr Scale API: ${endpoint} (attempt ${retryCount + 1}/${maxRetries})`);
        console.log('=== FULL TEST CASE DATA BEING SENT ===');
        console.log(JSON.stringify(testCaseData, null, 2));
        console.log('=== END TEST CASE DATA ===');
        
        const zephyrResponse = await axios.post(endpoint, testCaseData, {
          headers: {
            'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        });
      
      console.log(`Successfully created test case ${i + 1}/${scenarios.length} in Zephyr Scale`);
      console.log('=== ZEPHYR API RESPONSE ===');
      console.log(JSON.stringify(zephyrResponse.data, null, 2));
      console.log('=== END ZEPHYR API RESPONSE ===');
      
      // Now add the test script to the created test case
      try {
        console.log(`📝 Adding test script to ${zephyrResponse.data.key}...`);
        const testScriptData = {
          type: 'bdd',
          text: scenarioContent.trim()
        };
        
        console.log('=== TEST SCRIPT DATA BEING SENT ===');
        console.log(JSON.stringify(testScriptData, null, 2));
        console.log('=== END TEST SCRIPT DATA ===');
        
        const testScriptResponse = await axios.post(`${zephyrBaseUrl}/testcases/${zephyrResponse.data.key}/testscript`, testScriptData, {
          headers: {
            'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });
        
        console.log(`✅ Successfully added test script to ${zephyrResponse.data.key}`);
        console.log('=== TEST SCRIPT API RESPONSE ===');
        console.log(JSON.stringify(testScriptResponse.data, null, 2));
        console.log('=== END TEST SCRIPT API RESPONSE ===');
        
        // Update the test case status
        try {
          console.log(`📝 Updating status for ${zephyrResponse.data.key} to: ${status}`);
          
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
          
          console.log('=== STATUS UPDATE DATA BEING SENT ===');
          console.log(JSON.stringify(statusUpdateData, null, 2));
          console.log('=== END STATUS UPDATE DATA ===');
          
          const statusUpdateResponse = await axios.put(`${zephyrBaseUrl}/testcases/${zephyrResponse.data.key}`, statusUpdateData, {
            headers: {
              'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          });
          
          console.log(`✅ Successfully updated status for ${zephyrResponse.data.key}`);
          console.log('=== STATUS UPDATE API RESPONSE ===');
          console.log(JSON.stringify(statusUpdateResponse.data, null, 2));
          console.log('=== END STATUS UPDATE API RESPONSE ===');
          
        } catch (statusError) {
          console.error(`❌ Failed to update status for ${zephyrResponse.data.key}:`, statusError.message);
          if (statusError.response) {
            console.error('Status Update API Error Status:', statusError.response.status);
            console.error('Status Update API Error Response:', JSON.stringify(statusError.response.data, null, 2));
          }
          
          // Try alternative approaches for status update
          try {
            console.log(`🔄 Trying alternative status update approaches for ${zephyrResponse.data.key}`);
            
            // Try approach 1: Only status field
            try {
              console.log(`🔄 Approach 1: Status only`);
              const statusOnlyData = { 
                id: zephyrResponse.data.id,
                key: zephyrResponse.data.key,
                name: testCaseData.name,
                project: { id: 177573 },
                priority: { id: 3233492 },
                status: { id: status === "Draft" ? 3233488 : status === "Deprecated" ? 3233489 : 3233490 }
              };
              await axios.put(`${zephyrBaseUrl}/testcases/${zephyrResponse.data.key}`, statusOnlyData, {
                headers: {
                  'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
                  'Content-Type': 'application/json'
                },
                timeout: 30000
              });
              console.log(`✅ Successfully updated status (approach 1) for ${zephyrResponse.data.key}`);
            } catch (approach1Error) {
              console.error(`❌ Approach 1 failed:`, approach1Error.message);
              
              // Try approach 2: Different status field name
              try {
                console.log(`🔄 Approach 2: Different status field name`);
                const statusFieldData = { 
                  id: zephyrResponse.data.id,
                  key: zephyrResponse.data.key,
                  name: testCaseData.name,
                  project: { id: 177573 },
                  priority: { id: 3233492 },
                  status: { id: status === "Draft" ? 3233488 : status === "Deprecated" ? 3233489 : 3233490 }
                };
                await axios.put(`${zephyrBaseUrl}/testcases/${zephyrResponse.data.key}`, statusFieldData, {
                  headers: {
                    'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
                    'Content-Type': 'application/json'
                  },
                  timeout: 30000
                });
                console.log(`✅ Successfully updated status (approach 2) for ${zephyrResponse.data.key}`);
              } catch (approach2Error) {
                console.error(`❌ Approach 2 failed:`, approach2Error.message);
                
                // Try approach 3: Custom fields only
                try {
                  console.log(`🔄 Approach 3: Custom fields only`);
                  const customFieldsData = {
                    customFields: {
                      'isAutomatable': isAutomatable,
                      'isAutomated': null
                    }
                  };
                  
                  await axios.put(`${zephyrBaseUrl}/testcases/${zephyrResponse.data.key}`, customFieldsData, {
                    headers: {
                      'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
                      'Content-Type': 'application/json'
                    },
                    timeout: 30000
                  });
                  
                  console.log(`✅ Successfully updated custom fields for ${zephyrResponse.data.key}`);
                  
                } catch (customFieldsError) {
                  console.error(`❌ Approach 3 failed:`, customFieldsError.message);
                  if (customFieldsError.response) {
                    console.error('Custom Fields API Error Status:', customFieldsError.response.status);
                    console.error('Custom Fields API Error Response:', JSON.stringify(customFieldsError.response.data, null, 2));
                  }
                }
              }
            }
            
          } catch (alternativeError) {
            console.error(`❌ All alternative approaches failed for ${zephyrResponse.data.key}:`, alternativeError.message);
          }
        }
        
      } catch (scriptError) {
        console.error(`❌ Failed to add test script to ${zephyrResponse.data.key}:`, scriptError.message);
        if (scriptError.response) {
          console.error('Test Script API Error Status:', scriptError.response.status);
          console.error('Test Script API Error Response:', JSON.stringify(scriptError.response.data, null, 2));
        }
      }
      
      // Log the direct URL to view the test case
      const testCaseUrl = `${zephyrBaseUrl.replace('/v2', '')}/testcases/${zephyrResponse.data.key}`;
      console.log(`🔗 Direct link to view test case: ${testCaseUrl}`);
      console.log(`📋 Test case key: ${zephyrResponse.data.key}`);
      console.log(`📁 Project: ${targetProjectKey}, Folder: ${folderId || 'Root'}`);
      
      // Verify the test script was saved in the initial creation
      try {
        console.log(`🔍 Verifying test script for ${zephyrResponse.data.key}...`);
        
        // Get test script using the correct endpoint
        const testScriptResponse = await axios.get(`${zephyrBaseUrl}/testcases/${zephyrResponse.data.key}/testscript`, {
          headers: {
            'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        console.log(`📋 Test script for ${zephyrResponse.data.key}:`, JSON.stringify(testScriptResponse.data, null, 2));
        
        // Also get the test case details to see if script is in the main response
        const testCaseResponse = await axios.get(`${zephyrBaseUrl}/testcases/${zephyrResponse.data.key}`, {
          headers: {
            'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        console.log(`📄 Test case details for ${zephyrResponse.data.key}:`, JSON.stringify(testCaseResponse.data, null, 2));
        
      } catch (verifyError) {
        console.log(`❌ Test script verification failed for ${zephyrResponse.data.key}:`, verifyError.message);
        if (verifyError.response) {
          console.log(`📊 Error Status:`, verifyError.response.status);
          console.log(`📊 Error Response:`, JSON.stringify(verifyError.response.data, null, 2));
        }
        console.log(`📝 Expected test script content was:`, scenarioContent.trim());
      }
      
      createdTestCases.push({
        name: testCaseData.name,
        id: zephyrResponse.data.id,
        key: zephyrResponse.data.key,
        url: testCaseUrl
      });
      
      break; // Success, exit retry loop
      
    } catch (error) {
      retryCount++;
      console.error(`Error creating test case ${i + 1}/${scenarios.length} in Zephyr Scale (attempt ${retryCount}/${maxRetries}):`, error.message);
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        console.log(`⏰ Timeout occurred, retrying in 2 seconds...`);
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
      }
      
      if (error.response) {
        console.error('Zephyr API Error Status:', error.response.status);
        console.error('Zephyr API Error Response:', JSON.stringify(error.response.data, null, 2));
      }
      
      if (retryCount >= maxRetries) {
        throw new Error(`Failed to create test case ${i + 1}/${scenarios.length} in Zephyr Scale after ${maxRetries} attempts: ${error.message}`);
      }
    }
  }
  }

  // Log summary of all created test cases
  console.log('\n🎉 SUMMARY OF CREATED TEST CASES:');
  console.log('=====================================');
  createdTestCases.forEach((testCase, index) => {
    console.log(`${index + 1}. ${testCase.name}`);
    console.log(`   Key: ${testCase.key}`);
    console.log(`   URL: ${testCase.url}`);
    console.log('');
  });
  console.log(`📊 Total created: ${createdTestCases.length} test cases`);
  console.log(`📁 Project: ${targetProjectKey}`);
  console.log(`📂 Folder ID: ${folderId || 'Root'}`);
  console.log('=====================================\n');

  return {
    success: true,
    message: `Successfully created ${createdTestCases.length} test cases in Zephyr Scale`,
    createdTestCases: createdTestCases,
    metadata: {
      originalContentLength: content.length,
      totalScenarios: scenarios.length,
      featureName: featureName,
      testCaseName: testCaseName,
      projectKey: targetProjectKey,
      folderId: folderId,
      timestamp: new Date().toISOString()
    }
  };
}

module.exports = {
  convertToZephyrFormat,
  pushToZephyr,
  getProjects,
  getTestFolders,
  isZephyrConfigured
}; 