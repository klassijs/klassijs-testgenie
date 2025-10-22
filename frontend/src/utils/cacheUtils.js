// Cache Management utility functions for TestGenerator component
/**
 * Saves pushed state to backend cache
 * @param {Set} pushedTabsSet - Set of pushed tab indices
 * @param {Object} testCaseIds - Object containing test case IDs
 * @param {string} documentName - Name of the document
 * @param {Object} jiraTicketInfo - JIRA ticket information
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<void>}
 */
export const savePushedStateToCache = async (pushedTabsSet, testCaseIds, documentName, jiraTicketInfo, API_BASE_URL) => {
  if (!documentName) {
    console.warn('No document name provided for pushed state cache');
    return;
  }

  try {
    const pushedState = {
      pushedTabs: Array.from(pushedTabsSet),
      zephyrTestCaseIds: testCaseIds,
      jiraTicketInfo: jiraTicketInfo
    };

    await fetch(`${API_BASE_URL}/api/pushed-state/${encodeURIComponent(documentName)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pushedState)
    });
  } catch (error) {
    console.error('Error saving pushed state to backend cache:', error);
  }
};

/**
 * Loads pushed state from backend cache
 * @param {string} documentName - Name of the document
 * @param {Function} setPushedTabs - Function to set pushed tabs state
 * @param {Function} setZephyrTestCaseIds - Function to set Zephyr test case IDs
 * @param {Function} setJiraTicketInfo - Function to set JIRA ticket info
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<boolean>} - Whether state was loaded successfully
 */
export const loadPushedStateFromCache = async (documentName, setPushedTabs, setZephyrTestCaseIds, setJiraTicketInfo, API_BASE_URL) => {
  if (!documentName) {
    console.warn('No document name provided for loading pushed state');
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/pushed-state/${encodeURIComponent(documentName)}`);
    const data = await response.json();
    
    if (data.success && data.pushedState) {
      const pushedState = data.pushedState;
      
      setPushedTabs(new Set(pushedState.pushedTabs || []));
      setZephyrTestCaseIds(pushedState.zephyrTestCaseIds || {});
      
      // Restore Jira ticket info if available
      if (pushedState.jiraTicketInfo) {
        setJiraTicketInfo(pushedState.jiraTicketInfo);
      }

      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error('Error loading pushed state from backend cache:', error);
    return false;
  }
};

/**
 * Loads JIRA pushed states and consolidates them
 * @param {Array} featureTabs - Array of feature tabs
 * @param {Object} jiraTicketInfo - JIRA ticket information
 * @param {Function} setPushedTabs - Function to set pushed tabs state
 * @param {Function} setZephyrTestCaseIds - Function to set Zephyr test case IDs
 * @param {Function} setJiraTicketInfo - Function to set JIRA ticket info
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<void>}
 */
export const loadJiraPushedStates = async (featureTabs, jiraTicketInfo, setPushedTabs, setZephyrTestCaseIds, setJiraTicketInfo, API_BASE_URL) => {
  const consolidatedPushedTabs = new Set();
  const consolidatedTestCaseIds = {};
  const consolidatedJiraTicketInfo = {};
  
  for (let index = 0; index < featureTabs.length; index++) {
    const tab = featureTabs[index];
    if (tab.source === 'jira' && jiraTicketInfo[index]?.ticketKey) {
      try {
        const jiraDocumentName = `jira-${jiraTicketInfo[index].ticketKey}`;
        const response = await fetch(`${API_BASE_URL}/api/pushed-state/${encodeURIComponent(jiraDocumentName)}`);
        const data = await response.json();
        
        if (data.success && data.pushedState) {
          const pushedState = data.pushedState;
          
          // If this Jira issue was pushed (has pushedTabs with index 0), add it to consolidated state
          if (pushedState.pushedTabs?.includes(0)) {
            consolidatedPushedTabs.add(index);
            consolidatedTestCaseIds[index] = pushedState.zephyrTestCaseIds?.[0] || {};
            consolidatedJiraTicketInfo[index] = jiraTicketInfo[index];
          }
        }
      } catch (error) {
        console.error(`Error loading pushed state for Jira issue ${jiraTicketInfo[index].ticketKey}:`, error);
      }
    }
  }
  
  // Update the consolidated state
  if (consolidatedPushedTabs.size > 0) {
    setPushedTabs(consolidatedPushedTabs);
    setZephyrTestCaseIds(consolidatedTestCaseIds);
    setJiraTicketInfo(consolidatedJiraTicketInfo);
  }
};

/**
 * Clears pushed state cache
 * @param {string} requirementsSource - Source of requirements ('upload' or 'jira')
 * @param {Array} featureTabs - Array of feature tabs
 * @param {Object} jiraTicketInfo - JIRA ticket information
 * @param {string} currentDocumentName - Current document name
 * @param {Function} setPushedTabs - Function to set pushed tabs state
 * @param {Function} setZephyrTestCaseIds - Function to set Zephyr test case IDs
 * @param {Function} setJiraTicketInfo - Function to set JIRA ticket info
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<void>}
 */
export const clearPushedStateCache = async (requirementsSource, featureTabs, jiraTicketInfo, currentDocumentName, setPushedTabs, setZephyrTestCaseIds, setJiraTicketInfo, API_BASE_URL) => {
  try {
    if (requirementsSource === 'jira' && featureTabs.length > 0) {
      // For Jira issues, clear pushed state for each issue
      for (let index = 0; index < featureTabs.length; index++) {
        const tab = featureTabs[index];
        if (tab.source === 'jira' && jiraTicketInfo[index]?.ticketKey) {
          const jiraDocumentName = `jira-${jiraTicketInfo[index].ticketKey}`;
          await fetch(`${API_BASE_URL}/api/pushed-state/${encodeURIComponent(jiraDocumentName)}`, {
            method: 'DELETE'
          });
        }
      }
    } else if (currentDocumentName) {
      // For uploaded documents, clear normally
      await fetch(`${API_BASE_URL}/api/pushed-state/${encodeURIComponent(currentDocumentName)}`, {
        method: 'DELETE'
      });
    }
    
    setPushedTabs(new Set());
    setZephyrTestCaseIds({});
    setJiraTicketInfo({});
  } catch (error) {
    console.error('Error clearing pushed state cache:', error);
  }
};

/**
 * Debug function to show cache status
 * @param {string} currentDocumentName - Current document name
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<void>}
 */
export const debugCacheStatus = async (currentDocumentName, API_BASE_URL) => {
  try {
    if (currentDocumentName) {
      const response = await fetch(`${API_BASE_URL}/api/pushed-state/${encodeURIComponent(currentDocumentName)}`);
      const data = await response.json();
      
      if (data.success && data.pushedState) {
        
      } else {
       
      }
    } else {
     
    }
  } catch (error) {
    console.error('Error checking cache status:', error);
  }
};

/**
 * Fetches cache list from backend
 * @param {Function} setIsLoadingCache - Function to set loading state
 * @param {Function} setCacheList - Function to set cache list
 * @param {Function} setStatus - Function to set status message
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<void>}
 */
export const fetchCacheList = async (setIsLoadingCache, setCacheList, setStatus, API_BASE_URL) => {
  setIsLoadingCache(true);
  try {
    const response = await fetch(`${API_BASE_URL}/api/cache/list`);
    const data = await response.json();
    
    if (data.success) {
      setCacheList(data.documents);
    } else {
      setStatus({ type: 'error', message: 'Failed to fetch cache list' });
    }
  } catch (error) {
    console.error('Error fetching cache list:', error);
    setStatus({ type: 'error', message: 'Failed to fetch cache list' });
  } finally {
    setIsLoadingCache(false);
  }
};
