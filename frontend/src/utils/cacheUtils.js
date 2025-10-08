import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Cache Management Utilities
 * Handles all cache-related operations for pushed states and document cache
 */

/**
 * Save pushed state to backend cache
 * @param {Set} pushedTabsSet - Set of pushed tab indices
 * @param {Object} testCaseIds - Object mapping tab indices to test case IDs
 * @param {string} documentName - Document name for cache key
 * @param {Object} jiraTicketInfo - Jira ticket information
 * @returns {Promise<void>}
 */
export const savePushedStateToCache = async (pushedTabsSet, testCaseIds, documentName, jiraTicketInfo) => {
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

    const response = await axios.post(`${API_BASE_URL}/api/pushed-state/${encodeURIComponent(documentName)}`, pushedState);
    
    if (response.data.success) {
      console.log('💾 Pushed state saved to backend cache:', {
        documentName,
        pushedTabs: Array.from(pushedTabsSet),
        testCaseCount: Object.keys(testCaseIds).length
      });
    }
  } catch (error) {
    console.error('Error saving pushed state to backend cache:', error);
  }
};

/**
 * Load pushed state from backend cache
 * @param {string} documentName - Document name for cache key
 * @returns {Promise<boolean>} - True if state was loaded successfully
 */
export const loadPushedStateFromCache = async (documentName) => {
  if (!documentName) {
    console.warn('No document name provided for loading pushed state');
    return false;
  }

  try {
    const response = await axios.get(`${API_BASE_URL}/api/pushed-state/${encodeURIComponent(documentName)}`);
    
    if (response.data.success && response.data.pushedState) {
      const { pushedTabs, zephyrTestCaseIds, jiraTicketInfo } = response.data.pushedState;
      
      console.log('💾 Pushed state loaded from backend cache:', {
        documentName,
        pushedTabs: pushedTabs?.length || 0,
        testCaseCount: Object.keys(zephyrTestCaseIds || {}).length,
        jiraTickets: Object.keys(jiraTicketInfo || {}).length
      });
      
      return {
        pushedTabs: new Set(pushedTabs || []),
        zephyrTestCaseIds: zephyrTestCaseIds || {},
        jiraTicketInfo: jiraTicketInfo || {}
      };
    } else {
      console.log('💾 Backend Cache Status: No cache found for', documentName);
      return false;
    }
  } catch (error) {
    console.error('Error loading pushed state from backend cache:', error);
    return false;
  }
};

/**
 * Load Jira pushed states for all Jira issues
 * @param {Array} jiraTicketInfo - Array of Jira ticket information
 * @returns {Promise<Object>} - Consolidated pushed states
 */
export const loadJiraPushedStates = async (jiraTicketInfo) => {
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

/**
 * Clear pushed state cache
 * @param {string} documentName - Document name for cache key
 * @returns {Promise<void>}
 */
export const clearPushedStateCache = async (documentName) => {
  if (!documentName) {
    console.warn('No document name provided for clearing pushed state');
    return;
  }

  try {
    const response = await axios.delete(`${API_BASE_URL}/api/pushed-state/${encodeURIComponent(documentName)}`);
    
    if (response.data.success) {
      console.log('🗑️ Pushed state cleared from backend cache for', documentName);
    }
  } catch (error) {
    console.error('Error clearing pushed state from backend cache:', error);
  }
};

/**
 * Debug cache status
 * @param {string} documentName - Document name for cache key
 * @returns {Promise<void>}
 */
export const debugCacheStatus = async (documentName) => {
  if (!documentName) {
    console.warn('No document name provided for cache debug');
    return;
  }

  try {
    const response = await axios.get(`${API_BASE_URL}/api/pushed-state/${encodeURIComponent(documentName)}`);
    
    if (response.data.success && response.data.pushedState) {
      const { pushedTabs, zephyrTestCaseIds, jiraTicketInfo } = response.data.pushedState;
      
      console.log('🔍 Cache Debug Status:', {
        documentName,
        pushedTabs: pushedTabs?.length || 0,
        testCaseCount: Object.keys(zephyrTestCaseIds || {}).length,
        jiraTickets: Object.keys(jiraTicketInfo || {}).length,
        cachedAt: response.data.pushedState._cacheInfo?.cachedAt || 'Unknown'
      });
    } else {
      console.log('🔍 Cache Debug Status: No cache found for', documentName);
    }
  } catch (error) {
    console.error('Error debugging cache status:', error);
  }
};

/**
 * Fetch cache list from backend
 * @returns {Promise<Array>} - Array of cached documents
 */
export const fetchCacheList = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/cache-list`);
    
    if (response.data.success) {
      return response.data.documents || [];
    } else {
      console.error('Failed to fetch cache list:', response.data.error);
      return [];
    }
  } catch (error) {
    console.error('Error fetching cache list:', error);
    return [];
  }
};

/**
 * Handle cache selection
 * @param {string} cacheName - Name of the cache to select
 * @param {Set} selectedCaches - Current selected caches set
 * @param {Function} setSelectedCaches - Function to update selected caches
 * @returns {void}
 */
export const handleSelectCache = (cacheName, selectedCaches, setSelectedCaches) => {
  const newSelected = new Set(selectedCaches);
  if (newSelected.has(cacheName)) {
    newSelected.delete(cacheName);
  } else {
    newSelected.add(cacheName);
  }
  setSelectedCaches(newSelected);
};

/**
 * Handle select all caches
 * @param {Array} cacheList - List of all caches
 * @param {Set} selectedCaches - Current selected caches set
 * @param {Function} setSelectedCaches - Function to update selected caches
 * @param {Function} setIsSelectAllCachesChecked - Function to update select all checkbox
 * @returns {void}
 */
export const handleSelectAllCaches = (cacheList, selectedCaches, setSelectedCaches, setIsSelectAllCachesChecked) => {
  const allSelected = selectedCaches.size === cacheList.length;
  
  if (allSelected) {
    setSelectedCaches(new Set());
    setIsSelectAllCachesChecked(false);
  } else {
    const allCacheNames = new Set(cacheList.map(doc => doc.name));
    setSelectedCaches(allCacheNames);
    setIsSelectAllCachesChecked(true);
  }
};

/**
 * Handle delete selected caches
 * @param {Function} setShowCacheDeleteConfirmation - Function to show delete confirmation
 * @returns {void}
 */
export const handleDeleteSelectedCaches = (setShowCacheDeleteConfirmation) => {
  setShowCacheDeleteConfirmation(true);
};

/**
 * Confirm delete selected caches
 * @param {Set} selectedCaches - Currently selected caches
 * @param {Function} setSelectedCaches - Function to update selected caches
 * @param {Function} setShowCacheDeleteConfirmation - Function to hide delete confirmation
 * @param {Function} setStatus - Function to update status
 * @param {Function} fetchCacheList - Function to refresh cache list
 * @returns {Promise<void>}
 */
export const confirmDeleteSelectedCaches = async (
  selectedCaches, 
  setSelectedCaches, 
  setShowCacheDeleteConfirmation, 
  setStatus, 
  fetchCacheList
) => {
  if (selectedCaches.size === 0) {
    setStatus({ type: 'error', message: 'No caches selected for deletion' });
    return;
  }

  try {
    const response = await axios.delete(`${API_BASE_URL}/api/cache/delete`, {
      data: { documentNames: Array.from(selectedCaches) }
    });

    if (response.data.success) {
      setStatus({ 
        type: 'success', 
        message: `Successfully deleted ${response.data.results.deletedCount} document(s) from cache` 
      });
      
      // Clear selection
      setSelectedCaches(new Set());
      setShowCacheDeleteConfirmation(false);
      
      // Refresh cache list
      await fetchCacheList();
    } else {
      setStatus({ type: 'error', message: response.data.error || 'Failed to delete caches' });
    }
  } catch (error) {
    console.error('Error deleting caches:', error);
    setStatus({ 
      type: 'error', 
      message: error.response?.data?.error || 'Failed to delete caches' 
    });
  }
};

/**
 * Open cache management modal
 * @param {Function} setShowCacheModal - Function to show cache modal
 * @param {Function} fetchCacheList - Function to fetch cache list
 * @returns {Promise<void>}
 */
export const openCacheModal = async (setShowCacheModal, fetchCacheList) => {
  setShowCacheModal(true);
  await fetchCacheList();
};
