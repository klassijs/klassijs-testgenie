/**
 * UI Event Handler Utilities
 * Handles UI interactions, selections, and event management
 */

/**
 * Handle click outside events
 * @param {Event} event - Click event
 * @param {Object} refs - Object containing refs to check
 * @param {Function} setShowDropdown - Function to hide dropdown
 * @returns {void}
 */
export const handleClickOutside = (event, refs, setShowDropdown) => {
  const isOutside = Object.values(refs).every(ref => 
    ref.current && !ref.current.contains(event.target)
  );
  
  if (isOutside) {
    setShowDropdown(false);
  }
};

/**
 * Handle requirement selection
 * @param {string} requirementId - Requirement ID to select/deselect
 * @param {Set} selectedRequirements - Current selected requirements set
 * @param {Function} setSelectedRequirements - Function to update selected requirements
 * @param {Function} setIsSelectAllChecked - Function to update select all checkbox
 * @param {Array} allRequirements - All available requirements
 * @returns {void}
 */
export const handleSelectRequirement = (
  requirementId, 
  selectedRequirements, 
  setSelectedRequirements, 
  setIsSelectAllChecked,
  allRequirements
) => {
  const newSelected = new Set(selectedRequirements);
  
  if (newSelected.has(requirementId)) {
    newSelected.delete(requirementId);
  } else {
    newSelected.add(requirementId);
  }
  
  setSelectedRequirements(newSelected);
  
  // Update select all checkbox state
  setIsSelectAllChecked(newSelected.size === allRequirements.length);
};

/**
 * Handle select all requirements
 * @param {Set} selectedRequirements - Current selected requirements set
 * @param {Function} setSelectedRequirements - Function to update selected requirements
 * @param {Function} setIsSelectAllChecked - Function to update select all checkbox
 * @param {Array} allRequirements - All available requirements
 * @returns {void}
 */
export const handleSelectAll = (
  selectedRequirements, 
  setSelectedRequirements, 
  setIsSelectAllChecked, 
  allRequirements
) => {
  const allSelected = selectedRequirements.size === allRequirements.length;
  
  if (allSelected) {
    setSelectedRequirements(new Set());
    setIsSelectAllChecked(false);
  } else {
    const allIds = new Set(allRequirements.map(req => req.id));
    setSelectedRequirements(allIds);
    setIsSelectAllChecked(true);
  }
};

/**
 * Handle delete selected requirements
 * @param {Function} setShowDeleteConfirmation - Function to show delete confirmation
 * @returns {void}
 */
export const handleDeleteSelected = (setShowDeleteConfirmation) => {
  setShowDeleteConfirmation(true);
};

/**
 * Confirm delete selected requirements
 * @param {Set} selectedRequirements - Currently selected requirements
 * @param {Array} allRequirements - All available requirements
 * @param {Function} setSelectedRequirements - Function to update selected requirements
 * @param {Function} setShowDeleteConfirmation - Function to hide delete confirmation
 * @param {Function} setStatus - Function to update status
 * @param {Function} setExtractedRequirements - Function to update extracted requirements
 * @param {Function} setFeatureTabs - Function to update feature tabs
 * @param {Function} setEditableFeatures - Function to update editable features
 * @param {Function} setPushedTabs - Function to update pushed tabs
 * @param {Function} setZephyrTestCaseIds - Function to update Zephyr test case IDs
 * @returns {Promise<void>}
 */
export const confirmDeleteSelected = async (
  selectedRequirements,
  allRequirements,
  setSelectedRequirements,
  setShowDeleteConfirmation,
  setStatus,
  setExtractedRequirements,
  setFeatureTabs,
  setEditableFeatures,
  setPushedTabs,
  setZephyrTestCaseIds
) => {
  if (selectedRequirements.size === 0) {
    setStatus({ type: 'error', message: 'No requirements selected for deletion' });
    return;
  }

  try {
    // Filter out selected requirements
    const remainingRequirements = allRequirements.filter(req => !selectedRequirements.has(req.id));
    
    // Update extracted requirements
    if (remainingRequirements.length > 0) {
      const updatedContent = formatRequirementsForInsertionWithGeneratedIds(remainingRequirements);
      setExtractedRequirements(updatedContent);
    } else {
      setExtractedRequirements('');
    }
    
    // Update feature tabs - remove tabs for deleted requirements
    setFeatureTabs(prev => {
      const remainingTabs = prev.filter((_, index) => !selectedRequirements.has(`REQ-${String(index + 1).padStart(3, '0')}`));
      return remainingTabs;
    });
    
    // Update editable features
    setEditableFeatures(prev => {
      const updated = {};
      Object.keys(prev).forEach(key => {
        const index = parseInt(key);
        if (!selectedRequirements.has(`REQ-${String(index + 1).padStart(3, '0')}`)) {
          updated[key] = prev[key];
        }
      });
      return updated;
    });
    
    // Update pushed tabs and Zephyr test case IDs
    setPushedTabs(prev => {
      const updated = new Set();
      prev.forEach(tabIndex => {
        if (!selectedRequirements.has(`REQ-${String(tabIndex + 1).padStart(3, '0')}`)) {
          updated.add(tabIndex);
        }
      });
      return updated;
    });
    
    setZephyrTestCaseIds(prev => {
      const updated = {};
      Object.keys(prev).forEach(key => {
        if (!selectedRequirements.has(`REQ-${String(parseInt(key) + 1).padStart(3, '0')}`)) {
          updated[key] = prev[key];
        }
      });
      return updated;
    });
    
    // Clear selection
    setSelectedRequirements(new Set());
    setShowDeleteConfirmation(false);
    
    setStatus({ 
      type: 'success', 
      message: `Successfully deleted ${selectedRequirements.size} requirement(s)` 
    });
  } catch (error) {
    console.error('Error deleting requirements:', error);
    setStatus({ type: 'error', message: 'Failed to delete requirements' });
  }
};

/**
 * Clear selection
 * @param {Function} setSelectedRequirements - Function to clear selected requirements
 * @param {Function} setIsSelectAllChecked - Function to uncheck select all
 * @returns {void}
 */
export const clearSelection = (setSelectedRequirements, setIsSelectAllChecked) => {
  setSelectedRequirements(new Set());
  setIsSelectAllChecked(false);
};

/**
 * Rotate loading images
 * @param {Array} images - Array of image URLs
 * @param {number} currentIndex - Current image index
 * @param {Function} setCurrentImageIndex - Function to update current index
 * @returns {void}
 */
export const rotateImages = (images, currentIndex, setCurrentImageIndex) => {
  if (images.length === 0) return;
  
  const nextIndex = (currentIndex + 1) % images.length;
  setCurrentImageIndex(nextIndex);
};

/**
 * Fetch loading images
 * @param {Function} setLoadingImages - Function to set loading images
 * @param {Function} setImagesLoaded - Function to set images loaded state
 * @returns {Promise<void>}
 */
export const fetchLoadingImages = async (setLoadingImages, setImagesLoaded) => {
  try {
    const images = [
      '/images/loading/A robot eating a stack of pancakes with_.png',
      '/images/loading/Google\'s Updated Spam Policy - Repeated_.jpeg',
      '/images/loading/Paperwork Robot Stock Illustrations_.png',
      '/images/loading/the-documentation-that-shapes-them.png'
    ];
    
    setLoadingImages(images);
    setImagesLoaded(true);
  } catch (error) {
    console.error('Error fetching loading images:', error);
    setImagesLoaded(false);
  }
};

/**
 * Format requirements for insertion with generated IDs
 * @param {Array} requirements - Array of requirements
 * @returns {string} - Formatted requirements table
 */
const formatRequirementsForInsertionWithGeneratedIds = (requirements) => {
  if (!requirements || requirements.length === 0) {
    return '';
  }
  
  // Generate IDs for requirements that don't have them
  const requirementsWithIds = requirements.map((req, index) => ({
    ...req,
    id: req.id || `REQ-${String(index + 1).padStart(3, '0')}`
  }));
  
  // Create the table header
  const headers = ['ID', 'Requirement', 'Acceptance Criteria', 'Complexity', 'Priority'];
  const headerRow = '| ' + headers.join(' | ') + ' |';
  const separatorRow = '|' + headers.map(() => '---').join('|') + '|';
  
  // Create table rows
  const rows = requirementsWithIds.map(req => {
    return `| ${req.id} | ${req.requirement} | ${req.acceptanceCriteria} | ${req.complexity} | ${req.priority} |`;
  });
  
  return [headerRow, separatorRow, ...rows].join('\n');
};
