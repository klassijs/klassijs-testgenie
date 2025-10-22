const axios = require('axios');
const CacheManager = require('../utils/cacheManager');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

const isJiraConfigured = JIRA_BASE_URL && JIRA_EMAIL && JIRA_API_TOKEN;
const cacheManager = new CacheManager();



async function testJiraConnection() {
  try {
    if (!isJiraConfigured) {
      return {
        success: false,
        error: 'Jira credentials not configured. Please check your environment variables.'
      };
    }

    const response = await axios.get(`${JIRA_BASE_URL}/rest/api/3/myself`, {
      auth: {
        username: JIRA_EMAIL,
        password: JIRA_API_TOKEN
      },
      headers: {
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    if (response.data) {
      return {
        success: true,
        user: response.data,
        message: 'Successfully connected to Jira'
      };
    } else {
      throw new Error('Invalid response from Jira');
    }
  } catch (error) {
    console.error('Jira connection test failed:', error.message);
    return {
      success: false,
      error: error.response?.data?.errorMessages?.[0] || error.message || 'Failed to connect to Jira'
    };
  }
}

// Get Jira projects using environment credentials
async function getJiraProjects() {
  try {
    if (!isJiraConfigured) {
      return {
        success: false,
        error: 'Jira credentials not configured'
      };
    }

    const response = await axios.get(`${JIRA_BASE_URL}/rest/api/3/project`, {
      auth: {
        username: JIRA_EMAIL,
        password: JIRA_API_TOKEN
      },
      headers: {
        'Accept': 'application/json'
      },
      timeout: 15000
    });

    if (response.data && Array.isArray(response.data)) {
      return {
        success: true,
        projects: response.data.map(project => ({
          key: project.key,
          name: project.name,
          id: project.id
        }))
      };
    } else {
      throw new Error('Invalid response format from Jira');
    }
  } catch (error) {
    console.error('Failed to fetch Jira projects:', error.message);
    return {
      success: false,
      error: error.response?.data?.errorMessages?.[0] || error.message || 'Failed to fetch projects'
    };
  }
}

// Get Jira issues using environment credentials - fetches ALL issues
async function getJiraIssues(projectKey, issueTypes) {
  try {
    if (!isJiraConfigured) {
      return {
        success: false,
        error: 'Jira credentials not configured'
      };
    }
    
    // Don't create project-level cache entries - individual tickets will be cached separately
    // This prevents duplication between project-level and individual ticket caches
    
    let allIssues = [];
    
    // Fetch each issue type individually using multi-approach strategy
    // This ensures we get the same results as individual queries
    for (const issueType of issueTypes) {
      
      let issueTypeIssues = [];
      
      // Use multi-approach strategy for each issue type
      const approaches = [
        `project = ${projectKey} AND issuetype = "${issueType}" ORDER BY key ASC`,
        `project = ${projectKey} AND issuetype = "${issueType}" ORDER BY created ASC`,
        `project = ${projectKey} AND issuetype = "${issueType}" ORDER BY updated DESC`,
        `project = ${projectKey} AND issuetype = "${issueType}" ORDER BY priority DESC`
      ];
      
      for (let i = 0; i < approaches.length; i++) {
        const jql = approaches[i];
        const url = `${JIRA_BASE_URL}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=summary,description,issuetype,status&maxResults=1000`;
        
        try {
          const response = await axios.get(url, {
            auth: {
              username: JIRA_EMAIL,
              password: JIRA_API_TOKEN
            },
            headers: {
              'Accept': 'application/json'
            },
            timeout: 30000
          });

          if (response.data && response.data.issues) {
            const batchIssues = response.data.issues.map(issue => ({
              key: issue.key,
              summary: issue.fields.summary,
              description: issue.fields.description,
              issueType: issue.fields.issuetype.name,
              status: issue.fields.status.name
            }));

            // Check for new issues
            const existingKeys = new Set(issueTypeIssues.map(issue => issue.key));
            const newIssues = batchIssues.filter(issue => !existingKeys.has(issue.key));
            const duplicates = batchIssues.filter(issue => existingKeys.has(issue.key));
            
            if (newIssues.length > 0) {
              issueTypeIssues = issueTypeIssues.concat(newIssues);
            } else {
             
            }
          }
        } catch (error) {
            console.error(`  ❌ Approach ${i + 1} failed for ${issueType}:`, error.message);
        }
      }
      
      allIssues = allIssues.concat(issueTypeIssues);
      
    }

    // Log breakdown by issue type
    const issueTypeCounts = {};
    allIssues.forEach(issue => {
      issueTypeCounts[issue.issueType] = (issueTypeCounts[issue.issueType] || 0) + 1;
    });

    // Don't cache project-level results - individual tickets will be cached when imported

    return {
      success: true,
      issues: allIssues,
      total: allIssues.length,
      cached: false
    };
  } catch (error) {
    console.error('Failed to fetch Jira issues:', error.message);
    return {
      success: false,
      error: error.response?.data?.errorMessages?.[0] || error.message || 'Failed to fetch issues'
    };
  }
}


// Convert Jira issue to Gherkin feature
function convertJiraIssueToGherkin(issue) {
  const featureName = `${issue.key}: ${issue.summary}` || 'Test Feature';
  const description = typeof issue.description === 'string' ? issue.description : '';
  
  // Create scenarios from the Jira ticket content
  const scenarios = createScenariosFromJiraContent(issue.summary, description, issue.key);
  
  // Build Gherkin content
  let gherkinContent = `Feature: ${featureName}\n`;
  gherkinContent += `  # Jira Ticket: ${issue.key}\n`;
  gherkinContent += `  # Summary: ${issue.summary}\n`;
  gherkinContent += `  As a user\n`;
  gherkinContent += `  I want to ${issue.summary?.toLowerCase() || 'perform actions'}\n`;
  gherkinContent += `  So that I can achieve my goals\n\n`;
  
  // Add created scenarios
  scenarios.forEach((scenario, index) => {
    gherkinContent += `  # Jira Ticket: ${issue.key}\n`;
    gherkinContent += `Scenario: ${scenario.title}\n`;
    scenario.steps.forEach(step => {
      gherkinContent += `  ${step}\n`;
    });
    if (index < scenarios.length - 1) {
      gherkinContent += '\n';
    }
  });
  
  return {
    title: featureName,
    content: gherkinContent,
    issueType: issue.issueType,
    ticketKey: issue.key
  };
}

// Create scenarios from Jira ticket content
function createScenariosFromJiraContent(summary, description, issueKey) {
  const scenarios = [];  
  // First, try to extract meaningful scenarios from the description
  if (description && typeof description === 'string' && description.trim()) {
    const extractedScenarios = extractScenariosFromDescription(description, summary, issueKey);
    if (extractedScenarios.length > 0) {
      scenarios.push(...extractedScenarios);
    } else {

    }
  } else {
    
  }
  
  // If no Gherkin scenarios found, try to extract test steps from natural language
  if (scenarios.length === 0) {
    const naturalLanguageScenarios = extractNaturalLanguageScenarios(description, summary, issueKey);
    if (naturalLanguageScenarios.length > 0) {
      scenarios.push(...naturalLanguageScenarios);
    } else {

    }
  }
  
  // If still no scenarios, create intelligent scenarios from the summary
  if (scenarios.length === 0 && summary) {
    const intelligentScenarios = createIntelligentScenariosFromSummary(summary, issueKey);
    scenarios.push(...intelligentScenarios);
  }
  
  return scenarios;
}

// Create intelligent test steps based on Jira ticket content
function createIntelligentSteps(summary, description) {
  const steps = [];
  const lowerSummary = summary?.toLowerCase() || '';
  const lowerDescription = description?.toLowerCase() || '';
  
  // Determine the context from summary and description
  let context = 'the application';
  let action = 'perform the required action';
  let expectedResult = 'see the expected result';
  
  // Extract context (what page/area we're working with)
  if (lowerSummary.includes('login') || lowerSummary.includes('sign in') || lowerSummary.includes('authentication')) {
    context = 'the login page';
    action = 'enter valid credentials and click login';
    expectedResult = 'be successfully logged in and redirected to the dashboard';
  } else if (lowerSummary.includes('dashboard') || lowerSummary.includes('home')) {
    context = 'the dashboard';
    action = 'view the dashboard content';
    expectedResult = 'see all relevant information and navigation options';
  } else if (lowerSummary.includes('user') || lowerSummary.includes('profile')) {
    context = 'the user management section';
    action = 'access user profile or management features';
    expectedResult = 'see user information and management options';
  } else if (lowerSummary.includes('report') || lowerSummary.includes('analytics')) {
    context = 'the reporting section';
    action = 'generate or view the required report';
    expectedResult = 'see the report with accurate data';
  } else if (lowerSummary.includes('form') || lowerSummary.includes('input')) {
    context = 'the form';
    action = 'fill out the required fields with valid data';
    expectedResult = 'see the form submitted successfully';
  } else if (lowerSummary.includes('search') || lowerSummary.includes('find')) {
    context = 'the search functionality';
    action = 'enter search criteria and execute search';
    expectedResult = 'see relevant search results';
  } else if (lowerSummary.includes('create') || lowerSummary.includes('add') || lowerSummary.includes('new')) {
    context = 'the creation form';
    action = 'fill out the creation form with required information';
    expectedResult = 'see the new item created successfully';
  } else if (lowerSummary.includes('edit') || lowerSummary.includes('update') || lowerSummary.includes('modify')) {
    context = 'the edit form';
    action = 'modify the existing information';
    expectedResult = 'see the changes saved successfully';
  } else if (lowerSummary.includes('delete') || lowerSummary.includes('remove')) {
    context = 'the item management section';
    action = 'select the item and confirm deletion';
    expectedResult = 'see the item removed successfully';
  } else if (lowerSummary.includes('navigation') || lowerSummary.includes('menu')) {
    context = 'the navigation menu';
    action = 'navigate through the menu structure';
    expectedResult = 'reach the intended destination';
  }
  
  // Add more specific context from description if available
  if (lowerDescription.includes('page') || lowerDescription.includes('screen')) {
    const pageMatch = lowerDescription.match(/(?:on|in|to|the)\s+([a-zA-Z\s]+(?:page|screen))/);
    if (pageMatch) {
      context = pageMatch[1].trim();
    }
  }
  
  // Build the steps
  steps.push(`Given I am on ${context}`);
  steps.push(`When I ${action}`);
  steps.push(`Then I should ${expectedResult}`);
  
  return steps;
}

// Create intelligent scenarios from Jira summary when description is empty
function createIntelligentScenariosFromSummary(summary, issueKey) {
  const scenarios = [];
  const lowerSummary = summary?.toLowerCase() || '';

  // Analyze the summary to create meaningful scenarios
  if (lowerSummary.includes('alignment') || lowerSummary.includes('position') || lowerSummary.includes('layout')) {
    // UI/UX alignment changes
    scenarios.push({
      title: `${issueKey}: Verify alignment change`,
      steps: [
        `Given I am on the FAQ's page for EduZone`,
        `When I click on the (+) symbol`,
        `Then the alignment should change as expected`
      ]
    });
    
    scenarios.push({
      title: `${issueKey}: Verify alignment consistency`,
      steps: [
        `Given I am on the FAQ's page for EduZone`,
        `When I view the (+) symbol`,
        `Then the alignment should be consistent with design requirements`
      ]
    });
  } else if (lowerSummary.includes('click') || lowerSummary.includes('interact')) {
    // Interactive elements
    scenarios.push({
      title: `${issueKey}: Verify click interaction`,
      steps: [
        `Given I am on the relevant page`,
        `When I click on the specified element`,
        `Then the expected behavior should occur`
      ]
    });
  } else if (lowerSummary.includes('page') || lowerSummary.includes('section')) {
    // Page/section specific changes
    scenarios.push({
      title: `${issueKey}: Verify page functionality`,
      steps: [
        `Given I am on the specified page`,
        `When I perform the required action`,
        `Then the expected functionality should work correctly`
      ]
    });
  } else {
    // Generic scenario for any other type of change
    scenarios.push({
      title: `${issueKey}: Verify functionality`,
      steps: [
        `Given I am on the relevant page`,
        `When I perform the required action`,
        `Then the expected result should occur`
      ]
    });
  }
  
  return scenarios;
}

// Extract scenarios from Jira description
function extractScenariosFromDescription(description, summary, issueKey) {
  const scenarios = [];
  
  if (!description || typeof description !== 'string') {
    return scenarios;
  }
  
  // Try to find Gherkin-like patterns in the description
  const lines = description.split('\n');
  let currentScenario = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Look for scenario indicators
    if (trimmedLine.toLowerCase().includes('scenario') || 
        trimmedLine.toLowerCase().includes('given') ||
        trimmedLine.toLowerCase().includes('when') ||
        trimmedLine.toLowerCase().includes('then')) {
      
      if (trimmedLine.toLowerCase().includes('scenario')) {
        // Start new scenario
        if (currentScenario) {
          scenarios.push(currentScenario);
        }
        const scenarioTitle = `${issueKey}: ${trimmedLine.replace(/scenario:?\s*/i, '').trim()}` || `${issueKey}: ${summary}` || `Test ${issueKey}`;
        currentScenario = {
          title: scenarioTitle, // Include issue key for traceability
          steps: []
        };
      } else if (currentScenario && (trimmedLine.toLowerCase().startsWith('given') ||
                                   trimmedLine.toLowerCase().startsWith('when') ||
                                   trimmedLine.toLowerCase().startsWith('then') ||
                                   trimmedLine.toLowerCase().startsWith('and') ||
                                   trimmedLine.toLowerCase().startsWith('but'))) {
        // Add step to current scenario
        currentScenario.steps.push(trimmedLine);
      }
    }
  }
  
  // Add the last scenario
  if (currentScenario) {
    scenarios.push(currentScenario);
  }
  
  // If no Gherkin scenarios found, try to extract test steps from natural language
  if (scenarios.length === 0) {
    const naturalLanguageScenarios = extractNaturalLanguageScenarios(description, summary, issueKey);
    if (naturalLanguageScenarios.length > 0) {
      scenarios.push(...naturalLanguageScenarios);
    } else {

    }
  }
  
  // If still no scenarios, create a basic scenario from the summary
  if (scenarios.length === 0 && summary) {
    const basicScenario = {
      title: `${issueKey}: ${summary}`,
      steps: [
        `Given I am on the relevant page`,
        `When I perform the required action`,
        `Then I should see the expected result`
      ]
    };
    scenarios.push(basicScenario);
  }
  
  return scenarios;
}

// Extract test scenarios from natural language in Jira descriptions
function extractNaturalLanguageScenarios(description, summary, issueKey) {
  const scenarios = [];
  
  if (!description || typeof description !== 'string') {
    return scenarios;
  }
  
  const lines = description.split('\n');
  let currentSteps = [];
  let hasTestContent = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Look for action-oriented language that can be converted to test steps
    const lowerLine = trimmedLine.toLowerCase();
    
    // Skip lines that are clearly not test-related
    if (lowerLine.includes('bug') || lowerLine.includes('issue') || lowerLine.includes('problem') || 
        lowerLine.includes('error') || lowerLine.includes('exception') || lowerLine.includes('stack trace')) {
      continue;
    }
    
    // Convert natural language to test steps
    if (lowerLine.includes('user') || lowerLine.includes('click') || lowerLine.includes('enter') || 
        lowerLine.includes('select') || lowerLine.includes('navigate') || lowerLine.includes('go to') ||
        lowerLine.includes('fill') || lowerLine.includes('submit') || lowerLine.includes('save') ||
        lowerLine.includes('verify') || lowerLine.includes('check') || lowerLine.includes('confirm') ||
        lowerLine.includes('should') || lowerLine.includes('must') || lowerLine.includes('will')) {
      
      hasTestContent = true;
            
      // Convert to Gherkin format
      let step = '';
      if (lowerLine.includes('user') || lowerLine.includes('click') || lowerLine.includes('enter') || 
          lowerLine.includes('select') || lowerLine.includes('navigate') || lowerLine.includes('go to') ||
          lowerLine.includes('fill') || lowerLine.includes('submit') || lowerLine.includes('save')) {
        step = `When ${trimmedLine}`;
      } else if (lowerLine.includes('verify') || lowerLine.includes('check') || lowerLine.includes('confirm') ||
                 lowerLine.includes('should') || lowerLine.includes('must') || lowerLine.includes('will')) {
        step = `Then ${trimmedLine}`;
      } else {
        step = `Given ${trimmedLine}`;
      }
      
      currentSteps.push(step);
    }
  }
  
  // If we found test content, create a scenario
  if (hasTestContent && currentSteps.length > 0) {
    
    // Add a Given step if we don't have one
    if (!currentSteps.some(step => step.toLowerCase().startsWith('given'))) {
      currentSteps.unshift('Given I am on the relevant page');
    }
    
    // Add a Then step if we don't have one
    if (!currentSteps.some(step => step.toLowerCase().startsWith('then'))) {
      currentSteps.push('Then the action should complete successfully');
    }
    
    scenarios.push({
      title: `${issueKey}: ${summary}`,
      steps: currentSteps
    });
  } else {
   
  }
  
  return scenarios;
}

// Import Jira issues using environment credentials
async function importJiraIssues(selectedIssues) {
  try {
    if (!isJiraConfigured) {
      return {
        success: false,
        error: 'Jira credentials not configured'
      };
    }

    const features = [];
    const skippedIssues = [];
    
    for (const issueKey of selectedIssues) {
      // Fetch individual issue details
      const response = await axios.get(`${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}`, {
        auth: {
          username: JIRA_EMAIL,
          password: JIRA_API_TOKEN
        },
        headers: {
          'Accept': 'application/json'
        },
        params: {
          fields: 'summary,description,issuetype,status,priority,components,labels'
        },
        timeout: 10000
      });
      
      if (response.data) {
        
        const issue = {
          key: response.data.key,
          summary: response.data.fields.summary,
          description: response.data.fields.description,
          issueType: response.data.fields.issuetype.name,
          status: response.data.fields.status.name
        };
        
        const feature = convertJiraIssueToGherkin(issue);
        features.push(feature); // Always add since we create scenarios from Jira content
      }
    }
    

    
    let message = `Successfully imported ${features.length} Jira tickets as Gherkin features`;
    if (skippedIssues.length > 0) {
      message += `. Skipped ${skippedIssues.length} issues due to errors`;
    }
    
    return {
      success: true,
      features: features,
      message: message,
      skippedIssues: skippedIssues
    };
  } catch (error) {
    console.error('Failed to import Jira issues:', error.message);
    console.error('Error details:', error.response?.data);
    return {
      success: false,
      error: error.response?.data?.errorMessages?.[0] || error.message || 'Failed to import issues'
    };
  }
}

module.exports = {
  testJiraConnection,
  getJiraProjects,
  getJiraIssues,
  importJiraIssues,
  // isJiraConfigured
}; 