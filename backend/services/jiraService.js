const axios = require('axios');

// Jira API Configuration from environment variables
const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

const isJiraConfigured = JIRA_BASE_URL && JIRA_EMAIL && JIRA_API_TOKEN;

console.log('Jira configuration status:', {
  hasBaseUrl: !!JIRA_BASE_URL,
  hasEmail: !!JIRA_EMAIL,
  hasApiToken: !!JIRA_API_TOKEN,
  isConfigured: isJiraConfigured
});

// Test connection to Jira using environment credentials
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

// Get Jira issues using environment credentials
async function getJiraIssues(projectKey, issueTypes) {
  try {
    if (!isJiraConfigured) {
      return {
        success: false,
        error: 'Jira credentials not configured'
      };
    }

    // Build JQL query
    const jql = `project = "${projectKey}" AND issuetype IN (${issueTypes.map(type => `"${type}"`).join(', ')}) ORDER BY created DESC`;
    
    const response = await axios.get(`${JIRA_BASE_URL}/rest/api/3/search`, {
      auth: {
        username: JIRA_EMAIL,
        password: JIRA_API_TOKEN
      },
      headers: {
        'Accept': 'application/json'
      },
      params: {
        jql: jql,
        maxResults: 100,
        fields: 'summary,description,issuetype,status'
      },
      timeout: 15000
    });

    if (response.data && response.data.issues) {
      return {
        success: true,
        issues: response.data.issues.map(issue => ({
          key: issue.key,
          summary: issue.fields.summary,
          description: issue.fields.description,
          issueType: issue.fields.issuetype.name,
          status: issue.fields.status.name
        }))
      };
    } else {
      throw new Error('Invalid response format from Jira');
    }
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
  const featureName = issue.summary || 'Test Feature';
  const description = typeof issue.description === 'string' ? issue.description : '';
  
  // Extract scenarios from description
  const scenarios = extractScenariosFromDescription(description, issue.summary);
  
  // Build Gherkin content
  let gherkinContent = `Feature: ${featureName}\n`;
  gherkinContent += `  As a user\n`;
  gherkinContent += `  I want to ${issue.summary?.toLowerCase() || 'perform actions'}\n`;
  gherkinContent += `  So that I can achieve my goals\n\n`;
  
  if (scenarios.length === 0) {
    // Create default scenario if none found
    gherkinContent += `Scenario: ${issue.summary || 'Default scenario'}\n`;
    gherkinContent += `  Given I am on the application\n`;
    gherkinContent += `  When I perform the required action\n`;
    gherkinContent += `  Then I should see the expected result\n`;
  } else {
    // Add extracted scenarios
    scenarios.forEach((scenario, index) => {
      gherkinContent += `Scenario: ${scenario.title}\n`;
      scenario.steps.forEach(step => {
        gherkinContent += `  ${step}\n`;
      });
      if (index < scenarios.length - 1) {
        gherkinContent += '\n';
      }
    });
  }
  
  return {
    title: featureName,
    content: gherkinContent
  };
}

// Extract scenarios from Jira description
function extractScenariosFromDescription(description, summary) {
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
        currentScenario = {
          title: trimmedLine.replace(/scenario:?\s*/i, '').trim() || summary || 'Test Scenario',
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
  
  return scenarios;
}

// Import Jira issues using environment credentials
async function importJiraIssues(selectedIssues) {
  try {
    console.log('Starting importJiraIssues with:', { selectedIssues, isJiraConfigured });
    
    if (!isJiraConfigured) {
      console.log('Jira not configured');
      return {
        success: false,
        error: 'Jira credentials not configured'
      };
    }

    const features = [];
    
    for (const issueKey of selectedIssues) {
      console.log('Fetching issue:', issueKey);
      
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
          fields: 'summary,description,issuetype,status'
        },
        timeout: 10000
      });
      
      console.log('Jira API response for', issueKey, ':', {
        status: response.status,
        hasData: !!response.data,
        hasFields: !!response.data?.fields,
        summary: response.data?.fields?.summary,
        description: response.data?.fields?.description
      });
      
      if (response.data) {
        const issue = {
          key: response.data.key,
          summary: response.data.fields.summary,
          description: response.data.fields.description,
          issueType: response.data.fields.issuetype.name,
          status: response.data.fields.status.name
        };
        
        console.log('Processed issue:', issue);
        
        const feature = convertJiraIssueToGherkin(issue);
        features.push(feature);
      }
    }
    
    console.log('Import completed, features:', features.length);
    
    return {
      success: true,
      features: features,
      message: `Successfully imported ${features.length} issues from Jira`
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