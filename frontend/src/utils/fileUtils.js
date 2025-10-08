import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * File Management Utilities
 * Handles file upload, processing, drag & drop, and file operations
 */

/**
 * Process uploaded file
 * @param {Object} fileObj - File object with name, content, and type
 * @param {Function} setContent - Function to set content
 * @param {Function} setContext - Function to set context
 * @param {Function} setCurrentDocumentName - Function to set document name
 * @param {Function} setStatus - Function to set status
 * @param {Function} setExtractedRequirements - Function to set extracted requirements
 * @param {Function} setRequirementsSource - Function to set requirements source
 * @param {Function} setFeatureTabs - Function to set feature tabs
 * @param {Function} setEditableFeatures - Function to set editable features
 * @param {Function} setJiraTicketInfo - Function to set Jira ticket info
 * @param {Function} setJiraTicketPrefix - Function to set Jira ticket prefix
 * @returns {Promise<void>}
 */
export const processFile = async (
  fileObj,
  setContent,
  setContext,
  setCurrentDocumentName,
  setStatus,
  setExtractedRequirements,
  setRequirementsSource,
  setFeatureTabs,
  setEditableFeatures,
  setJiraTicketInfo,
  setJiraTicketPrefix
) => {
  try {
    setStatus({ type: 'info', message: 'Processing file...' });
    
    // Set document name and context
    setCurrentDocumentName(fileObj.name);
    setContext(`Processing ${fileObj.name}`);
    
    // Extract requirements from the file content
    const response = await axios.post(`${API_BASE_URL}/api/extract-requirements`, {
      content: fileObj.content,
      context: `File: ${fileObj.name}`,
      documentName: fileObj.name,
      enableLogging: false
    });
    
    if (response.data.success) {
      // Set the extracted requirements
      setExtractedRequirements(response.data.content);
      setRequirementsSource('file');
      
      // Parse the requirements table to extract individual requirements
      const requirementsContent = response.data.content;
      const requirements = parseRequirementsTable(requirementsContent);
      
      if (requirements.length > 0) {
        // Create feature tabs from extracted requirements
        const newFeatures = requirements.map((req, index) => ({
          title: req.id || `REQ-${String(index + 1).padStart(3, '0')}`,
          content: `Requirement: ${req.requirement}\n\nAcceptance Criteria: ${req.acceptanceCriteria}`,
          originalContent: req.requirement
        }));
        
        // Add new features to existing tabs
        setFeatureTabs(prev => {
          const updatedTabs = [...prev, ...newFeatures];
          return updatedTabs;
        });
        
        // Initialize editable features for new sections
        setEditableFeatures(prev => {
          const editableFeaturesObj = {};
          newFeatures.forEach((feature, index) => {
            const globalIndex = (prev?.length || 0) + index;
            editableFeaturesObj[globalIndex] = feature.content;
          });
          return { ...prev, ...editableFeaturesObj };
        });
        
        // Clear Jira-specific state for file uploads
        setJiraTicketInfo({});
        setJiraTicketPrefix('');
        
        setStatus({ 
          type: 'success', 
          message: `Successfully processed ${fileObj.name} and extracted ${requirements.length} requirements!` 
        });
        
        // Scroll to the requirements section
        setTimeout(() => {
          const requirementsSection = document.querySelector('.requirements-section');
          if (requirementsSection) {
            requirementsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 200);
      } else {
        setStatus({ type: 'warning', message: 'No requirements found in the file' });
      }
    } else {
      setStatus({ type: 'error', message: response.data.error || 'Failed to process file' });
    }
  } catch (error) {
    console.error('Error processing file:', error);
    setStatus({ 
      type: 'error', 
      message: error.response?.data?.error || 'Failed to process file' 
    });
  }
};

/**
 * Handle file upload
 * @param {Event} event - File input change event
 * @param {Function} setUploadedFiles - Function to set uploaded files
 * @param {Function} processFile - Function to process file
 * @param {Function} setStatus - Function to set status
 * @returns {void}
 */
export const handleFileUpload = (event, setUploadedFiles, processFile, setStatus) => {
  const files = Array.from(event.target.files);
  
  if (files.length === 0) return;
  
  files.forEach(async (file) => {
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setStatus({ type: 'error', message: `File ${file.name} is too large. Maximum size is 10MB.` });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target.result;
      const fileObj = {
        id: Date.now() + Math.random(),
        name: file.name,
        content: content,
        type: file.type,
        size: file.size
      };
      
      setUploadedFiles(prev => [...prev, fileObj]);
      await processFile(fileObj);
    };
    
    reader.onerror = () => {
      setStatus({ type: 'error', message: `Failed to read file ${file.name}` });
    };
    
    reader.readAsText(file);
  });
  
  // Reset the input
  event.target.value = '';
};

/**
 * Remove uploaded file
 * @param {string} fileId - File ID to remove
 * @param {Array} uploadedFiles - Current uploaded files
 * @param {Function} setUploadedFiles - Function to update uploaded files
 * @returns {void}
 */
export const removeFile = (fileId, uploadedFiles, setUploadedFiles) => {
  setUploadedFiles(uploadedFiles.filter(file => file.id !== fileId));
};

/**
 * Handle drag over event
 * @param {Event} e - Drag over event
 * @returns {void}
 */
export const handleDragOver = (e) => {
  e.preventDefault();
  e.stopPropagation();
};

/**
 * Handle drag leave event
 * @param {Event} e - Drag leave event
 * @returns {void}
 */
export const handleDragLeave = (e) => {
  e.preventDefault();
  e.stopPropagation();
};

/**
 * Handle file drop event
 * @param {Event} e - Drop event
 * @param {Function} setUploadedFiles - Function to set uploaded files
 * @param {Function} processFile - Function to process file
 * @param {Function} setStatus - Function to set status
 * @returns {void}
 */
export const handleDrop = (e, setUploadedFiles, processFile, setStatus) => {
  e.preventDefault();
  e.stopPropagation();
  
  const files = Array.from(e.dataTransfer.files);
  
  if (files.length === 0) return;
  
  files.forEach(async (file) => {
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setStatus({ type: 'error', message: `File ${file.name} is too large. Maximum size is 10MB.` });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target.result;
      const fileObj = {
        id: Date.now() + Math.random(),
        name: file.name,
        content: content,
        type: file.type,
        size: file.size
      };
      
      setUploadedFiles(prev => [...prev, fileObj]);
      await processFile(fileObj);
    };
    
    reader.onerror = () => {
      setStatus({ type: 'error', message: `Failed to read file ${file.name}` });
    };
    
    reader.readAsText(file);
  });
};

/**
 * Format file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Handle content download
 * @param {string} content - Content to download
 * @param {string} filename - Filename for download
 * @returns {Promise<void>}
 */
export const handleDownloadContent = async (content, filename = 'content.txt') => {
  try {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading content:', error);
  }
};

/**
 * Parse requirements table from content
 * @param {string} requirementsContent - Requirements content
 * @returns {Array} - Parsed requirements array
 */
const parseRequirementsTable = (requirementsContent) => {
  const requirements = [];
  const lines = requirementsContent.split('\n');
  
  let inTable = false;
  let headers = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this is a table header
    if (line.includes('|') && (line.toLowerCase().includes('requirement') || line.toLowerCase().includes('id'))) {
      inTable = true;
      headers = line.split('|').map(h => h.trim()).filter(h => h);
      continue;
    }
    
    // Check if this is a table separator
    if (inTable && line.includes('|') && line.includes('---')) {
      continue;
    }
    
    // Parse table rows
    if (inTable && line.includes('|') && !line.includes('---')) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      
      if (cells.length >= 2) {
        const requirement = {
          id: cells[0] || '',
          requirement: cells[1] || '',
          acceptanceCriteria: cells[2] || '',
          complexity: cells[3] || 'Medium',
          priority: cells[4] || 'Medium'
        };
        
        requirements.push(requirement);
      }
    }
    
    // Stop parsing if we hit an empty line or non-table content
    if (inTable && line === '') {
      break;
    }
  }
  
  return requirements;
};
