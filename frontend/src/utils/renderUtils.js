// Render utility functions for TestGenerator component
// These functions were extracted from TestGenerator.js to improve code organization

import { fetchLoadingImages } from './testGeneratorUtils';

/**
 * Rotates through loading images for display
 * @param {number} currentImage - Current image index
 * @param {boolean} isMounted - Whether component is mounted
 * @param {Function} setCurrentImage - Function to set current image index
 * @param {boolean} isGenerating - Whether test generation is in progress
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Function} Cleanup function to stop rotation
 */
export const rotateImages = (currentImage, isMounted, setCurrentImage, isGenerating, maxRetries = 5) => {
  let retryCount = 0;
  let intervalId = null;
  let localImageIndex = currentImage; // Use local counter instead of parameter
  
  const rotate = () => {
    try {
      // Check if component is still mounted and generating
      if (!isMounted || !isGenerating) return;
      
      // Get all test-image elements
      const images = document.querySelectorAll('.test-image');
      
      // Only proceed if images exist
      if (!images || images.length === 0) {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`⚠️  No test-image elements found, retrying in 1000ms (${retryCount}/${maxRetries})`);
          // Retry after a longer delay
          setTimeout(rotate, 1000);
        } else {
          console.log('⚠️  Max retries reached, stopping image rotation');
          // Clear the interval if we can't find images
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
        return;
      }
      
      // Reset retry count when images are found
      retryCount = 0;
      
      console.log(`🔄 Rotating to image ${localImageIndex + 1} of ${images.length}`);
      
      // Remove active class from all images
      images.forEach((img, index) => {
        if (img && img.classList) {
          img.classList.remove('active');
        }
      });
      
      // Add active class to current image
      if (images[localImageIndex]) {
        images[localImageIndex].classList.add('active');
      }
      
      // Move to next image
      localImageIndex = (localImageIndex + 1) % images.length;
      setCurrentImage(localImageIndex);
      
    } catch (error) {
      console.error('❌ Error in rotateImages function:', error);
    }
  };
  
  // Start rotation immediately
  rotate();
  
  // Set up interval for continuous rotation only if images are found
  if (retryCount === 0) {
    intervalId = setInterval(rotate, 2000);
  }
  
  // Cleanup function
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
};

/**
 * Loads loading images from the API or fallback to static images
 * @param {Function} setImagesLoaded - Function to set images loaded state
 * @param {Function} setLoadingImages - Function to set loading images
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<void>}
 */
export const loadImages = async (setImagesLoaded, setLoadingImages, API_BASE_URL) => {
  try {
    setImagesLoaded(false);
    const images = await fetchLoadingImages(API_BASE_URL);
    setLoadingImages(images);
    setImagesLoaded(true);
  } catch (error) {
    console.error('Error loading images:', error);
    // Fallback to static images if API fails
    const fallbackImages = [
      { image: "the-documentation-that-shapes-them.png", title: "Analyzing Requirements" },
      { image: "Google's Updated Spam Policy - Repeated_.jpeg", title: "Creating Test Scenarios" },
      { image: "Paperwork Robot Stock Illustrations_.png", title: "Adding Edge Cases" },
      { image: "A robot eating a stack of pancakes with_.png", title: "Generating Negative Tests" }
    ];
    setLoadingImages(fallbackImages);
    setImagesLoaded(true);
  }
};
