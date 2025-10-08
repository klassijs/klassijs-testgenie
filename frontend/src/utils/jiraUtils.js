import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Jira Integration Utilities
 * Handles all Jira-related operations including connection, fetching issues, and importing
 */

/**
 * Test Jira connection
 * @returns {Promise<Object>} - Connection result
 */
export const testJiraConnection = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/jira/test-connection`);
    
    if (response.data.success) {
      return {
        success: true,
        projects: response.data.projects || [],
        jiraBaseUrl: response.data.jiraBaseUrl
      };
    } else {
      return {
        success: false,
        error: response.data.error || 'Failed to connect to Jira'
      };
    }
  } catch (error) {
    console.error('Jira connection error:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to connect to Jira'
    };
  }
};

/**
 * Fetch Jira issues
 * @param {string} projectKey - Jira project key
 * @param {Array} issueTypes - Array of issue types to fetch
 * @returns {Promise<Object>} - Issues result
 */
export const fetchJiraIssues = async (projectKey, issueTypes) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/jira/fetch-issues`, {
      projectKey,
      issueTypes
    });

    if (response.data.success) {
      return {
        success: true,
        issues: response.data.issues || [],
        total: response.data.total || 0,
        cached: response.data.cached || false
      };
    } else {
      return {
        success: false,
        error: response.data.error || 'Failed to fetch Jira issues'
      };
    }
  } catch (error) {
    console.error('Error fetching Jira issues:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch Jira issues'
    };
  }
};

/**
 * Update displayed issues for pagination
 * @param {Array} allIssues - All available issues
 * @param {number} page - Current page number
 * @param {number} itemsPerPage - Items per page
 * @returns {Array} - Paginated issues
 */
export const updateDisplayedIssues = (allIssues, page, itemsPerPage = 100) => {
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  return allIssues.slice(startIndex, endIndex);
};

/**
 * Go to specific page
 * @param {number} page - Page number to go to
 * @param {Array} allIssues - All available issues
 * @param {Function} setJiraPagination - Function to update pagination state
 * @param {Function} updateDisplayedIssues - Function to update displayed issues
 * @returns {void}
 */
export const goToPage = (page, allIssues, setJiraPagination, updateDisplayedIssues) => {
  setJiraPagination(prev => ({ ...prev, currentPage: page }));
  updateDisplayedIssues(allIssues, page);
};

/**
 * Clear Jira cache
 * @param {string} projectKey - Jira project key
 * @param {Array} issueTypes - Array of issue types
 * @returns {Promise<Object>} - Clear result
 */
export const clearJiraCache = async (projectKey, issueTypes) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/api/jira/clear-cache`, {
      data: {
        projectKey,
        issueTypes
      }
    });

    if (response.data.success) {
      return {
        success: true,
        message: response.data.message
      };
    } else {
      return {
        success: false,
        error: response.data.error || 'Failed to clear cache'
      };
    }
  } catch (error) {
    console.error('Error clearing Jira cache:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to clear cache'
    };
  }
};

/**
 * Check if Jira data should be refetched
 * @param {Object} jiraCacheInfo - Current cache info
 * @param {Object} jiraConfig - Current Jira config
 * @returns {boolean} - True if should refetch
 */
export const shouldRefetch = (jiraCacheInfo, jiraConfig) => {
  return jiraCacheInfo.projectKey !== jiraConfig.projectKey || 
         JSON.stringify(jiraCacheInfo.issueTypes.sort()) !== JSON.stringify(jiraConfig.issueTypes.sort());
};

/**
 * Import Jira issues
 * @param {Array} selectedIssues - Array of selected issue keys
 * @returns {Promise<Object>} - Import result
 */
export const importJiraIssues = async (selectedIssues) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/jira/import-issues`, {
      selectedIssues
    });

    if (response.data.success) {
      return {
        success: true,
        features: response.data.features || [],
        message: response.data.message
      };
    } else {
      return {
        success: false,
        error: response.data.error || 'Failed to import Jira issues'
      };
    }
  } catch (error) {
    console.error('Error importing Jira issues:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to import Jira issues'
    };
  }
};

/**
 * Load Jira pushed states for all Jira issues
 * @param {Object} jiraTicketInfo - Jira ticket information
 * @param {Function} loadPushedStateFromCache - Function to load pushed state from cache
 * @returns {Promise<Object>} - Consolidated pushed states
 */
export const loadJiraPushedStates = async (jiraTicketInfo, loadPushedStateFromCache) => {
  const consolidatedState = {
    pushedTabs: new Set(),
    zephyrTestCaseIds: {},
    jiraTicketInfo: {}
  };

  if (!jiraTicketInfo || Object.keys(jiraTicketInfo).length === 0) {
    return consolidatedState;
  }

  try {
    // Load pushed states for each Jira ticket
    const loadPromises = Object.entries(jiraTicketInfo).map(async ([tabIndex, ticketInfo]) => {
      if (ticketInfo.ticketKey) {
        const jiraDocumentName = `jira-${ticketInfo.ticketKey}`;
        const state = await loadPushedStateFromCache(jiraDocumentName);
        
        if (state) {
          // Map the Jira-specific state to the main state
          state.pushedTabs.forEach(tab => {
            consolidatedState.pushedTabs.add(parseInt(tabIndex) + parseInt(tab));
          });
          
          Object.entries(state.zephyrTestCaseIds).forEach(([tab, testCaseId]) => {
            const mappedTab = parseInt(tabIndex) + parseInt(tab);
            consolidatedState.zephyrTestCaseIds[mappedTab] = testCaseId;
          });
          
          consolidatedState.jiraTicketInfo[tabIndex] = ticketInfo;
        }
      }
    });

    await Promise.all(loadPromises);
    
    console.log('💾 Jira pushed states loaded:', {
      pushedTabs: consolidatedState.pushedTabs.size,
      testCaseCount: Object.keys(consolidatedState.zephyrTestCaseIds).length,
      jiraTickets: Object.keys(consolidatedState.jiraTicketInfo).length
    });
    
    return consolidatedState;
  } catch (error) {
    console.error('Error loading Jira pushed states:', error);
    return consolidatedState;
  }
};
