const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class CacheManager {
  constructor() {
    this.cacheDir = path.join(__dirname, '..', 'cache');
    this.metadataFile = path.join(this.cacheDir, 'metadata.json');
    this.ensureCacheDirSync();
  }

  /**
   * Get document-specific metadata file path
   * @param {string} documentName - Document name
   * @returns {string} - Document metadata file path
   */
  getDocumentMetadataPath(documentName) {
    const docDir = path.join(this.cacheDir, this.sanitizeFileName(documentName));
    return path.join(docDir, 'metadata.json');
  }

  ensureCacheDirSync() {
    try {
      require('fs').accessSync(this.cacheDir);
    } catch (error) {
      require('fs').mkdirSync(this.cacheDir, { recursive: true });
      // console.log('📁 Created cache directory');
    }
  }

  /**
   * Generate SHA256 hash of file buffer
   * @param {Buffer} fileBuffer - The file buffer to hash
   * @returns {string} - SHA256 hash
   */
  generateFileHash(fileBuffer) {
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Get cache file path for a given hash and document name
   * @param {string} hash - File hash
   * @param {string} documentName - Document name (for directory organization)
   * @returns {string} - Cache file path
   */
  getCacheFilePath(hash, documentName = null) {
    if (documentName) {
      // Create document-specific directory
      const docDir = path.join(this.cacheDir, this.sanitizeFileName(documentName));
      return path.join(docDir, `${hash}.json`);
    }
    return path.join(this.cacheDir, `${hash}.json`);
  }

  /**
   * Sanitize filename for use as directory name
   * @param {string} fileName - Original filename
   * @returns {string} - Sanitized filename
   */
  sanitizeFileName(fileName) {
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .substring(0, 50); // Limit length
  }

  /**
   * Load metadata from cache
   * @returns {Object} - Metadata object
   */
  async loadMetadata() {
    try {
      const data = await fs.readFile(this.metadataFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return {};
    }
  }

  /**
   * Save metadata to cache
   * @param {Object} metadata - Metadata object to save
   */
  async saveMetadata(metadata) {
    await fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2));
  }

  /**
   * Load document-specific metadata
   * @param {string} documentName - Document name
   * @returns {Object} - Document metadata object
   */
  async loadDocumentMetadata(documentName) {
    try {
      const docMetadataPath = this.getDocumentMetadataPath(documentName);
      const data = await fs.readFile(docMetadataPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return {};
    }
  }

  /**
   * Save document-specific metadata
   * @param {string} documentName - Document name
   * @param {Object} metadata - Document metadata object to save
   */
  async saveDocumentMetadata(documentName, metadata) {
    const docMetadataPath = this.getDocumentMetadataPath(documentName);
    const docDir = path.dirname(docMetadataPath);
    
    // Ensure document directory exists
    await fs.mkdir(docDir, { recursive: true });
    
    await fs.writeFile(docMetadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Check if analysis results exist in cache
   * @param {string} hash - File hash
   * @param {string} documentName - Document name (optional, for backward compatibility)
   * @returns {boolean} - True if cached results exist
   */
  async hasCachedResults(hash, documentName = null) {
    try {
      // First try with document name if provided
      if (documentName) {
        const cacheFilePath = this.getCacheFilePath(hash, documentName);
        await fs.access(cacheFilePath);
        return true;
      }
      
      // Fallback: search in all document directories
      const metadata = await this.loadMetadata();
      if (metadata[hash] && metadata[hash].documentDir) {
        const cacheFilePath = this.getCacheFilePath(hash, metadata[hash].filename);
        await fs.access(cacheFilePath);
        return true;
      }
      
      // Legacy: try old location
      const legacyPath = this.getCacheFilePath(hash);
      await fs.access(legacyPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cached analysis results
   * @param {string} hash - File hash
   * @param {string} documentName - Document name (optional, for backward compatibility)
   * @returns {Object|null} - Cached results or null if not found
   */
  async getCachedResults(hash, documentName = null) {
    try {
      let cacheFilePath;
      
      // First try with document name if provided
      if (documentName) {
        cacheFilePath = this.getCacheFilePath(hash, documentName);
      } else {
        // Fallback: search in all document directories
        const metadata = await this.loadMetadata();
        if (metadata[hash] && metadata[hash].documentDir) {
          cacheFilePath = this.getCacheFilePath(hash, metadata[hash].filename);
        } else {
          // Legacy: try old location
          cacheFilePath = this.getCacheFilePath(hash);
        }
      }
      
      const data = await fs.readFile(cacheFilePath, 'utf8');
      const results = JSON.parse(data);
      
      // Add cache hit info
      results._cacheInfo = {
        hit: true,
        cachedAt: results.cachedAt || new Date().toISOString(),
        retrievedAt: new Date().toISOString()
      };
      
      return results;
    } catch (error) {
      return null;
    }
  }

  /**
   * Store analysis results in cache
   * @param {string} hash - File hash
   * @param {Object} results - Analysis results to cache
   * @param {string} originalFilename - Original filename
   */
  async storeCachedResults(hash, results, originalFilename) {
    try {
      // Add cache metadata
      const cachedResults = {
        ...results,
        _cacheInfo: {
          hit: false,
          cachedAt: new Date().toISOString(),
          originalFilename,
          hash
        }
      };

      // Create document-specific directory
      const cacheFilePath = this.getCacheFilePath(hash, originalFilename);
      const docDir = path.dirname(cacheFilePath);
      
      // Ensure directory exists
      await fs.mkdir(docDir, { recursive: true });

      // Save results to cache file
      await fs.writeFile(cacheFilePath, JSON.stringify(cachedResults, null, 2));

      // Update global metadata
      const globalMetadata = await this.loadMetadata();
      globalMetadata[hash] = {
        filename: originalFilename,
        cachedAt: new Date().toISOString(),
        fileSize: results.fileSize || 0,
        issueCount: results.issues?.length || 0,
        documentDir: this.sanitizeFileName(originalFilename)
      };
      await this.saveMetadata(globalMetadata);

      // Update document-specific metadata
      const docMetadata = await this.loadDocumentMetadata(originalFilename);
      docMetadata[hash] = {
        type: 'document_analysis',
        cachedAt: new Date().toISOString(),
        fileSize: results.fileSize || 0,
        issueCount: results.issues?.length || 0
      };
      await this.saveDocumentMetadata(originalFilename, docMetadata);

      // console.log(`💾 Cached analysis results for ${originalFilename} in ${this.sanitizeFileName(originalFilename)}/ (${hash.substring(0, 8)}...)`);
    } catch (error) {
      console.error('❌ Failed to cache results:', error.message);
    }
  }

  /**
   * Generate content hash for test generation caching
   * @param {string} content - Content to hash
   * @param {string} context - Additional context
   * @returns {string} - SHA256 hash
   */
  generateContentHash(content, context = '') {
    const combinedContent = content + '|' + context;
    return crypto.createHash('sha256').update(combinedContent).digest('hex');
  }

  /**
   * Get test generation cache file path
   * @param {string} contentHash - Content hash
   * @param {string} documentName - Document name (for directory organization)
   * @returns {string} - Test cache file path
   */
  getTestCacheFilePath(contentHash, documentName = null) {
    if (documentName) {
      // Create document-specific directory
      const docDir = path.join(this.cacheDir, this.sanitizeFileName(documentName));
      return path.join(docDir, `test_${contentHash}.json`);
    }
    return path.join(this.cacheDir, `test_${contentHash}.json`);
  }

  /**
   * Check if test generation results exist in cache
   * @param {string} contentHash - Content hash
   * @param {string} documentName - Document name (optional, for directory organization)
   * @returns {boolean} - True if cached test results exist
   */
  async hasCachedTestResults(contentHash, documentName = null) {
    try {
      // First try with document name if provided
      if (documentName) {
        const testCacheFilePath = this.getTestCacheFilePath(contentHash, documentName);
        await fs.access(testCacheFilePath);
        return true;
      }
      
      // Fallback: search in all document directories
      const metadata = await this.loadMetadata();
      if (metadata[contentHash] && metadata[contentHash].documentDir) {
        const testCacheFilePath = this.getTestCacheFilePath(contentHash, metadata[contentHash].filename);
        await fs.access(testCacheFilePath);
        return true;
      }
      
      // Legacy: try old location
      const legacyPath = this.getTestCacheFilePath(contentHash);
      await fs.access(legacyPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cached test generation results
   * @param {string} contentHash - Content hash
   * @param {string} documentName - Document name (optional, for directory organization)
   * @returns {Object|null} - Cached test results or null if not found
   */
  async getCachedTestResults(contentHash, documentName = null) {
    try {
      let testCacheFilePath;
      
      // First try with document name if provided
      if (documentName) {
        testCacheFilePath = this.getTestCacheFilePath(contentHash, documentName);
      } else {
        // Fallback: search in all document directories
        const metadata = await this.loadMetadata();
        if (metadata[contentHash] && metadata[contentHash].documentDir) {
          testCacheFilePath = this.getTestCacheFilePath(contentHash, metadata[contentHash].filename);
        } else {
          // Legacy: try old location
          testCacheFilePath = this.getTestCacheFilePath(contentHash);
        }
      }
      
      const data = await fs.readFile(testCacheFilePath, 'utf8');
      const results = JSON.parse(data);
      
      // Add cache hit info
      results._cacheInfo = {
        hit: true,
        cachedAt: results.cachedAt || new Date().toISOString(),
        retrievedAt: new Date().toISOString()
      };
      
      return results;
    } catch (error) {
      return null;
    }
  }

  /**
   * Store test generation results in cache
   * @param {string} contentHash - Content hash
   * @param {Object} testResults - Test generation results to cache
   * @param {string} originalContent - Original content (for reference)
   * @param {string} documentName - Document name (for directory organization)
   */
  async storeCachedTestResults(contentHash, testResults, originalContent, documentName = null) {
    try {
      // Add cache metadata
      const cachedTestResults = {
        ...testResults,
        _cacheInfo: {
          hit: false,
          cachedAt: new Date().toISOString(),
          contentLength: originalContent.length,
          contentHash,
          documentName: documentName
        }
      };

      // Create document-specific directory if document name provided
      const testCacheFilePath = this.getTestCacheFilePath(contentHash, documentName);
      const docDir = path.dirname(testCacheFilePath);
      
      // Ensure directory exists
      await fs.mkdir(docDir, { recursive: true });

      // Save test results to cache file
      await fs.writeFile(testCacheFilePath, JSON.stringify(cachedTestResults, null, 2));

      // Update document-specific metadata if document name provided
      if (documentName) {
        const docMetadata = await this.loadDocumentMetadata(documentName);
        docMetadata[contentHash] = {
          type: 'test_generation',
          cachedAt: new Date().toISOString(),
          contentLength: originalContent.length,
          generatedLength: testResults.content?.length || 0
        };
        await this.saveDocumentMetadata(documentName, docMetadata);
      }

      const location = documentName ? `in ${this.sanitizeFileName(documentName)}/` : 'in root cache';
      // console.log(`💾 Cached test generation results ${location} (${contentHash.substring(0, 8)}...)`);
    } catch (error) {
      console.error('❌ Failed to cache test results:', error.message);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  async getCacheStats() {
    try {
      const metadata = await this.loadMetadata();
      const files = await fs.readdir(this.cacheDir);
      const directories = files.filter(file => {
        const filePath = path.join(this.cacheDir, file);
        return fs.stat(filePath).then(stats => stats.isDirectory()).catch(() => false);
      });
      
      let totalFiles = 0;
      let documentCacheFiles = 0;
      let testCacheFiles = 0;
      let totalSize = 0;
      let documentCacheSize = 0;
      let testCacheSize = 0;
      let documentDirectories = 0;
      
      // Count files in document directories
      for (const dir of directories) {
        if (dir !== 'metadata.json') {
          documentDirectories++;
          try {
            const dirPath = path.join(this.cacheDir, dir);
            const dirFiles = await fs.readdir(dirPath);
            const jsonFiles = dirFiles.filter(file => file.endsWith('.json'));
            
            for (const file of jsonFiles) {
              const filePath = path.join(dirPath, file);
              const stats = await fs.stat(filePath);
              totalSize += stats.size;
              totalFiles++;
              
              if (file.startsWith('test_')) {
                testCacheFiles++;
                testCacheSize += stats.size;
              } else {
                documentCacheFiles++;
                documentCacheSize += stats.size;
              }
            }
          } catch (error) {
            // console.log(`⚠️  Could not read directory ${dir}:`, error.message);
          }
        }
      }
      
      // Count legacy files in root cache directory
      const legacyFiles = files.filter(file => file.endsWith('.json') && file !== 'metadata.json');
      for (const file of legacyFiles) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        totalFiles++;
        
        if (file.startsWith('test_')) {
          testCacheFiles++;
          testCacheSize += stats.size;
        } else {
          documentCacheFiles++;
          documentCacheSize += stats.size;
        }
      }

      return {
        totalFiles: totalFiles,
        documentCacheFiles: documentCacheFiles,
        testCacheFiles: testCacheFiles,
        documentDirectories: documentDirectories,
        totalSize: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        documentCacheSizeMB: (documentCacheSize / (1024 * 1024)).toFixed(2),
        testCacheSizeMB: (testCacheSize / (1024 * 1024)).toFixed(2),
        metadata: metadata
      };
    } catch (error) {
      console.error('❌ Failed to get cache stats:', error.message);
      return { 
        totalFiles: 0, 
        documentCacheFiles: 0,
        testCacheFiles: 0,
        documentDirectories: 0,
        totalSize: 0, 
        totalSizeMB: '0.00',
        documentCacheSizeMB: '0.00',
        testCacheSizeMB: '0.00',
        metadata: {} 
      };
    }
  }

  /**
   * Clear cache (remove all cached files)
   */
  async clearCache() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const cacheFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of cacheFiles) {
        const filePath = path.join(this.cacheDir, file);
        await fs.unlink(filePath);
      }
      
      // console.log(`🗑️  Cleared ${cacheFiles.length} cached files`);
    } catch (error) {
      console.error('❌ Failed to clear cache:', error.message);
    }
  }

  /**
   * Remove specific cached file
   * @param {string} hash - File hash to remove
   */
  async removeCachedFile(hash) {
    try {
      const cacheFilePath = this.getCacheFilePath(hash);
      await fs.unlink(cacheFilePath);
      
      // Update metadata
      const metadata = await this.loadMetadata();
      delete metadata[hash];
      await this.saveMetadata(metadata);
      
      // console.log(`🗑️  Removed cached file ${hash.substring(0, 8)}...`);
    } catch (error) {
      console.error('❌ Failed to remove cached file:', error.message);
    }
  }

  /**
   * Get document-based cache file path (using document name instead of hash)
   * @param {string} documentName - Document name
   * @param {string} type - Type of cache ('analysis', 'requirements', 'tests')
   * @returns {string} - Cache file path
   */
  getDocumentCacheFilePath(documentName, type) {
    const docDir = path.join(this.cacheDir, this.sanitizeFileName(documentName));
    return path.join(docDir, `${type}.json`);
  }

  /**
   * Check if document has cached results (by document name)
   * @param {string} documentName - Document name
   * @param {string} type - Type of cache ('analysis', 'requirements', 'tests')
   * @returns {boolean} - True if cached results exist
   */
  async hasDocumentCachedResults(documentName, type) {
    try {
      const cacheFilePath = this.getDocumentCacheFilePath(documentName, type);
      await fs.access(cacheFilePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get document cached results (by document name)
   * @param {string} documentName - Document name
   * @param {string} type - Type of cache ('analysis', 'requirements', 'tests')
   * @returns {Object|null} - Cached results or null
   */
  async getDocumentCachedResults(documentName, type) {
    try {
      const cacheFilePath = this.getDocumentCacheFilePath(documentName, type);
      const data = await fs.readFile(cacheFilePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Store document cached results (by document name)
   * @param {string} documentName - Document name
   * @param {string} type - Type of cache ('analysis', 'requirements', 'tests')
   * @param {Object} results - Results to cache
   */
  async storeDocumentCachedResults(documentName, type, results) {
    try {
      // Add cache metadata
      const cachedResults = {
        ...results,
        _cacheInfo: {
          hit: false,
          cachedAt: new Date().toISOString(),
          documentName,
          type,
          isDocumentBased: true
        }
      };

      const cacheFilePath = this.getDocumentCacheFilePath(documentName, type);
      const docDir = path.dirname(cacheFilePath);
      
      // Ensure directory exists
      await fs.mkdir(docDir, { recursive: true });

      // Save results to cache file
      await fs.writeFile(cacheFilePath, JSON.stringify(cachedResults, null, 2));

      // Update document-specific metadata
      const docMetadata = await this.loadDocumentMetadata(documentName);
      docMetadata[`${type}_latest`] = {
        type: type,
        cachedAt: new Date().toISOString(),
        isDocumentBased: true,
        contentLength: results.content?.length || results.fileSize || 0,
        generatedLength: results.generatedContentLength || results.extractedContentLength || 0
      };
      await this.saveDocumentMetadata(documentName, docMetadata);

      // Update global metadata for Jira issues (they don't have file hashes)
      if (documentName.startsWith('jira-')) {
        const globalMetadata = await this.loadMetadata();
        const jiraKey = `jira_${documentName.replace('jira-', '')}`;
        
        // Update or create Jira entry in global metadata
        if (!globalMetadata[jiraKey]) {
          globalMetadata[jiraKey] = {
            filename: documentName,
            cachedAt: new Date().toISOString(),
            fileSize: 0,
            issueCount: 0,
            documentDir: this.sanitizeFileName(documentName),
            type: 'jira_issue'
          };
        }
        
        // Update the cachedAt timestamp
        globalMetadata[jiraKey].cachedAt = new Date().toISOString();
        
        await this.saveMetadata(globalMetadata);
      }

      // console.log(`💾 Cached ${type} results for ${documentName} (document-based)`);
    } catch (error) {
      console.error(`❌ Failed to cache ${type} results:`, error.message);
    }
  }

  /**
   * List all cached documents with metadata
   * @returns {Array} - Array of document objects with metadata
   */
  async listCachedDocuments() {
    try {
      const documents = [];
      const entries = await fs.readdir(this.cacheDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          const docName = entry.name;
          const docDir = path.join(this.cacheDir, docName);
          const metadataPath = path.join(docDir, 'metadata.json');
          
          try {
            // Read document metadata
            const metadataContent = await fs.readFile(metadataPath, 'utf8');
            const metadata = JSON.parse(metadataContent);
            
            // Count requirements if requirements.json exists
            let requirementsCount = 0;
            try {
              const requirementsPath = path.join(docDir, 'requirements.json');
              const requirementsContent = await fs.readFile(requirementsPath, 'utf8');
              const requirements = JSON.parse(requirementsContent);
              
              // Parse requirements table to count them
              if (requirements.content) {
                const lines = requirements.content.split('\n');
                const tableLines = lines.filter(line => 
                  line.includes('|') && 
                  !line.toLowerCase().includes('requirement id') &&
                  !line.toLowerCase().includes('business requirement') &&
                  !line.trim().match(/^[\s\-|]+$/)
                );
                requirementsCount = tableLines.length;
              }
            } catch (reqError) {
              // Requirements file doesn't exist or can't be parsed
              requirementsCount = 0;
            }
            
            // Get the cachedAt date from root metadata.json
            let dateCached = 'Unknown';
            try {
              // Read root metadata to get the original cachedAt date
              const rootMetadataContent = await fs.readFile(this.metadataFile, 'utf8');
              const rootMetadata = JSON.parse(rootMetadataContent);
              
              // Find the entry for this document by matching documentDir
              const sanitizedDocName = this.sanitizeFileName(docName);
              for (const [hashKey, entry] of Object.entries(rootMetadata)) {
                if (entry.documentDir === sanitizedDocName && entry.cachedAt) {
                  const date = new Date(entry.cachedAt);
                  if (!isNaN(date.getTime())) {
                    dateCached = date.toISOString();
                    break;
                  }
                }
              }
            } catch (error) {
              console.warn(`⚠️ Could not read root metadata for ${docName}: ${error.message}`);
            }

            documents.push({
              name: docName,
              dateCached: dateCached,
              requirementsCount: requirementsCount,
              hasAnalysis: await this.fileExists(path.join(docDir, 'analysis.json')),
              hasRequirements: await this.fileExists(path.join(docDir, 'requirements.json')),
              hasTests: await this.fileExists(path.join(docDir, 'tests.json'))
            });
          } catch (metaError) {
            // Skip directories without proper metadata
            console.warn(`⚠️ Skipping directory ${docName}: ${metaError.message}`);
          }
        }
      }
      
      // Sort by date (newest first)
      documents.sort((a, b) => new Date(b.dateCached) - new Date(a.dateCached));
      
      return documents;
    } catch (error) {
      console.error('❌ Failed to list cached documents:', error.message);
      return [];
    }
  }

  /**
   * Delete multiple documents from cache
   * @param {Array} documentNames - Array of document names to delete
   * @returns {Object} - Results of deletion operation
   */
  async deleteMultipleDocuments(documentNames) {
    const results = {
      deletedCount: 0,
      failedCount: 0,
      deletedDocuments: [],
      failedDocuments: []
    };
    
    for (const docName of documentNames) {
      try {
        const docDir = path.join(this.cacheDir, this.sanitizeFileName(docName));
        
        // Check if directory exists
        try {
          await fs.access(docDir);
        } catch (error) {
          results.failedCount++;
          results.failedDocuments.push({ name: docName, error: 'Directory not found' });
          continue;
        }
        
        // Remove the entire document directory
        await fs.rm(docDir, { recursive: true, force: true });
        
        results.deletedCount++;
        results.deletedDocuments.push(docName);
        // console.log(`🗑️ Deleted cached document: ${docName}`);
        
      } catch (error) {
        results.failedCount++;
        results.failedDocuments.push({ name: docName, error: error.message });
        console.error(`❌ Failed to delete ${docName}:`, error.message);
      }
    }
    
    // Remove entries from root metadata.json for successfully deleted documents
    if (results.deletedCount > 0) {
      await this.removeFromRootMetadata(results.deletedDocuments);
    }
    
    return results;
  }

  /**
   * Remove entries from root metadata.json
   * @param {Array} documentNames - Array of document names to remove from metadata
   */
  async removeFromRootMetadata(documentNames) {
    try {
      // Read current metadata
      let metadata = {};
      try {
        const metadataContent = await fs.readFile(this.metadataFile, 'utf8');
        metadata = JSON.parse(metadataContent);
      } catch (error) {
        // Metadata file doesn't exist or is invalid, start fresh
        metadata = {};
      }

      // Remove entries for deleted documents
      let removedCount = 0;
      const keysToRemove = [];
      
      // Find entries to remove by matching filename field or Jira key
      for (const [hashKey, entry] of Object.entries(metadata)) {
        if (entry.filename && documentNames.includes(entry.filename)) {
          keysToRemove.push(hashKey);
          removedCount++;
          // console.log(`📝 Found metadata entry to remove: ${entry.filename} (${hashKey.substring(0, 8)}...)`);
        } else if (entry.type === 'jira_issue' && entry.filename && documentNames.includes(entry.filename)) {
          // Handle Jira issues - the key is jira_PROJ-123 but filename is jira-PROJ-123
          keysToRemove.push(hashKey);
          removedCount++;
          // console.log(`📝 Found Jira metadata entry to remove: ${entry.filename} (${hashKey})`);
        }
      }
      
      // Remove the found entries
      for (const key of keysToRemove) {
        delete metadata[key];
      }

      // Write updated metadata back to file
      await fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2));
      // console.log(`📝 Removed ${removedCount} entries from root metadata.json`);
      
    } catch (error) {
      console.error('❌ Failed to update root metadata:', error.message);
    }
  }

  /**
   * Check if a file exists
   * @param {string} filePath - Path to check
   * @returns {boolean} - True if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get pushed state cache file path
   * @param {string} documentName - Document name
   * @returns {string} - Pushed state cache file path
   */
  getPushedStateFilePath(documentName) {
    const docDir = path.join(this.cacheDir, this.sanitizeFileName(documentName));
    return path.join(docDir, 'pushedState.json');
  }

  /**
   * Check if pushed state exists for a document
   * @param {string} documentName - Document name
   * @returns {boolean} - True if pushed state exists
   */
  async hasPushedState(documentName) {
    try {
      const pushedStatePath = this.getPushedStateFilePath(documentName);
      await fs.access(pushedStatePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get pushed state for a document
   * @param {string} documentName - Document name
   * @returns {Object|null} - Pushed state or null if not found
   */
  async getPushedState(documentName) {
    try {
      const pushedStatePath = this.getPushedStateFilePath(documentName);
      const data = await fs.readFile(pushedStatePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Store pushed state for a document
   * @param {string} documentName - Document name
   * @param {Object} pushedState - Pushed state to store
   */
  async storePushedState(documentName, pushedState) {
    try {
      const pushedStatePath = this.getPushedStateFilePath(documentName);
      const docDir = path.dirname(pushedStatePath);
      
      // Ensure directory exists
      await fs.mkdir(docDir, { recursive: true });

      // Add cache metadata
      const cachedPushedState = {
        ...pushedState,
        _cacheInfo: {
          hit: false,
          cachedAt: new Date().toISOString(),
          documentName,
          type: 'pushed_state'
        }
      };

      // Save pushed state to cache file
      await fs.writeFile(pushedStatePath, JSON.stringify(cachedPushedState, null, 2));

      // Update document-specific metadata
      const docMetadata = await this.loadDocumentMetadata(documentName);
      docMetadata.pushedState = {
        type: 'pushed_state',
        cachedAt: new Date().toISOString(),
        pushedTabsCount: pushedState.pushedTabs?.length || 0,
        testCaseIdsCount: Object.keys(pushedState.zephyrTestCaseIds || {}).length
      };
      await this.saveDocumentMetadata(documentName, docMetadata);

      // Update global metadata for Jira issues (they don't have file hashes)
      if (documentName.startsWith('jira-')) {
        const globalMetadata = await this.loadMetadata();
        const jiraKey = `jira_${documentName.replace('jira-', '')}`;
        
        globalMetadata[jiraKey] = {
          filename: documentName,
          cachedAt: new Date().toISOString(),
          fileSize: 0,
          issueCount: 0,
          documentDir: this.sanitizeFileName(documentName),
          type: 'jira_issue',
          pushedTabsCount: pushedState.pushedTabs?.length || 0,
          testCaseIdsCount: Object.keys(pushedState.zephyrTestCaseIds || {}).length
        };
        
        await this.saveMetadata(globalMetadata);
      }

      // console.log(`💾 Cached pushed state for ${documentName}`);
    } catch (error) {
      console.error('❌ Failed to cache pushed state:', error.message);
    }
  }

  /**
   * Clear pushed state for a document
   * @param {string} documentName - Document name
   */
  async clearPushedState(documentName) {
    try {
      const pushedStatePath = this.getPushedStateFilePath(documentName);
      await fs.unlink(pushedStatePath);
      
      // Update document metadata
      const docMetadata = await this.loadDocumentMetadata(documentName);
      delete docMetadata.pushedState;
      await this.saveDocumentMetadata(documentName, docMetadata);
      
      // Remove from global metadata for Jira issues
      if (documentName.startsWith('jira-')) {
        const globalMetadata = await this.loadMetadata();
        const jiraKey = `jira_${documentName.replace('jira-', '')}`;
        delete globalMetadata[jiraKey];
        await this.saveMetadata(globalMetadata);
      }
      
      // console.log(`🗑️ Cleared pushed state for ${documentName}`);
    } catch (error) {
      console.error('❌ Failed to clear pushed state:', error.message);
    }
  }

  /**
   * Get all documents with pushed state
   * @returns {Array} - Array of documents with pushed state info
   */
  async getAllPushedStates() {
    try {
      const documents = [];
      const entries = await fs.readdir(this.cacheDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          const docName = entry.name;
          const pushedState = await this.getPushedState(docName);
          
          if (pushedState) {
            documents.push({
              documentName: docName,
              pushedTabs: pushedState.pushedTabs || [],
              zephyrTestCaseIds: pushedState.zephyrTestCaseIds || {},
              jiraTicketInfo: pushedState.jiraTicketInfo || {},
              cachedAt: pushedState._cacheInfo?.cachedAt || 'Unknown'
            });
          }
        }
      }
      
      return documents;
    } catch (error) {
      console.error('❌ Failed to get all pushed states:', error.message);
      return [];
    }
  }
}

module.exports = CacheManager;
