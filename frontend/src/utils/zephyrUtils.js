import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Zephyr Integration Utilities
 * Handles all Zephyr Scale operations including projects, folders, and test case pushing
 */

/**
 * Fetch Zephyr projects
 * @returns {Promise<Object>} - Projects result
 */
export const fetchZephyrProjects = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/zephyr/projects`);
    
    if (response.data.success) {
      return {
        success: true,
        projects: response.data.projects || []
      };
    } else {
      return {
        success: false,
        error: response.data.error || 'Failed to fetch Zephyr projects'
      };
    }
  } catch (error) {
    console.error('Error fetching Zephyr projects:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch Zephyr projects'
    };
  }
};

/**
 * Fetch Zephyr folders for a project
 * @param {string} projectKey - Zephyr project key
 * @returns {Promise<Object>} - Folders result
 */
export const fetchZephyrFolders = async (projectKey) => {
  if (!projectKey || projectKey.trim() === '') {
    console.warn('No project key provided for fetching Zephyr folders');
    return { success: false, error: 'Project key is required' };
  }

  try {
    const response = await axios.get(`${API_BASE_URL}/api/zephyr-folders?projectKey=${encodeURIComponent(projectKey)}`);
    
    if (response.data.success) {
      return {
        success: true,
        folders: response.data.folders || []
      };
    } else {
      return {
        success: false,
        error: response.data.error || 'Failed to fetch Zephyr folders'
      };
    }
  } catch (error) {
    console.error('Error fetching Zephyr folders:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch Zephyr folders'
    };
  }
};

/**
 * Fetch all folders for a project (recursive)
 * @param {string} projectKey - Zephyr project key
 * @returns {Promise<Object>} - All folders result
 */
export const fetchAllFolders = async (projectKey) => {
  if (!projectKey || projectKey.trim() === '') {
    console.warn('No project key provided for fetching all Zephyr folders');
    return { success: false, error: 'Project key is required' };
  }

  try {
    const response = await axios.get(`${API_BASE_URL}/api/zephyr-folders?projectKey=${encodeURIComponent(projectKey)}&all=true`);
    
    if (response.data.success) {
      return {
        success: true,
        folders: response.data.folders || []
      };
    } else {
      return {
        success: false,
        error: response.data.error || 'Failed to fetch all Zephyr folders'
      };
    }
  } catch (error) {
    console.error('Error fetching all Zephyr folders:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to fetch all Zephyr folders'
    };
  }
};

/**
 * Build folder tree structure
 * @param {Array} folders - Flat array of folders
 * @returns {Array} - Hierarchical folder tree
 */
export const buildFolderTree = (folders) => {
  const folderMap = new Map();
  const rootFolders = [];

  // Create a map of all folders
  folders.forEach(folder => {
    folderMap.set(folder.id, { ...folder, children: [] });
  });

  // Build the tree structure
  folders.forEach(folder => {
    if (folder.parentId && folderMap.has(folder.parentId)) {
      folderMap.get(folder.parentId).children.push(folderMap.get(folder.id));
    } else {
      rootFolders.push(folderMap.get(folder.id));
    }
  });

  return rootFolders;
};

/**
 * Toggle folder expansion state
 * @param {string} folderId - Folder ID to toggle
 * @param {Set} expandedFolders - Current expanded folders set
 * @param {Function} setExpandedFolders - Function to update expanded folders
 * @returns {void}
 */
export const toggleFolderExpansion = (folderId, expandedFolders, setExpandedFolders) => {
  const newExpanded = new Set(expandedFolders);
  if (newExpanded.has(folderId)) {
    newExpanded.delete(folderId);
  } else {
    newExpanded.add(folderId);
  }
  setExpandedFolders(newExpanded);
};

/**
 * Search folders
 * @param {string} projectKey - Zephyr project key
 * @param {string} searchTerm - Search term
 * @returns {Promise<Object>} - Search results
 */
export const searchFolders = async (projectKey, searchTerm) => {
  if (!projectKey || !searchTerm) {
    return { success: false, error: 'Project key and search term are required' };
  }

  try {
    const response = await axios.get(`${API_BASE_URL}/api/zephyr-folders?projectKey=${encodeURIComponent(projectKey)}&search=${encodeURIComponent(searchTerm)}`);
    
    if (response.data.success) {
      return {
        success: true,
        folders: response.data.folders || []
      };
    } else {
      return {
        success: false,
        error: response.data.error || 'Failed to search folders'
      };
    }
  } catch (error) {
    console.error('Error searching folders:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to search folders'
    };
  }
};

/**
 * Handle project change
 * @param {string} projectKey - New project key
 * @param {Function} setZephyrConfig - Function to update Zephyr config
 * @param {Function} setZephyrFolders - Function to update Zephyr folders
 * @param {Function} setExpandedFolders - Function to reset expanded folders
 * @returns {void}
 */
export const handleProjectChange = (projectKey, setZephyrConfig, setZephyrFolders, setExpandedFolders) => {
  setZephyrConfig(prev => ({ ...prev, projectKey, folderId: null }));
  setZephyrFolders([]);
  setExpandedFolders(new Set());
};

/**
 * Push test case to Zephyr Scale
 * @param {string} content - Test case content
 * @param {string} featureName - Feature name
 * @param {string} projectKey - Zephyr project key
 * @param {string} testCaseName - Test case name
 * @param {string} folderId - Folder ID
 * @param {string} status - Test case status
 * @param {string} isAutomatable - Automatable status
 * @param {string} testCaseId - Existing test case ID (for updates)
 * @param {Function} updateProgress - Function to update progress
 * @returns {Promise<Object>} - Push result
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
  updateProgress
) => {
  try {
    const payload = {
      content,
      featureName,
      projectKey,
      testCaseName,
      folderId,
      status,
      isAutomatable
    };

    if (testCaseId) {
      payload.testCaseId = testCaseId;
    }

    const response = await axios.post(`${API_BASE_URL}/api/zephyr/push`, payload);
    
    if (response.data.success) {
      return {
        success: true,
        testCaseId: response.data.testCaseId,
        message: response.data.message
      };
    } else {
      return {
        success: false,
        error: response.data.error || 'Failed to push to Zephyr'
      };
    }
  } catch (error) {
    console.error('Error pushing to Zephyr:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to push to Zephyr'
    };
  }
};
