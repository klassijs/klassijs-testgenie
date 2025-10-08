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

    console.log(`📋 Project Key: ${projectKey}`);
    console.log(`🏷️  Issue Types: ${issueTypes.join(', ')}`);
    
    // Create document name for Jira issues (same pattern as uploaded files)
    const documentName = `jira-${projectKey}-${issueTypes.sort().join('-')}`;
    
    // Check if we have cached data (same pattern as uploaded files)
    const hasDocumentCache = await cacheManager.hasDocumentCachedResults(documentName, 'jira_issues');
    console.log(`🔍 Has Jira issues cache: ${hasDocumentCache}`);
    
    if (hasDocumentCache) {
      const documentCachedResults = await cacheManager.getDocumentCachedResults(documentName, 'jira_issues');
      if (documentCachedResults && documentCachedResults.issues) {
        console.log(`💾 Using cached Jira issues for ${projectKey} (${issueTypes.join(', ')})`);
        return {
          success: true,
          issues: documentCachedResults.issues,
          total: documentCachedResults.issues.length,
          cached: true,
          cacheInfo: documentCachedResults._cacheInfo
        };
      }
    }
    
    console.log(`🔄 Fetching fresh Jira issues for ${projectKey}...`);
    let allIssues = [];
    
    // Fetch each issue type individually using multi-approach strategy
    // This ensures we get the same results as individual queries
    console.log(`🔄 Fetching each issue type individually to ensure accuracy...`);
    
    for (const issueType of issueTypes) {
      console.log(`🔍 Fetching ${issueType} issues...`);
      
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
              console.log(`  ✅ Approach ${i + 1}: Added ${newIssues.length} new ${issueType} issues (${duplicates.length} duplicates). Total: ${issueTypeIssues.length}`);
            } else {
              console.log(`  ⚠️  Approach ${i + 1}: No new ${issueType} issues found (${duplicates.length} duplicates)`);
            }
          }
        } catch (error) {
          console.log(`  ❌ Approach ${i + 1} failed for ${issueType}:`, error.message);
        }
      }
      
      allIssues = allIssues.concat(issueTypeIssues);
      console.log(`✅ ${issueType}: Total ${issueTypeIssues.length} issues. Combined total: ${allIssues.length}`);
    }

    // Log breakdown by issue type
    const issueTypeCounts = {};
    allIssues.forEach(issue => {
      issueTypeCounts[issue.issueType] = (issueTypeCounts[issue.issueType] || 0) + 1;
    });
    
    console.log(`🎉 Successfully fetched ${allIssues.length} unique issues from project ${projectKey}`);
    console.log(`📊 Issue type breakdown:`, issueTypeCounts);

    // Cache the results (same pattern as uploaded files)
    try {
      await cacheManager.storeDocumentCachedResults(documentName, 'jira_issues', {
        issues: allIssues,
        projectKey,
        issueTypes,
        fetchedAt: new Date().toISOString()
      });
      console.log(`💾 Cached ${allIssues.length} Jira issues for ${projectKey} (${issueTypes.join(', ')})`);
    } catch (error) {
      console.error('Failed to cache Jira issues:', error.message);
    }

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
    content: gherkinContent
  };
}

// Create scenarios from Jira ticket content
function createScenariosFromJiraContent(summary, description, issueKey) {
  const scenarios = [];
  
  console.log(`🔍 Processing Jira ticket: ${issueKey}`);
  console.log(`🔍 Summary: "${summary}"`);
  console.log(`🔍 Description type: ${typeof description}, length: ${description ? description.length : 0}`);
  
  // First, try to extract meaningful scenarios from the description
  if (description && typeof description === 'string' && description.trim()) {
    console.log(`🔍 Attempting to extract scenarios from description...`);
    const extractedScenarios = extractScenariosFromDescription(description, summary, issueKey);
    if (extractedScenarios.length > 0) {
      scenarios.push(...extractedScenarios);
      console.log(`✅ Extracted ${extractedScenarios.length} scenarios from description`);
    } else {
      console.log(`ℹ️  No scenarios extracted from description, trying natural language extraction...`);
    }
  } else {
    console.log(`ℹ️  No description available, will try natural language extraction from summary`);
  }
  
  // If no Gherkin scenarios found, try to extract test steps from natural language
  if (scenarios.length === 0) {
    console.log(`🔍 Attempting natural language scenario extraction...`);
    const naturalLanguageScenarios = extractNaturalLanguageScenarios(description, summary, issueKey);
    if (naturalLanguageScenarios.length > 0) {
      scenarios.push(...naturalLanguageScenarios);
      console.log(`✅ Extracted ${naturalLanguageScenarios.length} scenarios from natural language`);
    } else {
      console.log(`ℹ️  No scenarios extracted from natural language`);
    }
  }
  
  // If still no scenarios, create intelligent scenarios from the summary
  if (scenarios.length === 0 && summary) {
    console.log(`🔍 Creating intelligent scenarios from Jira summary: ${summary}`);
    const intelligentScenarios = createIntelligentScenariosFromSummary(summary, issueKey);
    scenarios.push(...intelligentScenarios);
    console.log(`✅ Created ${intelligentScenarios.length} intelligent scenarios from summary`);
  }
  
  // Final check and logging
  if (scenarios.length === 0) {
    console.log('⚠️  No scenarios found in Jira ticket content. Test cases should only be created from actual business requirements and acceptance criteria.');
    console.log(`🔍 Jira ticket summary: "${summary}"`);
    console.log(`🔍 Jira ticket description length: ${description ? description.length : 0} characters`);
  } else {
    console.log(`✅ Successfully extracted ${scenarios.length} scenarios from Jira ticket content`);
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
  
  console.log(`🔍 Creating intelligent scenarios from summary: "${summary}"`);
  
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
  
  console.log(`✅ Created ${scenarios.length} intelligent scenarios from summary`);
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
    console.log(`🔍 Attempting natural language scenario extraction...`);
    const naturalLanguageScenarios = extractNaturalLanguageScenarios(description, summary, issueKey);
    if (naturalLanguageScenarios.length > 0) {
      scenarios.push(...naturalLanguageScenarios);
      console.log(`✅ Extracted ${naturalLanguageScenarios.length} scenarios from natural language`);
    } else {
      console.log(`ℹ️  No scenarios extracted from natural language`);
    }
  }
  
  // If still no scenarios, create a basic scenario from the summary
  if (scenarios.length === 0 && summary) {
    console.log(`🔍 Creating basic scenario from Jira summary: ${summary}`);
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
    
    console.log(`🔍 Processing line: "${trimmedLine}"`);
    
    // Look for action-oriented language that can be converted to test steps
    const lowerLine = trimmedLine.toLowerCase();
    
    // Skip lines that are clearly not test-related
    if (lowerLine.includes('bug') || lowerLine.includes('issue') || lowerLine.includes('problem') || 
        lowerLine.includes('error') || lowerLine.includes('exception') || lowerLine.includes('stack trace')) {
      console.log(`⏭️  Skipping non-test line: "${trimmedLine}"`);
      continue;
    }
    
    // Convert natural language to test steps
    if (lowerLine.includes('user') || lowerLine.includes('click') || lowerLine.includes('enter') || 
        lowerLine.includes('select') || lowerLine.includes('navigate') || lowerLine.includes('go to') ||
        lowerLine.includes('fill') || lowerLine.includes('submit') || lowerLine.includes('save') ||
        lowerLine.includes('verify') || lowerLine.includes('check') || lowerLine.includes('confirm') ||
        lowerLine.includes('should') || lowerLine.includes('must') || lowerLine.includes('will')) {
      
      hasTestContent = true;
      console.log(`✅ Found test content in line: "${trimmedLine}"`);
      
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
    console.log(`🔍 Found test content, creating scenario with ${currentSteps.length} steps`);
    
    // Add a Given step if we don't have one
    if (!currentSteps.some(step => step.toLowerCase().startsWith('given'))) {
      currentSteps.unshift('Given I am on the relevant page');
      console.log(`🔍 Added default Given step`);
    }
    
    // Add a Then step if we don't have one
    if (!currentSteps.some(step => step.toLowerCase().startsWith('then'))) {
      currentSteps.push('Then the action should complete successfully');
      console.log(`🔍 Added default Then step`);
    }
    
    scenarios.push({
      title: `${issueKey}: ${summary}`,
      steps: currentSteps
    });
    
    console.log(`✅ Created scenario: ${issueKey}: ${summary}`);
  } else {
    console.log(`ℹ️  No test content found in natural language extraction`);
    console.log(`ℹ️  hasTestContent: ${hasTestContent}, currentSteps.length: ${currentSteps.length}`);
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
        console.log(`🔍 Jira API response for ${response.data.key}:`, {
          summary: response.data.fields.summary,
          descriptionType: typeof response.data.fields.description,
          descriptionLength: response.data.fields.description ? response.data.fields.description.length : 0,
          issueType: response.data.fields.issuetype?.name,
          status: response.data.fields.status?.name,
          priority: response.data.fields.priority?.name,
          components: response.data.fields.components?.map(c => c.name),
          labels: response.data.fields.labels
        });
        
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
  isJiraConfigured
}; 