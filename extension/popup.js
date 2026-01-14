const STORAGE_KEYS = {
  TEXA_ORIGIN: 'texa_origin',
  TEXA_TOKEN: 'texa_token',
  TEXA_USER: 'texa_user',
  LAST_SYNC: 'last_sync'
};

class TEXAToolsManager {
  constructor() {
    this.origin = '';
    this.idToken = '';
    this.user = null;
    this.tools = [];
    this.init();
  }

  async init() {
    await this.loadStoredData();
    await this.checkConnection();
    await this.loadTools();
    
    // Trigger background scraping process
    chrome.runtime.sendMessage({ type: 'TEXA_SCRAPE_TOKEN' });
  }

  async loadStoredData() {
    try {
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.TEXA_ORIGIN,
        STORAGE_KEYS.TEXA_TOKEN,
        STORAGE_KEYS.TEXA_USER
      ]);
      
      this.origin = result[STORAGE_KEYS.TEXA_ORIGIN] || '';
      this.idToken = result[STORAGE_KEYS.TEXA_TOKEN] || '';
      this.user = result[STORAGE_KEYS.TEXA_USER] || null;
    } catch (error) {
      console.error('Error loading stored data:', error);
    }
  }

  async checkConnection() {
    const statusEl = document.getElementById('status');
    
    if (!this.origin || !this.idToken) {
      statusEl.style.display = 'none';
      return false;
    }

    try {
      // Use catalog endpoint to check connection as it is accessible to all members
      const response = await fetch(`${this.origin}/api/catalog`, {
        headers: {
          'Authorization': `Bearer ${this.idToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        statusEl.textContent = `Terhubung sebagai ${this.user?.email || 'Member'}`;
        statusEl.className = 'status connected';
        statusEl.style.display = 'block';
        return true;
      } else {
        statusEl.textContent = 'Koneksi gagal - silakan login ulang';
        statusEl.className = 'status disconnected';
        statusEl.style.display = 'block';
        return false;
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      statusEl.textContent = 'Koneksi error - periksa koneksi internet';
      statusEl.className = 'status disconnected';
      statusEl.style.display = 'block';
      return false;
    }
  }

  async loadTools() {
    const contentEl = document.getElementById('content');
    
    if (!this.origin || !this.idToken) {
      contentEl.innerHTML = `
        <div class="error" style="text-align: center; padding: 30px 10px; border: none;">
          <p style="color: #555; font-size: 14px; margin-bottom: 15px;">Silakan login untuk mengakses tools.</p>
          <button id="btnLogin" class="btn-primary" style="width: auto; padding: 8px 24px;">Login ke Dashboard</button>
        </div>
      `;
      document.getElementById('btnLogin').addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://texa-canvas.vercel.app/' });
      });
      return;
    }

    try {
      const response = await fetch(`${this.origin}/api/catalog`, {
        headers: {
          'Authorization': `Bearer ${this.idToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load tools');
      }

      const data = await response.json();
      this.tools = data && data.tools ? data.tools : [];
      
      this.renderTools();
    } catch (error) {
      console.error('Error loading tools:', error);
      contentEl.innerHTML = `
        <div class="error">
          Gagal memuat tools. Silakan refresh atau cek koneksi.
        </div>
      `;
    }
  }

  renderTools() {
    const contentEl = document.getElementById('content');
    
    if (!this.tools.length) {
      contentEl.innerHTML = `
        <div class="error">
          Tidak ada tools yang tersedia atau belum berlangganan.
        </div>
      `;
      return;
    }

    const toolsHtml = this.tools.map(tool => `
      <div class="tool-item" data-tool-id="${tool.id}">
        <div class="tool-name">${this.escapeHtml(tool.name || 'Unnamed Tool')}</div>
        <div class="tool-url">${this.escapeHtml(tool.targetUrl || 'No URL')}</div>
        <button class="btn-primary" onclick="texaManager.openTool('${tool.id}')">
          Open Tool
        </button>
      </div>
    `).join('');

    contentEl.innerHTML = `<div class="tools-list">${toolsHtml}</div>`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async openTool(toolId) {
    try {
      // Find tool details
      const tool = this.tools.find(t => t.id === toolId);
      if (!tool) {
        throw new Error('Tool info not found');
      }

      // Construct API URL if not provided directly in tool object
      // Priority: tool.apiUrl > tool.accessUrl > constructed URL
      const apiUrl = tool.apiUrl || tool.accessUrl || `${this.origin}/api/tools/${toolId}/access`;
      
      const message = {
        type: 'TEXA_OPEN_TOOL',
        origin: this.origin,
        toolId: toolId,
        targetUrl: tool.targetUrl,
        apiUrl: apiUrl,
        authHeader: `Bearer ${this.idToken}`
      };

      // Show loading state on button
      const btn = document.querySelector(`button[onclick="texaManager.openTool('${toolId}')"]`);
      const originalText = btn ? btn.innerText : 'Open Tool';
      if (btn) {
        btn.innerText = 'Opening...';
        btn.disabled = true;
      }

      const response = await chrome.runtime.sendMessage(message);
      
      if (response && response.success) {
        // Optional: show success before closing
        if (btn) btn.innerText = 'Success!';
        setTimeout(() => window.close(), 500);
      } else {
        alert('Gagal membuka tool: ' + (response?.error || 'Unknown error'));
        if (btn) {
          btn.innerText = originalText;
          btn.disabled = false;
        }
      }
    } catch (error) {
      console.error('Error opening tool:', error);
      alert('Error membuka tool. Periksa console untuk detail.');
    }
  }
}

const texaManager = new TEXAToolsManager();

window.texaManager = texaManager;