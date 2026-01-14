
(function() {
  window.TEXAExtension = {
    ready: true,
    version: '1.0.0',
    
    /**
     * Opens a tool by fetching cookies from apiUrl and injecting them before navigation.
     * @param {string} toolId 
     * @param {string} targetUrl 
     * @param {string} apiUrl 
     */
    openTool: function(toolId, targetUrl, apiUrl) {
      console.log('TEXA Extension: Opening tool', toolId, targetUrl, apiUrl);
      
      window.postMessage({
        source: 'TEXA_DASHBOARD',
        type: 'TEXA_OPEN_TOOL',
        toolId: toolId,
        targetUrl: targetUrl,
        apiUrl: apiUrl
      }, window.location.origin);
    },
    
    getStatus: function() {
      return {
        ready: true,
        version: '1.0.0',
        connected: true
      };
    }
  };

  // Dispatch event to notify React app that extension is ready
  window.dispatchEvent(new CustomEvent('TEXA_EXTENSION_READY'));
})();
