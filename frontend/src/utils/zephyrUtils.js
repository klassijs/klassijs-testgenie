// Zephyr Scale Integration utility functions for TestGenerator component
/**
 * Fetches Zephyr Scale projects
 * @param {Function} setLoadingProjects - Function to set loading state
 * @param {Function} setZephyrProjects - Function to set Zephyr projects
 * @param {Function} setStatus - Function to set status message
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<void>}
 */
export const fetchZephyrProjects = async (setLoadingProjects, setZephyrProjects, setStatus, API_BASE_URL) => {
  try {
    setLoadingProjects(true);
    const response = await fetch(`${API_BASE_URL}/api/zephyr-projects`);
    const data = await response.json();
    
    if (data.success) {
      setZephyrProjects(data.projects);
    }
  } catch (error) {
    console.error('Error fetching Zephyr projects:', error);
    setStatus({ 
      type: 'error', 
      message: error.response?.data?.error || 'Failed to fetch Zephyr Scale projects' 
    });
  } finally {
    setLoadingProjects(false);
  }
};

/**
 * Fetches Zephyr Scale folders for selected project
 * @param {string} projectKey - Project key to fetch folders for
 * @param {Function} setZephyrFolders - Function to set Zephyr folders
 * @param {Function} setLoadingFolders - Function to set loading state
 * @param {Function} setStatus - Function to set status message
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<void>}
 */
export const fetchZephyrFolders = async (projectKey, setZephyrFolders, setLoadingFolders, setStatus, API_BASE_URL) => {
  if (!projectKey || projectKey.trim() === '') {
    setZephyrFolders([]);
    return;
  }

  try {
    setLoadingFolders(true);
    const response = await fetch(`${API_BASE_URL}/api/zephyr-folders/${projectKey}`);
    const data = await response.json();
    
    if (data.success) {
      setZephyrFolders(data.folders);
    }
  } catch (error) {
    console.error('Error fetching Zephyr folders:', error);
    setStatus({ 
      type: 'error', 
      message: error.response?.data?.error || 'Failed to fetch Zephyr Scale folders' 
    });
  } finally {
    setLoadingFolders(false);
  }
};

/**
 * Fetches all folders and organizes them hierarchically
 * @param {string} projectKey - Project key to fetch folders for
 * @param {Function} setZephyrFolders - Function to set Zephyr folders
 * @param {Function} setLoadingFolders - Function to set loading state
 * @param {Function} setFolderNavigation - Function to set folder navigation state
 * @param {Function} setSearchMode - Function to set search mode state
 * @param {Function} setStatus - Function to set status message
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<void>}
 */
export const fetchAllFolders = async (projectKey, setZephyrFolders, setLoadingFolders, setFolderNavigation, setSearchMode, setStatus, API_BASE_URL) => {
  if (!projectKey || projectKey.trim() === '') {
    setZephyrFolders([]);
    return;
  }

  try {
    setLoadingFolders(true);
    const response = await fetch(`${API_BASE_URL}/api/zephyr-folders/${projectKey}`);
    const data = await response.json();
    
    if (data.success) {
      setZephyrFolders(data.folders);
      setFolderNavigation({
        currentLevel: 'main',
        parentFolderId: null,
        parentFolderName: '',
        breadcrumb: []
      });
      setSearchMode(false);
    }
  } catch (error) {
    console.error('Error fetching all folders:', error);
    setStatus({ 
      type: 'error', 
      message: error.response?.data?.error || 'Failed to fetch folders' 
    });
  } finally {
    setLoadingFolders(false);
  }
};

/**
 * Searches folders across all levels
 * @param {string} projectKey - Project key to search in
 * @param {string} searchTerm - Search term
 * @param {Function} setZephyrFolders - Function to set Zephyr folders
 * @param {Function} setLoadingFolders - Function to set loading state
 * @param {Function} setFolderNavigation - Function to set folder navigation state
 * @param {Function} setSearchMode - Function to set search mode state
 * @param {Function} setStatus - Function to set status message
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<void>}
 */
export const searchFolders = async (projectKey, searchTerm, setZephyrFolders, setLoadingFolders, setFolderNavigation, setSearchMode, setStatus, API_BASE_URL) => {
  if (!projectKey || !searchTerm.trim()) return;
  
  try {
    setLoadingFolders(true);
    const response = await fetch(`${API_BASE_URL}/api/zephyr-search-folders/${projectKey}?searchTerm=${encodeURIComponent(searchTerm.trim())}`);
    const data = await response.json();
    
    if (data.success) {
      setZephyrFolders(data.folders);
      setFolderNavigation(prev => ({
        ...prev,
        currentLevel: 'search'
      }));
      setSearchMode(true);
    }
  } catch (error) {
    console.error('Error searching folders:', error);
    setStatus({ 
      type: 'error', 
      message: error.response?.data?.error || 'Failed to search folders' 
    });
  } finally {
    setLoadingFolders(false);
  }
};

/**
 * Pushes test content to Zephyr Scale
 * @param {string} content - Test content to push
 * @param {string} featureName - Name of the feature
 * @param {string} projectKey - Zephyr project key
 * @param {string} testCaseName - Name of the test case
 * @param {string} folderId - Folder ID to push to
 * @param {string} status - Test case status
 * @param {string} isAutomatable - Whether test is automatable
 * @param {string} testCaseId - Existing test case ID (for updates)
 * @param {Function} setZephyrProgress - Function to set progress state
 * @param {Function} setShowZephyrProgress - Function to set show progress modal
 * @param {Function} setStatus - Function to set status message
 * @param {Function} setPushedTabs - Function to set pushed tabs
 * @param {Function} setZephyrTestCaseIds - Function to set Zephyr test case IDs
 * @param {Function} savePushedStateToCache - Function to save pushed state to cache
 * @param {Object} jiraTicketInfo - Jira ticket information
 * @param {number} activeTab - Active tab index
 * @param {string} currentDocumentName - Current document name
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<Object|null>} - Response data or null if failed
 */
export const pushToZephyr = async (
  content,
  featureName = 'Test Feature',
  projectKey = '',
  testCaseName = '',
  folderId = '',
  status = 'Draft',
  isAutomatable = 'None',
  testCaseId = null,
  setZephyrProgress,
  setShowZephyrProgress,
  setStatus,
  setPushedTabs,
  setZephyrTestCaseIds,
  savePushedStateToCache,
  jiraTicketInfo,
  activeTab,
  currentDocumentName,
  API_BASE_URL
) => {
  try {
    // Parse content to count scenarios
    const lines = content.split('\n');
    const scenarios = [];
    let currentScenario = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
        if (currentScenario) {
          scenarios.push(currentScenario);
        }
        currentScenario = line.replace('Scenario:', '').replace('Scenario Outline:', '').trim();
      }
    }
    if (currentScenario) {
      scenarios.push(currentScenario);
    }
    
    const totalScenarios = Math.max(scenarios.length, 1);
    
    // Initialize progress
    setZephyrProgress({
      current: 0,
      total: totalScenarios,
      message: 'Preparing to push test cases...',
      status: 'pushing'
    });
    setShowZephyrProgress(true);
    
    // Real-time progress updates
    const updateProgress = (current, message) => {
      setZephyrProgress(prev => ({
        ...prev,
        current,
        message
      }));
    };
    
    // Start with connection phase
    updateProgress(0, 'Connecting to Zephyr Scale...');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Parse and prepare phase
    updateProgress(0, 'Preparing test cases...');
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Start the actual push
    updateProgress(0, 'Creating test cases in Zephyr Scale...');
    
    // Create a progress interval to show activity during the API call
    const progressInterval = setInterval(() => {
      setZephyrProgress(prev => {
        if (prev.current < totalScenarios) {
          return {
            ...prev,
            current: Math.min(prev.current + 1, totalScenarios - 1),
            message: `Creating test case ${Math.min(prev.current + 1, totalScenarios)} of ${totalScenarios}...`
          };
        }
        return prev;
      });
    }, 800); // Update every 800ms
    
    const response = await fetch(`${API_BASE_URL}/api/push-to-zephyr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: content,
        featureName: featureName,
        projectKey: projectKey,
        testCaseName: testCaseName,
        folderId: folderId || null,
        status: status,
        isAutomatable: isAutomatable,
        testCaseId: testCaseId,
        jiraTicketKey: jiraTicketInfo[activeTab]?.ticketKey || null,
        jiraBaseUrl: jiraTicketInfo[activeTab]?.jiraBaseUrl || null
      })
    });

    const data = await response.json();

    // Clear the progress interval
    clearInterval(progressInterval);

    if (data.success) {
      updateProgress(totalScenarios, 'Successfully pushed all test cases!');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setZephyrProgress(prev => ({
        ...prev,
        status: 'success'
      }));
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      setShowZephyrProgress(false);
      
      // Show success message
      setStatus({ 
        type: 'success', 
        message: `Test case "${activeTab}" pushed to Zephyr Scale successfully!${
          data.jiraTraceability && data.jiraTraceability.success ? 
            ` Jira ticket linked for traceability.` : 
            ''
        }` 
      });
      
      // Update pushed state
      const newPushedTabs = new Set([...Array.from(new Set()), activeTab]);
      const newTestCaseIds = { ...{}, [activeTab]: data.zephyrTestCaseId };
      
      setPushedTabs(newPushedTabs);
      setZephyrTestCaseIds(prev => ({
        ...prev,
        [activeTab]: data.zephyrTestCaseId
      }));
      
      // Save to cache
      if (jiraTicketInfo[activeTab]?.ticketKey) {
        const jiraDocumentName = `jira-${jiraTicketInfo[activeTab].ticketKey}`;
        savePushedStateToCache(newPushedTabs, newTestCaseIds, jiraDocumentName, jiraTicketInfo, API_BASE_URL);
      } else if (currentDocumentName) {
        savePushedStateToCache(newPushedTabs, newTestCaseIds, currentDocumentName, jiraTicketInfo, API_BASE_URL);
      }
      
      return data;
    } else {
      throw new Error('Push failed');
    }
  } catch (error) {
    console.error('Error pushing to Zephyr Scale:', error);
    
    setZephyrProgress(prev => ({
      ...prev,
      status: 'error',
      message: error.response?.data?.error || 'Failed to push to Zephyr Scale'
    }));
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    setShowZephyrProgress(false);
    
    setStatus({ 
      type: 'error', 
      message: error.response?.data?.error || 'Failed to push to Zephyr Scale. Please try again.' 
    });
    return null;
  }
};
